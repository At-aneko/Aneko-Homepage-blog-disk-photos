<template>
  <section class="photoGallery" aria-labelledby="photo-gallery-title">
    <header class="photoGalleryMeta">
      <div>
        <p>FRAME INDEX</p>
        <h2 id="photo-gallery-title">全部照片</h2>
      </div>
      <div class="photoGalleryStatus">
        <span>{{ String(photos.length).padStart(2, '0') }} FRAMES</span>
        <button type="button" title="刷新相册" aria-label="刷新相册" :disabled="status === 'loading'" @click="loadPhotos">
          <RefreshCw :size="16" :stroke-width="1.8" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div v-if="status === 'loading'" class="photoSkeletonGrid" aria-label="正在加载相册">
      <span v-for="index in 10" :key="index" :class="`shape-${(index % 4) + 1}`"></span>
    </div>

    <div v-else-if="status === 'error'" class="workspaceState" role="alert">
      <Images :size="30" :stroke-width="1.5" aria-hidden="true" />
      <h3>相册载入失败</h3>
      <p>{{ errorMessage }}</p>
      <button type="button" @click="loadPhotos">重新载入</button>
    </div>

    <div v-else-if="status === 'empty'" class="workspaceState">
      <Images :size="30" :stroke-width="1.5" aria-hidden="true" />
      <h3>暂时没有照片</h3>
      <p>KV 中的照片清单还是空的。</p>
    </div>

    <div v-else class="photoMasonry" aria-label="照片列表">
      <article
        v-for="(photo, index) in photos"
        :key="photo.id"
        class="photoTile"
        :style="{ '--photo-index': index }"
      >
        <button type="button" @click="openPhoto(photo.id)">
          <span class="photoMedia">
            <img
              :src="photo.images[0].src"
              :alt="photo.description || photo.title"
              :loading="index < 6 ? 'eager' : 'lazy'"
              :fetchpriority="index < 3 ? 'high' : 'auto'"
              decoding="async"
              @load="markLoaded(photo.id)"
              @error="markLoaded(photo.id)"
            />
            <span v-if="!loadedPhotos.has(photo.id)" class="photoTileSkeleton"></span>
          </span>
          <span class="photoCaption">
            <span v-if="photo.date" class="photoDate">{{ photo.date }}</span>
            <strong>{{ photo.description || photo.title }}</strong>
          </span>
        </button>
      </article>
    </div>

    <Teleport v-if="isMounted" to="body">
      <Transition name="photo-lightbox">
        <div v-if="activeImage" class="photoLightbox" role="dialog" aria-modal="true" aria-label="照片预览" @click.self="closeLightbox">
          <header class="photoLightboxTop">
            <div>
              <span>{{ activeImage.photo.date || 'ANEKO PHOTOS' }}</span>
              <strong>{{ activeImage.photo.description || activeImage.photo.title }}</strong>
            </div>
            <button type="button" title="关闭" aria-label="关闭照片预览" @click="closeLightbox">
              <X :size="20" :stroke-width="1.8" aria-hidden="true" />
            </button>
          </header>

          <button
            class="photoLightboxNav is-prev"
            type="button"
            title="上一张"
            aria-label="上一张"
            :disabled="activeImageIndex <= 0"
            @click="moveLightbox(-1)"
          >
            <ChevronLeft :size="22" :stroke-width="1.8" aria-hidden="true" />
          </button>

          <figure class="photoLightboxFigure">
            <img :key="activeImage.image.src" :src="activeImage.image.src" :alt="activeImage.photo.description || activeImage.photo.title" />
          </figure>

          <button
            class="photoLightboxNav is-next"
            type="button"
            title="下一张"
            aria-label="下一张"
            :disabled="activeImageIndex >= flatImages.length - 1"
            @click="moveLightbox(1)"
          >
            <ChevronRight :size="22" :stroke-width="1.8" aria-hidden="true" />
          </button>

          <footer class="photoLightboxActions">
            <button type="button" title="复制链接" aria-label="复制照片链接" @click="shareActiveImage">
              <Share2 :size="17" :stroke-width="1.8" aria-hidden="true" />
            </button>
            <a :href="activeImage.image.src" target="_blank" rel="noreferrer" title="查看原图" aria-label="查看原图">
              <ExternalLink :size="17" :stroke-width="1.8" aria-hidden="true" />
            </a>
            <a :href="`${activeImage.image.src}?download`" title="下载原图" aria-label="下载原图">
              <Download :size="17" :stroke-width="1.8" aria-hidden="true" />
            </a>
          </footer>

          <Transition name="photo-toast">
            <div v-if="toastMessage" class="photoToast" role="status">{{ toastMessage }}</div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Images,
  RefreshCw,
  Share2,
  X,
} from '@lucide/vue'

