import type { APIRoute } from 'astro'
import { errorResponse } from '../../../utils/http'

export const prerender = false

const MEBIBYTE = 1024 * 1024
const CHUNK_SIZE = 4 * MEBIBYTE
const MAX_SEGMENT_BYTES = 64 * MEBIBYTE
const SPEED_TEST_SIZES = new Map([
  ['100m', 100 * MEBIBYTE],
  ['500m', 500 * MEBIBYTE],
  ['1g', 1024 * MEBIBYTE],
  ['5g', 5 * 1024 * MEBIBYTE],
  ['10g', 10 * 1024 * MEBIBYTE],
])

function createPayloadChunk() {
  const chunk = new Uint8Array(CHUNK_SIZE)
  let state = 0x6d2b79f5

  for (let index = 0; index < chunk.length; index += 1) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    chunk[index] = state & 0xff
  }

  return chunk
}

const payloadChunk = createPayloadChunk()

export const GET: APIRoute = async ({ request }) => {
  const fetchSite = request.headers.get('Sec-Fetch-Site')
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return errorResponse('Cross-site speed tests are not allowed', 403)
  }

  const url = new URL(request.url)
  const sizeKey = (url.searchParams.get('size') || '').toLowerCase()
  const totalBytes = SPEED_TEST_SIZES.get(sizeKey)
  if (!totalBytes) return errorResponse('Invalid speed test size')

  const offsetValue = url.searchParams.get('offset')
  const lengthValue = url.searchParams.get('length')
  const offset = offsetValue === null ? 0 : Number(offsetValue)
  const requestedLength = lengthValue === null ? totalBytes - offset : Number(lengthValue)
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(requestedLength) || offset < 0 || requestedLength <= 0 || offset >= totalBytes) {
    return errorResponse('Invalid speed test segment')
  }

  const responseBytes = lengthValue === null
    ? totalBytes - offset
    : Math.min(requestedLength, MAX_SEGMENT_BYTES, totalBytes - offset)
  let sentBytes = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sentBytes >= responseBytes) {
        controller.close()
        return
      }

      const nextSize = Math.min(payloadChunk.byteLength, responseBytes - sentBytes)
      controller.enqueue(nextSize === payloadChunk.byteLength ? payloadChunk : payloadChunk.subarray(0, nextSize))
      sentBytes += nextSize
    },
  })

  return new Response(stream, {
    status: lengthValue === null ? 200 : 206,
    headers: {
      'Cache-Control': 'no-store, no-transform',
      'Content-Disposition': `attachment; filename="aneko-speed-test-${sizeKey}.bin"`,
      'Content-Encoding': 'identity',
      'Content-Length': String(responseBytes),
      'Content-Type': 'application/octet-stream',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${offset}-${offset + responseBytes - 1}/${totalBytes}`,
      'X-Content-Type-Options': 'nosniff',
      'X-Speed-Test-Bytes': String(responseBytes),
      'X-Speed-Test-Offset': String(offset),
      'X-Speed-Test-Total-Bytes': String(totalBytes),
    },
  })
}
