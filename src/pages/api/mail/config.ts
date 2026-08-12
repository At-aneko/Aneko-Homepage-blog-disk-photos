import type { APIRoute } from 'astro'
import { getBindings } from '../../../utils/cloudflare'
import { errorResponse, successResponse } from '../../../utils/http'
import { readPublicMailConfiguration } from '../../../utils/mail-config'

export const prerender = false

export const GET: APIRoute = async () => {
  try {
    return successResponse(await readPublicMailConfiguration(getBindings()))
  } catch {
    return errorResponse('Mail configuration is unavailable', 500)
  }
}
