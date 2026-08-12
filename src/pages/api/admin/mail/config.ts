import type { APIRoute } from 'astro'
import { verifyAdminRequest } from '../../../../utils/auth'
import { getBindings } from '../../../../utils/cloudflare'
import { errorResponse, successResponse } from '../../../../utils/http'
import {
  adminMailConfiguration,
  MAIL_CONFIG_MAX_BODY_BYTES,
  MailConfigConflictError,
  MailConfigValidationError,
  readMailConfiguration,
  saveMailConfiguration,
} from '../../../../utils/mail-config'

export const prerender = false

function isJsonRequest(request: Request) {
  return request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() === 'application/json'
}

function declaredBodyTooLarge(request: Request) {
  const header = request.headers.get('Content-Length')
  if (!header) return false
  if (!/^\d+$/.test(header.trim())) return true
  return Number(header) > MAIL_CONFIG_MAX_BODY_BYTES
}

async function readLimitedJson(request: Request) {
  if (!request.body) throw new SyntaxError('Request body is empty')

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > MAIL_CONFIG_MAX_BODY_BYTES) {
      try {
        await reader.cancel()
      } finally {
        throw new RangeError('Request body is too large')
      }
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  const body = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  if (!body.trim()) throw new SyntaxError('Request body is empty')
  return JSON.parse(body) as unknown
}

export const GET: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const configuration = await readMailConfiguration(bindings)
    return successResponse(adminMailConfiguration(configuration))
  } catch {
    return errorResponse('Mail configuration is unavailable', 500)
  }
}

export const PUT: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) {
    return errorResponse('Unauthorized', 401)
  }
  if (!isJsonRequest(request)) {
    return errorResponse('Content-Type must be application/json', 415)
  }
  if (declaredBodyTooLarge(request)) {
    return errorResponse('Request body is too large', 413)
  }

  let input: unknown
  try {
    input = await readLimitedJson(request)
  } catch (error) {
    return error instanceof RangeError
      ? errorResponse('Request body is too large', 413)
      : errorResponse('Invalid JSON body')
  }

  try {
    const configuration = await saveMailConfiguration(bindings, input)
    return successResponse(adminMailConfiguration(configuration))
  } catch (error) {
    if (error instanceof MailConfigConflictError) return errorResponse(error.message, 409)
    if (error instanceof MailConfigValidationError) return errorResponse(error.message)
    return errorResponse('Unable to save mail configuration', 500)
  }
}
