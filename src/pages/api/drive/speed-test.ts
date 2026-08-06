import type { APIRoute } from 'astro'
import { errorResponse } from '../../../utils/http'

export const prerender = false

const MEBIBYTE = 1024 * 1024
const CHUNK_SIZE = 4 * MEBIBYTE
const RANDOM_BLOCK_SIZE = 64 * 1024
const ALLOWED_SIZES = new Set([100, 250, 500])

function createPayloadChunk() {
  const chunk = new Uint8Array(CHUNK_SIZE)

  for (let offset = 0; offset < chunk.length; offset += RANDOM_BLOCK_SIZE) {
    crypto.getRandomValues(chunk.subarray(offset, Math.min(offset + RANDOM_BLOCK_SIZE, chunk.length)))
  }

  return chunk
}

const payloadChunk = createPayloadChunk()

export const GET: APIRoute = async ({ request }) => {
  const fetchSite = request.headers.get('Sec-Fetch-Site')
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return errorResponse('Cross-site speed tests are not allowed', 403)
  }

  const requestedSize = Number.parseInt(new URL(request.url).searchParams.get('size') || '', 10)
  if (!ALLOWED_SIZES.has(requestedSize)) return errorResponse('Invalid speed test size')

  const totalBytes = requestedSize * MEBIBYTE
  let sentBytes = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sentBytes >= totalBytes) {
        controller.close()
        return
      }

      const nextSize = Math.min(payloadChunk.byteLength, totalBytes - sentBytes)
      controller.enqueue(nextSize === payloadChunk.byteLength ? payloadChunk : payloadChunk.subarray(0, nextSize))
      sentBytes += nextSize
    },
  })

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-store, no-transform',
      'Content-Disposition': `attachment; filename="aneko-speed-test-${requestedSize}mb.bin"`,
      'Content-Encoding': 'identity',
      'Content-Length': String(totalBytes),
      'Content-Type': 'application/octet-stream',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Speed-Test-Bytes': String(totalBytes),
    },
  })
}