interface RawPhoto {
  id: string
  title?: string
  date?: string
  description?: string
  images?: { img?: string }[]
}

interface GalleryImage {
  path: string
  src: string
}

interface GalleryPhoto {
  id: string
  title: string
  date: string
  description: string
  images: GalleryImage[]
}

type GalleryStatus = 'loading' | 'ready' | 'empty' | 'error'

const status = ref<GalleryStatus>('loading')
const isMounted = ref(false)
const errorMessage = ref('')
const photos = ref<GalleryPhoto[]>([])
const loadedPhotos = ref(new Set<string>())
const activeImageIndex = ref(-1)
const toastMessage = ref('')
let abortController: AbortController | null = null
let toastTimer: number | null = null

const flatImages = computed(() => photos.value.flatMap((photo) => (
  photo.images.map((image) => ({ photo, image }))
)))
const activeImage = computed(() => flatImages.value[activeImageIndex.value] || null)

function encodePath(path: string) {
  return path
    .replaceAll('\\', '/')
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .map(encodeURIComponent)
    .join('/')
}

function normalizePhoto(photo: RawPhoto, index: number): GalleryPhoto | null {
  if (!photo || typeof photo !== 'object') return null

  const images = (Array.isArray(photo.images) ? photo.images : [])
    .map((image) => typeof image?.img === 'string' ? image.img.trim() : '')
    .filter(Boolean)
    .map((path) => ({ path, src: `/api/photos/image/${encodePath(path)}` }))

  if (!images.length) return null

  return {
    id: photo.id || `photo-${index + 1}`,
    title: photo.title || photo.description || `Photo ${index + 1}`,
    date: photo.date || '',
    description: photo.description || photo.title || '',
    images,
  }
}

async function loadPhotos() {
  abortController?.abort()
  abortController = new AbortController()
  status.value = 'loading'
  errorMessage.value = ''

  try {
    const response = await fetch('/api/photos', { signal: abortController.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    if (!Array.isArray(payload)) throw new Error('照片清单格式不正确')

    photos.value = payload
      .map((photo, index) => normalizePhoto(photo as RawPhoto, index))
      .filter((photo): photo is GalleryPhoto => Boolean(photo))
    loadedPhotos.value = new Set()
    status.value = photos.value.length ? 'ready' : 'empty'
  } catch (error) {
    if ((error as Error).name === 'AbortError') return
    status.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : '无法读取照片清单'
  }
}

function markLoaded(photoId: string) {
  const next = new Set(loadedPhotos.value)
  next.add(photoId)
  loadedPhotos.value = next
}

function openPhoto(photoId: string) {
  const nextIndex = flatImages.value.findIndex((entry) => entry.photo.id === photoId)
  if (nextIndex < 0) return
  activeImageIndex.value = nextIndex
  document.documentElement.style.overflow = 'hidden'
}

function closeLightbox() {
  activeImageIndex.value = -1
  document.documentElement.style.removeProperty('overflow')
}

function moveLightbox(direction: -1 | 1) {
  const nextIndex = activeImageIndex.value + direction
  if (nextIndex < 0 || nextIndex >= flatImages.value.length) return
  activeImageIndex.value = nextIndex
}

function showToast(message: string) {
  toastMessage.value = message
  if (toastTimer !== null) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastMessage.value = ''
    toastTimer = null
  }, 1800)
}

