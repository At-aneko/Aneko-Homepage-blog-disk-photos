import type { APIRoute } from 'astro'
import { verifyAccessCode } from '../../utils/auth'
import { getBindings, getPhotoManifestKey } from '../../utils/cloudflare'
import { errorResponse, jsonResponse, successResponse } from '../../utils/http'

export const prerender = false

interface PhotoManifestItem {
  id: string
  title?: string
  date?: string
  description?: string
  images: { img: string }[]
}

function isManifest(value: unknown): value is PhotoManifestItem[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== 'object') return false
    const photo = item as Partial<PhotoManifestItem>
    return typeof photo.id === 'string'
      && Array.isArray(photo.images)
      && photo.images.every((image) => image && typeof image.img === 'string')
  })
}

export const GET: APIRoute = async () => {
  const bindings = getBindings()
  const raw = await bindings.ANEKO_KV.get(getPhotoManifestKey(bindings))
  if (!raw) return jsonResponse([], 200, 'public, max-age=30')

  try {
    const manifest = JSON.parse(raw)
    return isManifest(manifest)
      ? jsonResponse(manifest, 200, 'public, max-age=30')
      : errorResponse('Invalid photo manifest', 500)
  } catch {
    return errorResponse('Invalid photo manifest', 500)
  }
}

export const PUT: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAccessCode(request.headers.get('X-Access-Code'), bindings.ACCESS_CODE)) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const manifest = await request.json()
    if (!isManifest(manifest)) return errorResponse('Invalid photo manifest')
    await bindings.ANEKO_KV.put(getPhotoManifestKey(bindings), JSON.stringify(manifest))
    return successResponse({ count: manifest.length })
  } catch {
    return errorResponse('Invalid JSON body')
  }
}
