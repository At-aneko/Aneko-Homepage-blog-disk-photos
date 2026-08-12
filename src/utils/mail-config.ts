const encoder = new TextEncoder()
const decoder = new TextDecoder()

const MAIL_CONFIG_AAD = encoder.encode('aneko:mail-config:v2')
const MAIL_CONFIG_KEY = 'mail:config:v2'
const STORED_SCHEMA_VERSION = 2
const AES_GCM_IV_BYTES = 12
const MAX_PASSWORD_LENGTH = 4096
const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u
const UNSAFE_HOST_SUFFIXES = ['.internal', '.lan', '.local', '.localhost', '.home', '.invalid', '.test']

export const MAIL_REQUEST_MAX_BODY_BYTES = 2 * 1024 * 1024

export interface MailBindings {
  ANEKO_KV: KVNamespace
  MAIL_CONFIG_ENCRYPTION_KEY?: string
  MAIL_CONFIG_KV_KEY?: string
  MAIL_ALLOWED_HOSTS?: string
}

export interface MailConnectionConfig {
  host: string
  port: 993 | 465
  username: string
  password: string
}

export interface MailConfiguration {
  configured: boolean
  revision: string | null
  updatedAt: string | null
  address: string
  displayName: string
  imap: MailConnectionConfig
  smtp: MailConnectionConfig
}

export interface MailAdminConfiguration {
  configured: boolean
  revision: string | null
  updatedAt: string | null
  address: string
  displayName: string
  imap: Omit<MailConnectionConfig, 'password'> & { passwordConfigured: boolean }
  smtp: Omit<MailConnectionConfig, 'password'> & { passwordConfigured: boolean }
}

interface EncryptedEnvelope {
  schemaVersion: typeof STORED_SCHEMA_VERSION
  revision: string
  updatedAt: string
  algorithm: 'AES-256-GCM'
  iv: string
  ciphertext: string
}

type JsonRecord = Record<string, unknown>

export class MailConfigValidationError extends Error {
  constructor(message = 'Invalid mail configuration') {
    super(message)
    this.name = 'MailConfigValidationError'
  }
}

export class MailConfigConflictError extends Error {
  constructor() {
    super('Mail configuration has changed; reload and try again')
    this.name = 'MailConfigConflictError'
  }
}

export class MailConfigUnavailableError extends Error {
  constructor() {
    super('Mail configuration is unavailable')
    this.name = 'MailConfigUnavailableError'
  }
}

function emptyConfiguration(): MailConfiguration {
  return {
    configured: false,
    revision: null,
    updatedAt: null,
    address: '',
    displayName: '',
    imap: { host: '', port: 993, username: '', password: '' },
    smtp: { host: '', port: 465, username: '', password: '' },
  }
}

function validationError(message: string): never {
  throw new MailConfigValidationError(message)
}

function asRecord(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    validationError(`${field} must be an object`)
  }
  return value as JsonRecord
}

function assertKnownKeys(input: JsonRecord, allowed: readonly string[], field: string) {
  const allowedKeys = new Set(allowed)
  const unexpected = Object.keys(input).find((key) => !allowedKeys.has(key))
  if (unexpected) validationError(`${field}.${unexpected} is not supported`)
}

function textField(
  input: JsonRecord,
  key: string,
  field: string,
  options: { maxLength: number; allowEmpty?: boolean } = { maxLength: 254 },
) {
  const value = input[key]
  if (typeof value !== 'string') validationError(`${field}.${key} must be a string`)
  const normalized = value.trim()
  if (!options.allowEmpty && !normalized) validationError(`${field}.${key} is required`)
  if (normalized.length > options.maxLength || CONTROL_CHARACTER_PATTERN.test(normalized)) {
    validationError(`${field}.${key} is invalid`)
  }
  return normalized
}

function normalizeEmail(value: string, field: string) {
  const normalized = value.toLowerCase()
  if (normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
    validationError(`${field} must be a valid email address`)
  }
  return normalized
}

function normalizeHostname(value: string, field: string) {
  const hostname = value.toLowerCase().replace(/\.$/, '')
  if (!HOSTNAME_PATTERN.test(hostname)
    || /^\d+(?:\.\d+){3}$/.test(hostname)
    || UNSAFE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    validationError(`${field} must be a public DNS hostname`)
  }
  return hostname
}

function passwordField(input: JsonRecord, existing: string, field: string, endpointChanged: boolean) {
  if (!Object.prototype.hasOwnProperty.call(input, 'password')) {
    if (existing && endpointChanged) {
      validationError(`${field}.password is required when host or username changes`)
    }
    return existing
  }
  const value = input.password
  if (value === null) return ''
  if (typeof value !== 'string' || !value || value.length > MAX_PASSWORD_LENGTH) {
    validationError(`${field}.password must be omitted, null, or a non-empty string`)
  }
  return value
}

