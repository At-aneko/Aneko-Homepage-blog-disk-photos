import type { APIRoute } from 'astro'
import { verifyAccessCode } from '../../../../utils/auth'
import { getBindings } from '../../../../utils/cloudflare'
import { errorResponse, successResponse } from '../../../../utils/http'
import { getStoredPostIndex } from '../../../../utils/posts'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAccessCode(request.headers.get('X-Access-Code'), bindings.ACCESS_CODE)) {
    return errorResponse('Unauthorized', 401)
  }

  return successResponse(await getStoredPostIndex())
}
