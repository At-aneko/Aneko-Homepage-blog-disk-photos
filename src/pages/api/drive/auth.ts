import type { APIRoute } from 'astro'
import { verifyAccessCode } from '../../../utils/auth'
import { getBindings } from '../../../utils/cloudflare'
import { errorResponse, successResponse } from '../../../utils/http'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  let code = ''
  try {
    const body = await request.json() as { code?: unknown }
    code = typeof body.code === 'string' ? body.code : ''
  } catch {
    return errorResponse('Invalid JSON body')
  }

  const valid = await verifyAccessCode(code, getBindings().ACCESS_CODE)
  return successResponse({ valid })
}
