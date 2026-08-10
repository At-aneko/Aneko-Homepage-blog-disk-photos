import type { APIRoute } from 'astro'
import { errorResponse } from '../../../utils/http'

export const prerender = false

const MEBIBYTE = 1024 * 1024
const CHUNK_SIZE = 4 * MEBIBYTE
const TEST_DURATION_SECONDS = 60

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
  const requestedDuration = Number(url.searchParams.get('duration') || TEST_DURATION_SECONDS)
  if (requestedDuration !== TEST_DURATION_SECONDS) return errorResponse('Invalid speed test duration')

  let closed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller
    },
    pull(controller) {
      if (closed) return
      controller.enqueue(payloadChunk)
    },
    cancel() {
      closed = true
      if (timer) clearTimeout(timer)
    },
  })
  timer = setTimeout(() => {
    closed = true
    try {
      streamController?.close()
    } catch {
      // The client normally closes the stream first.
    }
  }, TEST_DURATION_SECONDS * 1000)

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-store, no-transform',
      'Content-Disposition': 'attachment; filename="aneko-speed-test-60s.bin"',
      'Content-Encoding': 'identity',
      'Content-Type': 'application/octet-stream',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Speed-Test-Seconds': String(TEST_DURATION_SECONDS),
    },
  })
}
