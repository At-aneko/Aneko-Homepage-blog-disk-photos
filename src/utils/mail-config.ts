import { getMailConfigKey } from './cloudflare'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const MAIL_CONFIG_MAX_BODY_BYTES = 64 * 1024

const MAIL_CONFIG_AAD = encoder.encode('aneko:mail-config:v1')
const STORED_SCHEMA_VERSION = 1
const ENCRYPTION_ALGORITHM = 'A256GCM'
const ENCRYPTION_KEY_ID = 'v1'
const AES_GCM_IV_BYTES = 12
const MAX_SECRET_LENGTH = 4096
const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
const IPV4_LITERAL_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u
const NON_TEXT_CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u
const UNSAFE_HOST_SUFFIXES = ['.internal', '.lan', '.local', '.localhost', '.home']

export type MailSecurity = 'tls' | 'starttls'
export type MailWebhookEvent = 'incoming' | 'delivery' | 'failure'
export type MailWebhookAuthMode = 'bearer' | 'hmac-sha256'

export interface MailConfigBindings {
  ANEKO_KV: KVNamespace
  MAIL_CONFIG_ENCRYPTION_KEY?: string
  MAIL_CONFIG_KV_KEY?: string
}

interface MailPublicSettings {
  enabled: boolean
  publishAddress: boolean
  displayName: string
  address: string
  description: string
  webmailUrl: string
}

interface MailServiceStatus {
  imap: boolean
  pop3: boolean
  smtp: boolean
  webhook: boolean
}

interface MailProtocolSettings {
  enabled: boolean
  host: string
  port: number
  security: MailSecurity
  username: string
  password: string
}

interface MailWebhookSettings {
  enabled: boolean
  url: string
  events: MailWebhookEvent[]
  authMode: MailWebhookAuthMode
  secret: string
}

interface MailPrivateSettings {
  imap: MailProtocolSettings
  pop3: MailProtocolSettings
  smtp: MailProtocolSettings
  webhook: MailWebhookSettings
}

interface MailConfiguration {
  configured: boolean
  revision: string | null
  updatedAt: string | null
  public: MailPublicSettings
  private: MailPrivateSettings
}

interface EncryptedEnvelope {
  alg: typeof ENCRYPTION_ALGORITHM
  keyId: typeof ENCRYPTION_KEY_ID
  iv: string
  ciphertext: string
}

interface StoredMailConfiguration {
  schemaVersion: typeof STORED_SCHEMA_VERSION
  revision: string
  updatedAt: string
  public: MailPublicSettings
  services: MailServiceStatus
  encrypted: EncryptedEnvelope
}

type JsonRecord = Record<string, unknown>

export class MailConfigValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MailConfigValidationError'
  }
}

export class MailConfigConflictError extends Error {
  constructor() {
    super('邮箱配置已被其他页面修改，请重新载入后再保存')
    this.name = 'MailConfigConflictError'
  }
}

class MailConfigStorageError extends Error {
  constructor() {
    super('Stored mail configuration is invalid or unavailable')
    this.name = 'MailConfigStorageError'
  }
}

function defaultPublicSettings(): MailPublicSettings {
  return {
    enabled: false,
    publishAddress: false,
    displayName: 'Aneko Mail',
    address: '',
    description: '邮件连接与自动通知',
    webmailUrl: '',
  }
}

function defaultProtocolSettings(port: number): MailProtocolSettings {
  return {
    enabled: false,
    host: '',
    port,
    security: 'tls',
    username: '',
    password: '',
  }
}

function defaultPrivateSettings(): MailPrivateSettings {
  return {
    imap: defaultProtocolSettings(993),
    pop3: defaultProtocolSettings(995),
    smtp: defaultProtocolSettings(465),
    webhook: {
      enabled: false,
      url: '',
      events: [],
      authMode: 'hmac-sha256',
      secret: '',
    },
  }
}