function normalizeConnection(
  value: unknown,
  field: 'imap' | 'smtp',
  existing: MailConnectionConfig,
): MailConnectionConfig {
  const input = asRecord(value, field)
  assertKnownKeys(input, ['host', 'port', 'username', 'password', 'passwordConfigured'], field)
  const expectedPort = field === 'imap' ? 993 : 465
  if (input.port !== expectedPort) validationError(`${field}.port must be ${expectedPort}`)

  const host = normalizeHostname(textField(input, 'host', field, { maxLength: 253 }), `${field}.host`)
  const username = textField(input, 'username', field, { maxLength: 320 })
  const endpointChanged = host !== existing.host || username !== existing.username

  return {
    host,
    port: expectedPort,
    username,
    password: passwordField(input, existing.password, field, endpointChanged),
  }
}

function normalizeConfiguration(value: unknown, existing: MailConfiguration): MailConfiguration {
  const input = asRecord(value, 'body')
  assertKnownKeys(input, ['revision', 'address', 'displayName', 'imap', 'smtp'], 'body')

  const address = normalizeEmail(textField(input, 'address', 'body', { maxLength: 254 }), 'body.address')
  const displayName = textField(input, 'displayName', 'body', {
    maxLength: 80,
    allowEmpty: true,
  })

  const imap = normalizeConnection(input.imap, 'imap', existing.imap)
  const smtp = normalizeConnection(input.smtp, 'smtp', existing.smtp)

  return {
    configured: Boolean(imap.password && smtp.password),
    revision: existing.revision,
    updatedAt: existing.updatedAt,
    address,
    displayName,
    imap,
    smtp,
  }
}

function parseExpectedRevision(value: unknown) {
  const input = asRecord(value, 'body')
  if (!Object.prototype.hasOwnProperty.call(input, 'revision')) {
    validationError('body.revision is required')
  }
  if (input.revision !== null
    && (typeof input.revision !== 'string' || !UUID_PATTERN.test(input.revision))) {
    validationError('body.revision must be a valid revision or null')
  }
  return input.revision as string | null
}

function parseAllowedHosts(value?: string) {
  const entries = new Set<string>()
  for (const rawEntry of (value || '').split(/[\s,;]+/u)) {
    const entry = rawEntry.trim().toLowerCase()
    if (!entry) continue
    entries.add(normalizeHostname(entry, 'MAIL_ALLOWED_HOSTS'))
  }
  return entries
}

function validateMailHostsAllowed(bindings: MailBindings, configuration: MailConfiguration) {
  const allowed = parseAllowedHosts(bindings.MAIL_ALLOWED_HOSTS)
  if (!allowed.size) return
  for (const connection of [configuration.imap, configuration.smtp]) {
    if (!allowed.has(connection.host)) {
      validationError('A mail server is not in MAIL_ALLOWED_HOSTS')
    }
  }
}

export function assertMailHostsAllowed(bindings: MailBindings, configuration: MailConfiguration) {
  if (!configuration.configured) throw new MailConfigUnavailableError()
  validateMailHostsAllowed(bindings, configuration)
}

function getKvKey(bindings: MailBindings) {
  return bindings.MAIL_CONFIG_KV_KEY?.trim() || MAIL_CONFIG_KEY
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url')
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function decodeEncryptionKey(value?: string) {
  const secret = value?.trim() || ''
  if (/^[0-9a-f]{64}$/i.test(secret)) {
    return Uint8Array.from(secret.match(/.{2}/g) || [], (byte) => Number.parseInt(byte, 16))
  }
  try {
    const decoded = decodeBase64(secret.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''))
    if (decoded.byteLength === 32) return decoded
  } catch {
    // Dashboard-managed secrets may be raw strings.
  }
  const raw = encoder.encode(secret)
  if (raw.byteLength === 32) return raw
  throw new MailConfigUnavailableError()
}

async function importEncryptionKey(value?: string) {
  return crypto.subtle.importKey(
    'raw',
    decodeEncryptionKey(value),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptConfiguration(
  configuration: MailConfiguration,
  revision: string,
  updatedAt: string,
  keyValue?: string,
): Promise<EncryptedEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES))
  const key = await importEncryptionKey(keyValue)
  const plaintext = encoder.encode(JSON.stringify({
    address: configuration.address,
    displayName: configuration.displayName,
    imap: configuration.imap,
    smtp: configuration.smtp,
  }))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: MAIL_CONFIG_AAD, tagLength: 128 },
    key,
    plaintext,
  )
  return {
    schemaVersion: STORED_SCHEMA_VERSION,
    revision,
    updatedAt,
    algorithm: 'AES-256-GCM',
    iv: encodeBase64Url(iv),
    ciphertext: encodeBase64Url(new Uint8Array(ciphertext)),
  }
}