async function shareActiveImage() {
  if (!activeImage.value) return

  try {
    await navigator.clipboard.writeText(new URL(activeImage.value.image.src, window.location.href).href)
    showToast('链接已复制')
  } catch {
    showToast('复制失败')
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (!activeImage.value) return
  if (event.key === 'Escape') closeLightbox()
  if (event.key === 'ArrowLeft') moveLightbox(-1)
  if (event.key === 'ArrowRight') moveLightbox(1)
}

onMounted(() => {
  isMounted.value = true
  loadPhotos()
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  abortController?.abort()
  window.removeEventListener('keydown', handleKeydown)
  document.documentElement.style.removeProperty('overflow')
  if (toastTimer !== null) window.clearTimeout(toastTimer)
})
</script>

<style scoped>
.photoGallery {
  width: calc(100% - 14px);
  margin: 0 7px;
  padding: 24px 0 76px;
}

.photoGalleryMeta {
  min-height: 98px;
  padding: 24px 2px 18px;
  border-bottom: 1px solid var(--module_dock_border);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}

.photoGalleryMeta p,
.photoGalleryStatus > span {
  margin: 0;
  font-size: 9px;
  font-weight: 600;
  line-height: 13px;
  opacity: 0.5;
}

.photoGalleryMeta h2 {
  margin: 5px 0 0;
  font-size: 25px;
  font-weight: 600;
  line-height: 32px;
}

.photoGalleryStatus {
  display: flex;
  align-items: center;
  gap: 12px;
}

.photoGalleryStatus button,
.photoLightboxTop button,
.photoLightboxActions button,
.photoLightboxActions a,
.photoLightboxNav {
  width: 38px;
  height: 38px;
  padding: 0;
  border: 1px solid var(--module_dock_border);
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: inherit;
  background: var(--item_bg_color);
  cursor: pointer;
  transition: transform 0.2s ease, background-color 0.2s ease, opacity 0.2s ease;
}

.photoGalleryStatus button:hover,
.photoLightboxTop button:hover,
.photoLightboxActions button:hover,
.photoLightboxActions a:hover,
.photoLightboxNav:hover {
  background: var(--item_hover_color);
  transform: translateY(-1px);
}

.photoGalleryStatus button:active,
.photoLightboxTop button:active,
.photoLightboxActions button:active,
.photoLightboxActions a:active,
.photoLightboxNav:active {
  transform: scale(0.96);
}

.photoGalleryStatus button:disabled,
.photoLightboxNav:disabled {
  opacity: 0.25;
  pointer-events: none;
}

.photoMasonry,
.photoSkeletonGrid {
  padding-top: 14px;
  columns: 4 220px;
  column-gap: 12px;
}

.photoTile,
.photoSkeletonGrid > span {
  width: 100%;
  margin: 0 0 12px;
  break-inside: avoid;
  overflow: hidden;
  border: 1px solid var(--module_dock_border);
  border-radius: 8px;
  display: block;
  background: var(--item_bg_color);
}

.photoTile {
  animation: photoReveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--photo-index) * 45ms);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s ease;
}

.photoTile:hover {
  border-color: var(--module_dock_active_border);
  transform: translateY(-3px);
}

.photoTile button {
  width: 100%;
  padding: 0;
  border: 0;
  display: block;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.photoMedia {
  position: relative;
  display: block;
  overflow: hidden;
  background: var(--module_dock_inactive_bg);
}

.photoMedia img {
  width: 100%;
  height: auto;
  min-height: 120px;
  display: block;
  object-fit: cover;
  transition: filter 0.3s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
  -webkit-user-drag: none;
}

.photoTile:hover img {
  filter: brightness(0.78);
  transform: scale(1.015);
}

.photoTileSkeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, var(--module_dock_inactive_bg) 20%, var(--item_hover_color) 45%, var(--module_dock_inactive_bg) 70%);
  background-size: 220% 100%;
  animation: photoShimmer 1.4s ease-in-out infinite;
}

.photoCaption {
  padding: 13px 14px 14px;
  display: grid;
  gap: 3px;
}

