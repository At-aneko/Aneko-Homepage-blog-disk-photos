const encoder = new TextEncoder()

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}

export async function verifyAccessCode(provided: string | null, expected?: string) {
  if (!provided || !expected) return false

  const [providedHash, expectedHash] = await Promise.all([
    digest(provided),
    digest(expected),
  ])

  if (providedHash.length !== expectedHash.length) return false

  let difference = 0
  for (let index = 0; index < providedHash.length; index += 1) {
    difference |= providedHash[index] ^ expectedHash[index]
  }

  return difference === 0
}