function defaultConfiguration(): MailConfiguration {
  return {
    configured: false,
    revision: null,
    updatedAt: null,
    public: defaultPublicSettings(),
    private: defaultPrivateSettings(),
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

function assertKnownKeys(value: JsonRecord, allowed: readonly string[], field: string) {
  const allowedKeys = new Set(allowed)
  const unexpected = Object.keys(value).find((key) => !allowedKeys.has(key))
  if (unexpected) validationError(`${field}.${unexpected} is not supported`)
}

function booleanField(value: JsonRecord, key: string, field: string) {
  if (typeof value[key] !== 'boolean') validationError(`${field}.${key} must be a boolean`)
  return value[key] as boolean
}

function textField(
  value: JsonRecord,
  key: string,
  field: string,
  options: { maxLength: number; allowEmpty?: boolean; allowNewlines?: boolean },
) {
  const raw = value[key]
  if (typeof raw !== 'string') validationError(`${field}.${key} must be a string`)

  const text = raw.trim()
  if (!options.allowEmpty && !text) validationError(`${field}.${key} is required`)
  if (text.length > options.maxLength) {
    validationError(`${field}.${key} must be at most ${options.maxLength} characters`)
  }
  const invalidControlCharacter = options.allowNewlines
    ? NON_TEXT_CONTROL_CHARACTER_PATTERN.test(text)
    : CONTROL_CHARACTER_PATTERN.test(text)
  if (invalidControlCharacter) {
    validationError(`${field}.${key} contains invalid control characters`)
  }
  return text
}

function integerField(value: JsonRecord, key: string, field: string) {
  const port = value[key]
  if (!Number.isInteger(port) || Number(port) < 1 || Number(port) > 65_535) {
    validationError(`${field}.${key} must be an integer between 1 and 65535`)
  }
  return Number(port)
}

function normalizeHostname(raw: string, field: string) {
  if (!raw) return ''

  const hostname = raw.toLowerCase()
  if (!HOSTNAME_PATTERN.test(hostname)
    || IPV4_LITERAL_PATTERN.test(hostname)
    || hostname === 'localhost'
    || UNSAFE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    validationError(`${field} must be a public DNS hostname`)
  }
  return hostname
}

function normalizeHttpsUrl(
  raw: string,
  field: string,
  options: { allowQueryAndFragment?: boolean } = {},
) {
  if (!raw) return ''

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    validationError(`${field} must be a valid HTTPS URL`)
  }

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    validationError(`${field} must be an HTTPS URL without embedded credentials`)
  }
  if (!options.allowQueryAndFragment && (parsed.search || parsed.hash)) {
    validationError(`${field} must not contain a query string or fragment`)
  }

  const hostname = parsed.hostname.toLowerCase()
  if (!HOSTNAME_PATTERN.test(hostname)
    || IPV4_LITERAL_PATTERN.test(hostname)
    || hostname === 'localhost'
    || UNSAFE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    validationError(`${field} must use a public DNS hostname`)
  }

  return parsed.href
}

function normalizePublicSettings(value: unknown): MailPublicSettings {
  const input = asRecord(value, 'public')
  assertKnownKeys(
    input,
    ['enabled', 'publishAddress', 'displayName', 'address', 'description', 'webmailUrl'],
    'public',
  )

  const enabled = booleanField(input, 'enabled', 'public')
  const publishAddress = booleanField(input, 'publishAddress', 'public')
  const displayName = textField(input, 'displayName', 'public', { maxLength: 80 })
  const address = textField(input, 'address', 'public', { maxLength: 254, allowEmpty: true })
  const description = textField(input, 'description', 'public', {
    maxLength: 500,
    allowEmpty: true,
    allowNewlines: true,
  })
  const rawWebmailUrl = textField(input, 'webmailUrl', 'public', {
    maxLength: 2048,
    allowEmpty: true,
  })

  if (address && !EMAIL_PATTERN.test(address)) validationError('public.address must be a valid email address')
  if (publishAddress && !address) validationError('public.address is required when publishAddress is enabled')

  return {
    enabled,
    publishAddress,
    displayName,
    address,
    description,
    webmailUrl: normalizeHttpsUrl(rawWebmailUrl, 'public.webmailUrl'),
  }
}

function secretField(
  input: JsonRecord,
  key: string,
  field: string,
  existing: string,
  requireProperty: boolean,
) {
  if (!(key in input)) {
    if (requireProperty) validationError(`${field}.${key} is required`)
    return existing
  }

  const secret = input[key]
  if (secret === null) return ''
  if (typeof secret !== 'string') validationError(`${field}.${key} must be a string or null`)
  if (!secret.length) {
    if (requireProperty) return ''
    validationError(`${field}.${key} cannot be empty; use null to clear it`)
  }
  if (secret.length > MAX_SECRET_LENGTH) {
    validationError(`${field}.${key} must be at most ${MAX_SECRET_LENGTH} characters`)
  }
  return secret
}