function parseEnvelope(value: unknown): EncryptedEnvelope {
  const input = asRecord(value, 'stored configuration')
  assertKnownKeys(
    input,
    ['schemaVersion', 'revision', 'updatedAt', 'algorithm', 'iv', 'ciphertext'],
    'stored configuration',
  )
  if (input.schemaVersion !== STORED_SCHEMA_VERSION
    || input.algorithm !== 'AES-256-GCM'
    || typeof input.revision !== 'string'
    || !UUID_PATTERN.test(input.revision)
    || typeof input.updatedAt !== 'string'
    || Number.isNaN(Date.parse(input.updatedAt))
    || typeof input.iv !== 'string'
    || typeof input.ciphertext !== 'string') {
    throw new MailConfigUnavailableError()
  }
  return input as unknown as EncryptedEnvelope
}

async function decryptConfiguration(envelope: EncryptedEnvelope, keyValue?: string) {
  const iv = decodeBase64(envelope.iv)
  const ciphertext = decodeBase64(envelope.ciphertext)
  if (iv.byteLength !== AES_GCM_IV_BYTES || ciphertext.byteLength < 16) {
    throw new MailConfigUnavailableError()
  }
  const key = await importEncryptionKey(keyValue)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: MAIL_CONFIG_AAD, tagLength: 128 },
    key,
    ciphertext,
  )
  const parsed = JSON.parse(decoder.decode(plaintext)) as JsonRecord
  const base = emptyConfiguration()
  const configuration = normalizeConfiguration({ ...parsed, revision: envelope.revision }, base)
  return {
    ...configuration,
    revision: envelope.revision,
    updatedAt: envelope.updatedAt,
  }
}

export async function readMailConfiguration(bindings: MailBindings): Promise<MailConfiguration> {
  const raw = await bindings.ANEKO_KV.get(getKvKey(bindings))
  if (!raw) return emptyConfiguration()
  try {
    const envelope = parseEnvelope(JSON.parse(raw))
    return await decryptConfiguration(envelope, bindings.MAIL_CONFIG_ENCRYPTION_KEY)
  } catch (error) {
    if (error instanceof MailConfigUnavailableError) throw error
    throw new MailConfigUnavailableError()
  }
}

export async function saveMailConfiguration(bindings: MailBindings, value: unknown) {
  const existing = await readMailConfiguration(bindings)
  const expectedRevision = parseExpectedRevision(value)
  if (expectedRevision !== existing.revision) throw new MailConfigConflictError()
  const configuration = normalizeConfiguration(value, existing)
  validateMailHostsAllowed(bindings, configuration)

  const revision = crypto.randomUUID()
  const updatedAt = new Date().toISOString()
  const envelope = await encryptConfiguration(
    configuration,
    revision,
    updatedAt,
    bindings.MAIL_CONFIG_ENCRYPTION_KEY,
  )
  await bindings.ANEKO_KV.put(getKvKey(bindings), JSON.stringify(envelope))
  return { ...configuration, revision, updatedAt }
}

export async function resolveMailDraft(
  bindings: MailBindings,
  value?: unknown,
  allowIncompletePassword = false,
) {
  const existing = await readMailConfiguration(bindings)
  let configuration: MailConfiguration
  if (value === undefined) {
    configuration = existing
  } else if (allowIncompletePassword) {
    const input = asRecord(value, 'body')
    assertKnownKeys(input, ['address', 'displayName', 'imap', 'smtp'], 'body')
    configuration = normalizeConfiguration({ ...input, revision: existing.revision }, existing)
  } else {
    configuration = normalizeConfiguration(value, existing)
  }
  if (!configuration.configured && !allowIncompletePassword) throw new MailConfigUnavailableError()
  validateMailHostsAllowed(bindings, configuration)
  return configuration
}

export function adminMailConfiguration(configuration: MailConfiguration): MailAdminConfiguration {
  const projectConnection = (connection: MailConnectionConfig) => ({
    host: connection.host,
    port: connection.port,
    username: connection.username,
    passwordConfigured: Boolean(connection.password),
  })
  return {
    configured: configuration.configured,
    revision: configuration.revision,
    updatedAt: configuration.updatedAt,
    address: configuration.address,
    displayName: configuration.displayName,
    imap: projectConnection(configuration.imap),
    smtp: projectConnection(configuration.smtp),
  }
}
