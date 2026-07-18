/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare" />
/// <reference types="@cloudflare/workers-types" />

interface Env {
  ANEKO_KV: KVNamespace
  ANEKO_R2: R2Bucket
  ASSETS: Fetcher
  ACCESS_CODE?: string
  BLOG_INDEX_KEY?: string
  PHOTO_MANIFEST_KEY?: string
  DRIVE_PREFIX?: string
}