function normalizeProtocolSettings(
  value: unknown,
  field: 'imap' | 'pop3' | 'smtp',
  existing: MailProtocolSettings,
  requirePasswordProperty = false,
): MailProtocolSettings {
  const input = asRecord(value, field)
  assertKnownKeys(input, ['enabled', 'host', 'port', 'security', 'username', 'password'], field)

  const enabled = booleanField(input, 'enabled', field)
  const host = normalizeHostname(
    textField(input, 'host', field, { maxLength: 253, allowEmpty: true }),
    `${field}.host`,
  )
  const port = integerField(input, 'port', field)
  const security = input.security
  if (security !== 'tls' && security !== 'starttls') {
    validationError(`${field}.security must be tls or starttls`)
  }
  if (field === 'smtp' && port === 25) validationError('smtp.port 25 is not supported by Cloudflare Workers')

  const username = textField(input, 'username', field, { maxLength: 320, allowEmpty: true })
  const password = secretField(input, 'password', field, existing.password, requirePasswordProperty)

  if (enabled) {
    if (!host) validationError(`${field}.host is required when enabled`)
    if (!username) validationError(`${field}.username is required when enabled`)
    if (!password) validationError(`${field}.password is required when enabled`)
  }

  return { enabled, host, port, security, username, password }
}

function normalizeWebhookSettings(
  value: unknown,
  existing: MailWebhookSettings,
  requireSecretProperty = false,
): MailWebhookSettings {
  const field = 'webhook'
  const input = asRecord(value, field)
  assertKnownKeys(input, ['enabled', 'url', 'events', 'authMode', 'secret'], field)

  const enabled = booleanField(input, 'enabled', field)
  const rawUrl = textField(input, 'url', field, { maxLength: 2048, allowEmpty: true })
  const url = normalizeHttpsUrl(rawUrl, 'webhook.url', { allowQueryAndFragment: true })
  if (!Array.isArray(input.events)) validationError('webhook.events must be an array')

  const allowedEvents = new Set<MailWebhookEvent>(['incoming', 'delivery', 'failure'])
  const events: MailWebhookEvent[] = []
  for (const event of input.events) {
    if (typeof event !== 'string' || !allowedEvents.has(event as MailWebhookEvent)) {
      validationError('webhook.events contains an unsupported event')
    }
    if (events.includes(event as MailWebhookEvent)) {
      validationError('webhook.events cannot contain duplicates')
    }
    events.push(event as MailWebhookEvent)
  }

  const authMode = input.authMode
  if (authMode !== 'bearer' && authMode !== 'hmac-sha256') {
    validationError('webhook.authMode must be bearer or hmac-sha256')
  }
  const secret = secretField(input, 'secret', field, existing.secret, requireSecretProperty)

  if (enabled) {
    if (!url) validationError('webhook.url is required when enabled')
    if (!events.length) validationError('webhook.events must contain at least one event when enabled')
    if (!secret) validationError('webhook.secret is required when enabled')
  }

  return { enabled, url, events, authMode, secret }
}

function normalizePrivateSettings(
  value: unknown,
  existing: MailPrivateSettings,
  requireSecretProperties = false,
): MailPrivateSettings {
  const input = asRecord(value, 'configuration')
  assertKnownKeys(input, ['imap', 'pop3', 'smtp', 'webhook'], 'configuration')

  return {
    imap: normalizeProtocolSettings(input.imap, 'imap', existing.imap, requireSecretProperties),
    pop3: normalizeProtocolSettings(input.pop3, 'pop3', existing.pop3, requireSecretProperties),
    smtp: normalizeProtocolSettings(input.smtp, 'smtp', existing.smtp, requireSecretProperties),
    webhook: normalizeWebhookSettings(input.webhook, existing.webhook, requireSecretProperties),
  }
}