.photoCaption strong {
  display: block;
  overflow: hidden;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photoDate {
  font-size: 8px;
  line-height: 12px;
  opacity: 0.48;
}

.photoSkeletonGrid > span {
  height: 280px;
  background: linear-gradient(100deg, var(--module_dock_inactive_bg) 20%, var(--item_hover_color) 45%, var(--module_dock_inactive_bg) 70%);
  background-size: 220% 100%;
  animation: photoShimmer 1.4s ease-in-out infinite;
}

.photoSkeletonGrid .shape-2 { height: 190px; }
.photoSkeletonGrid .shape-3 { height: 340px; }
.photoSkeletonGrid .shape-4 { height: 230px; }

.workspaceState {
  min-height: 360px;
  border-bottom: 1px solid var(--module_dock_border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.workspaceState h3 {
  margin-top: 14px;
  font-size: 18px;
  line-height: 25px;
}

.workspaceState p {
  max-width: 42ch;
  margin: 6px 0 0;
  font-size: 10px;
  line-height: 17px;
  opacity: 0.54;
}

.workspaceState button {
  min-height: 36px;
  margin-top: 18px;
  padding: 0 14px;
  border: 1px solid var(--module_dock_border);
  border-radius: 6px;
  color: inherit;
  background: var(--item_bg_color);
  font-size: 10px;
  cursor: pointer;
}

.photoLightbox {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 64px;
  grid-template-rows: 72px minmax(0, 1fr) 72px;
  align-items: center;
  color: #f7f7f8;
  background: rgba(18, 19, 22, 0.97);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.photoLightboxTop {
  grid-column: 1 / -1;
  grid-row: 1;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.photoLightboxTop > div {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.photoLightboxTop span {
  font-size: 8px;
  line-height: 12px;
  opacity: 0.48;
}

.photoLightboxTop strong {
  overflow: hidden;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photoLightboxTop button,
.photoLightboxActions button,
.photoLightboxActions a,
.photoLightboxNav {
  border-color: rgba(255, 255, 255, 0.14);
  color: inherit;
  background: rgba(255, 255, 255, 0.06);
}

.photoLightboxNav {
  justify-self: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
}

.photoLightboxNav.is-prev { grid-column: 1; grid-row: 2; }
.photoLightboxNav.is-next { grid-column: 3; grid-row: 2; }

.photoLightboxFigure {
  min-width: 0;
  min-height: 0;
  grid-column: 2;
  grid-row: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photoLightboxFigure img {
  max-width: 100%;
  max-height: calc(100dvh - 176px);
  border-radius: 8px;
  display: block;
  object-fit: contain;
  box-shadow: 0 24px 70px -34px rgba(0, 0, 0, 0.9);
  user-select: none;
  -webkit-user-drag: none;
}

.photoLightboxActions {
  grid-column: 1 / -1;
  grid-row: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.photoToast {
  position: fixed;
  bottom: 86px;
  left: 50%;
  padding: 9px 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  background: rgba(30, 31, 35, 0.92);
  font-size: 10px;
  transform: translateX(-50%);
}

.photo-lightbox-enter-active,
.photo-lightbox-leave-active,
.photo-toast-enter-active,
.photo-toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.photo-lightbox-enter-from,
.photo-lightbox-leave-to { opacity: 0; }
.photo-toast-enter-from,
.photo-toast-leave-to { opacity: 0; transform: translate(-50%, 8px); }

@keyframes photoReveal {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes photoShimmer {
  from { background-position: 120% 0; }
  to { background-position: -120% 0; }
}

@media (max-width: 800px) {
  .photoGallery {
    width: calc(100% - 18px);
    margin: 0 9px;
  }
}

@media (max-width: 640px) {
  .photoMasonry,
  .photoSkeletonGrid {
    columns: 2;
    column-gap: 9px;
  }

  .photoTile,
  .photoSkeletonGrid > span {
    margin-bottom: 9px;
  }

  .photoCaption {
    padding: 10px;
  }

  .photoLightbox {
    grid-template-columns: 48px minmax(0, 1fr) 48px;
  }

  .photoLightboxNav {
    width: 38px;
    height: 38px;
  }
}

@media (max-width: 380px) {
  .photoMasonry,
  .photoSkeletonGrid {
    columns: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .photoTile,
  .photoTileSkeleton,
  .photoSkeletonGrid > span {
    animation: none;
  }

  .photoTile,
  .photoMedia img,
  .photoGalleryStatus button,
  .photoLightboxTop button,
  .photoLightboxActions button,
  .photoLightboxActions a,
  .photoLightboxNav {
    transition: none;
  }
}
</style>
