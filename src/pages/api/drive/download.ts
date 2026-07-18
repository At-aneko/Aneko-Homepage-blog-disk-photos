import type { APIRoute } from 'astro'
import { getBindings, getDrivePrefix } from '../../../utils/cloudflare'
import { errorResponse, r2ObjectResponse } from '../../../utils/http'
import { normalizeObjectPath } from '../../../utils/r2'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const relativeKey = normalizeObjectPath(url.searchParams.get('key') || '')
    const object = await getBindings().ANEKO_R2.get(`${getDrivePrefix(getBindings())}${relativeKey}`)
    if (!object) return errorResponse('File not found', 404)

    return r2ObjectResponse(object, {
      cacheControl: 'private, max-age=60',
      downloadName: url.searchParams.has('download') ? relativeKey.split('/').at(-1) : undefined,
    })
  } catch {
    return errorResponse('Invalid file path')
  }
}