function normalizeInput(value: unknown, existing: MailConfiguration) {
  const input = asRecord(value, 'body')
  assertKnownKeys(input, ['revision', 'public', 'imap', 'pop3', 'smtp', 'webhook'], 'body')

  if (!('revision' in input)) validationError('body.revision is required')
  const expectedRevision = input.revision
  if (expectedRevision !== null
    && (typeof expectedRevision !== 'string' || !UUID_PATTERN.test(expectedRevision))) {
    validationError('body.revision must be a valid revision or null')
  }

  return {
    expectedRevision,
    public: normalizePublicSettings(input.public),
    private: normalizePrivateSettings({
      imap: input.imap,
      pop3: input.pop3,
      smtp: input.smtp,
      webhook: input.webhook,
    }, existing.private),
  }
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64(value: string) {
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) throw new Error('Invalid base64')
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function decodeEncryptionKey(secretValue?: string) {
  const secret = secretValue?.trim() || ''
  if (!secret) throw new Error('Mail configuration encryption key is not configured')

  if (/^[0-9a-f]{64}$/i.test(secret)) {
    return Uint8Array.from(secret.match(/.{2}/g) || [], (byte) => Number.parseInt(byte, 16))
  }

  try {
    const decoded = decodeBase64(secret)
    if (decoded.byteLength === 32) return decoded
  } catch {
    // A raw 32-byte secret is also accepted for dashboard-managed keys.
  }

  const raw = encoder.encode(secret)
  if (raw.byteLength === 32) return raw
  throw new Error('Mail configuration encryption key must contain 32 bytes')
}

async function importEncryptionKey(secretValue?: string) {
  return crypto.subtle.importKey(
    'raw',
    decodeEncryptionKey(secretValue),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptPrivateSettings(
  settings: MailPrivateSettings,
  secretValue?: string,
): Promise<EncryptedEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES))
  const key = await importEncryptionKey(secretValue)
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: MAIL_CONFIG_AAD,
      tagLength: 128,
    },
    key,
    encoder.encode(JSON.stringify(settings)),
  )

  return {
    alg: ENCRYPTION_ALGORITHM,
    keyId: ENCRYPTION_KEY_ID,
    iv: encodeBase64Url(iv),
    ciphertext: encodeBase64Url(new Uint8Array(ciphertext)),
  }
}

async function decryptPrivateSettings(
  envelope: EncryptedEnvelope,
  secretValue?: string,
): Promise<MailPrivateSettings> {
  const iv = decodeBase64(envelope.iv)
  const ciphertext = decodeBase64(envelope.ciphertext)
  if (iv.byteLength !== AES_GCM_IV_BYTES || ciphertext.byteLength < 16) {
    throw new Error('Invalid encrypted envelope')
  }

  const key = await importEncryptionKey(secretValue)
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: MAIL_CONFIG_AAD,
      tagLength: 128,
    },
    key,
    ciphertext,
  )
  const parsed = JSON.parse(decoder.decode(plaintext))
  return normalizePrivateSettings(parsed, defaultPrivateSettings(), true)
}

function parseStoredConfiguration(value: unknown): StoredMailConfiguration {
  const stored = asRecord(value, 'stored configuration')
  assertKnownKeys(
    stored,
    ['schemaVersion', 'revision', 'updatedAt', 'public', 'services', 'encrypted'],
    'stored configuration',
  )
  if (stored.schemaVersion !== STORED_SCHEMA_VERSION) throw new Error('Unsupported schema version')
  if (typeof stored.revision !== 'string' || !UUID_PATTERN.test(stored.revision)) {
    throw new Error('Invalid revision')
  }
  if (typeof stored.updatedAt !== 'string' || Number.isNaN(Date.parse(stored.updatedAt))) {
    throw new Error('Invalid updatedAt')
  }

  const services = asRecord(stored.services, 'stored configuration.services')
  assertKnownKeys(services, ['imap', 'pop3', 'smtp', 'webhook'], 'stored configuration.services')
  if (typeof services.imap !== 'boolean'
    || typeof services.pop3 !== 'boolean'
    || typeof services.smtp !== 'boolean'
    || typeof services.webhook !== 'boolean') {
    throw new Error('Invalid service status')
  }

  const encrypted = asRecord(stored.encrypted, 'stored configuration.encrypted')
  assertKnownKeys(encrypted, ['alg', 'keyId', 'iv', 'ciphertext'], 'stored configuration.encrypted')
  if (encrypted.alg !== ENCRYPTION_ALGORITHM || encrypted.keyId !== ENCRYPTION_KEY_ID) {
    throw new Error('Unsupported encryption envelope')
  }
  if (typeof encrypted.iv !== 'string' || typeof encrypted.ciphertext !== 'string') {
    throw new Error('Invalid encryption envelope')
  }

  return {
    schemaVersion: STORED_SCHEMA_VERSION,
    revision: stored.revision,
    updatedAt: stored.updatedAt,
    public: normalizePublicSettings(stored.public),
    services: {
      imap: services.imap,
      pop3: services.pop3,
      smtp: services.smtp,
      webhook: services.webhook,
    },
    encrypted: {
      alg: ENCRYPTION_ALGORITHM,
      keyId: ENCRYPTION_KEY_ID,
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext,
    },
  }
}

function serviceStatus(settings: MailPrivateSettings): MailServiceStatus {
  return {
    imap: settings.imap.enabled,
    pop3: settings.pop3.enabled,
    smtp: settings.smtp.enabled,
    webhook: settings.webhook.enabled,
  }
}

function getKvKey(bindings: MailConfigBindings) {
  return getMailConfigKey(bindings)
}

export async function readMailConfiguration(
  bindings: MailConfigBindings,
): Promise<MailConfiguration> {
  const raw = await bindings.ANEKO_KV.get(getKvKey(bindings))
  if (!raw) return defaultConfiguration()

  try {
    const stored = parseStoredConfiguration(JSON.parse(raw))
    const privateSettings = await decryptPrivateSettings(
      stored.encrypted,
      bindings.MAIL_CONFIG_ENCRYPTION_KEY,
    )
    return {
      configured: true,
      revision: stored.revision,
      updatedAt: stored.updatedAt,
      public: stored.public,
      private: privateSettings,
    }
  } catch {
    throw new MailConfigStorageError()
  }
}

export async function saveMailConfiguration(bindings: MailConfigBindings, value: unknown) {
  const existing = await readMailConfiguration(bindings)
  const normalized = normalizeInput(value, existing)
  if (normalized.expectedRevision !== existing.revision) throw new MailConfigConflictError()
  const revision = crypto.randomUUID()
  const updatedAt = new Date().toISOString()
  const encrypted = await encryptPrivateSettings(
    normalized.private,
    bindings.MAIL_CONFIG_ENCRYPTION_KEY,
  )
  const stored: StoredMailConfiguration = {
    schemaVersion: STORED_SCHEMA_VERSION,
    revision,
    updatedAt,
    public: normalized.public,
    services: serviceStatus(normalized.private),
    encrypted,
  }

  await bindings.ANEKO_KV.put(getKvKey(bindings), JSON.stringify(stored))
  return {
    configured: true,
    revision,
    updatedAt,
    public: normalized.public,
    private: normalized.private,
  } satisfies MailConfiguration
}

function projectPublicConfiguration(
  configured: boolean,
  revision: string | null,
  updatedAt: string | null,
  settings: MailPublicSettings,
  services: MailServiceStatus,
) {
  const isPublic = settings.enabled
  const publicSettings = isPublic
    ? settings
    : {
        ...defaultPublicSettings(),
        enabled: false,
        publishAddress: false,
        address: '',
        description: '',
        webmailUrl: '',
      }

  return {
    configured,
    revision,
    updatedAt,
    public: {
      ...publicSettings,
      address: isPublic && publicSettings.publishAddress ? publicSettings.address : '',
      webmailUrl: isPublic ? publicSettings.webmailUrl : '',
    },
    imap: { enabled: isPublic && services.imap },
    pop3: { enabled: isPublic && services.pop3 },
    smtp: { enabled: isPublic && services.smtp },
    webhook: { enabled: isPublic && services.webhook },
  }
}

export async function readPublicMailConfiguration(bindings: MailConfigBindings) {
  const raw = await bindings.ANEKO_KV.get(getKvKey(bindings))
  if (!raw) {
    const configuration = defaultConfiguration()
    return projectPublicConfiguration(
      false,
      null,
      null,
      configuration.public,
      serviceStatus(configuration.private),
    )
  }

  try {
    const stored = parseStoredConfiguration(JSON.parse(raw))
    return projectPublicConfiguration(
      true,
      stored.revision,
      stored.updatedAt,
      stored.public,
      stored.services,
    )
  } catch {
    throw new MailConfigStorageError()
  }
}

function protocolAdminView(settings: MailProtocolSettings) {
  return {
    enabled: settings.enabled,
    host: settings.host,
    port: settings.port,
    security: settings.security,
    username: settings.username,
    passwordConfigured: Boolean(settings.password),
  }
}

export function adminMailConfiguration(configuration: MailConfiguration) {
  return {
    configured: configuration.configured,
    revision: configuration.revision,
    updatedAt: configuration.updatedAt,
    public: configuration.public,
    imap: protocolAdminView(configuration.private.imap),
    pop3: protocolAdminView(configuration.private.pop3),
    smtp: protocolAdminView(configuration.private.smtp),
    webhook: {
      enabled: configuration.private.webhook.enabled,
      url: configuration.private.webhook.url,
      events: configuration.private.webhook.events,
      authMode: configuration.private.webhook.authMode,
      secretConfigured: Boolean(configuration.private.webhook.secret),
    },
  }
}
