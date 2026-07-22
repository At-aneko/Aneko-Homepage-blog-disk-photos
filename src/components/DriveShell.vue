<template>
  <section
    class="drivePage"
    aria-labelledby="drive-title"
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <header class="driveToolbar">
      <div>
        <p>OBJECT STORAGE</p>
        <h2 id="drive-title">文件目录</h2>
      </div>

      <div class="driveCommands">
        <input ref="fileInput" class="driveFileInput" type="file" multiple @change="handleFileInput" />
        <button type="button" :disabled="!isAuthenticated || isUploading" title="上传文件" @click="openFilePicker">
          <Upload :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>上传</span>
        </button>
        <button type="button" :disabled="!isAuthenticated" title="新建文件夹" @click="openFolderDialog">
          <FolderPlus :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>新建文件夹</span>
        </button>
        <button type="button" :disabled="status === 'loading'" title="刷新" @click="loadFiles">
          <RefreshCw :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>刷新</span>
        </button>
        <button
          type="button"
          class="driveAuthButton"
          :class="{ 'is-authenticated': isAuthenticated }"
          :title="isAuthenticated ? '退出管理员' : '管理员登录'"
          @click="isAuthenticated ? logout() : openAuthDialog()"
        >
          <LogOut v-if="isAuthenticated" :size="15" :stroke-width="1.8" aria-hidden="true" />
          <LogIn v-else :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ isAuthenticated ? '已登录' : '登录' }}</span>
        </button>
      </div>
    </header>

    <nav class="driveBreadcrumb" aria-label="文件路径">
      <button type="button" :class="{ 'is-current': pathParts.length === 0 }" @click="navigateToCrumb(-1)">
        <House :size="14" :stroke-width="1.8" aria-hidden="true" />
        <span>根目录</span>
      </button>
      <template v-for="(part, index) in pathParts" :key="`${part}-${index}`">
        <ChevronRight :size="13" :stroke-width="1.6" aria-hidden="true" />
        <button type="button" :class="{ 'is-current': index === pathParts.length - 1 }" @click="navigateToCrumb(index)">
          {{ part }}
        </button>
      </template>
    </nav>

    <div v-if="operationMessage" class="driveNotice" :class="`is-${operationKind}`" role="status">
      <CircleCheck v-if="operationKind === 'success'" :size="16" :stroke-width="1.8" aria-hidden="true" />
      <CircleAlert v-else :size="16" :stroke-width="1.8" aria-hidden="true" />
      <span>{{ operationMessage }}</span>
    </div>

    <div v-if="status === 'loading'" class="driveSkeleton" aria-label="正在加载文件">
      <span v-for="index in 7" :key="index"></span>
    </div>

    <div v-else-if="status === 'error'" class="driveState" role="alert">
      <CircleAlert :size="30" :stroke-width="1.5" aria-hidden="true" />
      <h3>目录读取失败</h3>
      <p>{{ errorMessage }}</p>
      <button type="button" @click="loadFiles">重新载入</button>
    </div>

    <div v-else-if="files.length === 0" class="driveState">
      <HardDrive :size="30" :stroke-width="1.5" aria-hidden="true" />
      <h3>这个目录是空的</h3>
      <p>{{ isAuthenticated ? '可以上传文件或创建文件夹。' : '管理员登录后可以写入文件。' }}</p>
    </div>

    <div v-else class="driveTableWrap">
      <table class="driveTable">
        <thead>
          <tr>
            <th>名称</th>
            <th class="is-size">大小</th>
            <th class="is-date">修改时间</th>
            <th class="is-actions"><span class="srOnly">操作</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(file, index) in sortedFiles" :key="file.key" :style="{ '--file-index': index }">
            <td>
              <button v-if="file.isFolder" class="driveFileName is-folder" type="button" @click="navigateToFolder(file.key)">
                <component :is="iconFor(file)" :size="18" :stroke-width="1.7" aria-hidden="true" />
                <span>{{ displayName(file) }}</span>
              </button>
              <span v-else class="driveFileName">
                <component :is="iconFor(file)" :size="18" :stroke-width="1.7" aria-hidden="true" />
                <span>{{ displayName(file) }}</span>
              </span>
            </td>
            <td class="is-size">{{ file.isFolder ? '—' : formatFileSize(file.size) }}</td>
            <td class="is-date">{{ file.isFolder ? '—' : formatDate(file.lastModified) }}</td>
            <td class="is-actions">
              <div class="driveRowActions">
                <button v-if="canPreview(file)" type="button" title="预览" aria-label="预览文件" @click="openPreview(file)">
                  <Eye :size="15" :stroke-width="1.8" aria-hidden="true" />
                </button>
                <button v-if="!file.isFolder" type="button" title="下载" aria-label="下载文件" @click="downloadFile(file)">
                  <Download :size="15" :stroke-width="1.8" aria-hidden="true" />
                </button>
                <button v-if="isAuthenticated" class="is-danger" type="button" title="删除" aria-label="删除文件" @click="deleteEntry(file)">
                  <Trash2 :size="15" :stroke-width="1.8" aria-hidden="true" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="isDragging" class="driveDropOverlay" aria-hidden="true">
      <Upload :size="28" :stroke-width="1.5" />
      <span>{{ isAuthenticated ? '释放以上传文件' : '请先登录管理员' }}</span>
    </div>

    <Teleport v-if="isMounted" to="body">
      <Transition name="drive-modal">
        <div v-if="showAuthDialog" class="driveModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="drive-auth-title" @mousedown.self="closeAuthDialog">
          <form class="driveModal driveAuthModal" @submit.prevent="submitAuth">
            <header>
              <div>
                <p>ADMIN ACCESS</p>
                <h3 id="drive-auth-title">管理员登录</h3>
              </div>
              <button type="button" title="关闭" aria-label="关闭" @click="closeAuthDialog">
                <X :size="18" :stroke-width="1.8" aria-hidden="true" />
              </button>
            </header>
            <label for="drive-access-code">访问码</label>
            <div class="driveInputWrap">
              <LockKeyhole :size="17" :stroke-width="1.7" aria-hidden="true" />
              <input id="drive-access-code" v-model="authCodeInput" type="password" autocomplete="current-password" required />
            </div>
            <p v-if="authError" class="driveFormError">{{ authError }}</p>
            <button class="drivePrimaryButton" type="submit" :disabled="authSubmitting">
              {{ authSubmitting ? '验证中' : '登录' }}
            </button>
          </form>
        </div>
      </Transition>

      <Transition name="drive-modal">
        <div v-if="showFolderDialog" class="driveModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="drive-folder-title" @mousedown.self="closeFolderDialog">
          <form class="driveModal driveFolderModal" @submit.prevent="createFolder">
            <header>
              <div>
                <p>NEW DIRECTORY</p>
                <h3 id="drive-folder-title">新建文件夹</h3>
              </div>
              <button type="button" title="关闭" aria-label="关闭" @click="closeFolderDialog">
                <X :size="18" :stroke-width="1.8" aria-hidden="true" />
              </button>
            </header>
            <label for="drive-folder-name">文件夹名称</label>
            <div class="driveInputWrap">
              <FolderPlus :size="17" :stroke-width="1.7" aria-hidden="true" />
              <input id="drive-folder-name" v-model.trim="folderName" type="text" autocomplete="off" required />
            </div>
            <p v-if="folderError" class="driveFormError">{{ folderError }}</p>
            <button class="drivePrimaryButton" type="submit" :disabled="folderSubmitting">
              {{ folderSubmitting ? '创建中' : '创建' }}
            </button>
          </form>
        </div>
      </Transition>

      <Transition name="drive-modal">
        <div v-if="previewFile" class="driveModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="drive-preview-title" @mousedown.self="closePreview">
          <section class="driveModal drivePreviewModal">
            <header>
              <div>
                <p>FILE PREVIEW</p>
                <h3 id="drive-preview-title">{{ displayName(previewFile) }}</h3>
              </div>
              <button type="button" title="关闭" aria-label="关闭" @click="closePreview">
                <X :size="18" :stroke-width="1.8" aria-hidden="true" />
              </button>
            </header>
            <div class="drivePreviewBody">
              <div v-if="previewLoading" class="drivePreviewLoading"><span></span></div>
              <p v-else-if="previewError" class="driveFormError">{{ previewError }}</p>
              <img v-else-if="previewKind === 'image'" :src="previewUrl" :alt="displayName(previewFile)" />
              <video v-else-if="previewKind === 'video'" :src="previewUrl" controls></video>
              <audio v-else-if="previewKind === 'audio'" :src="previewUrl" controls></audio>
              <iframe v-else-if="previewKind === 'pdf'" :src="previewUrl" :title="displayName(previewFile)"></iframe>
              <pre v-else-if="previewKind === 'text'">{{ previewText }}</pre>
              <p v-else>该文件类型不支持在线预览。</p>
            </div>
            <footer>
              <button type="button" @click="downloadFile(previewFile)">
                <Download :size="15" :stroke-width="1.8" aria-hidden="true" />
                <span>下载</span>
              </button>
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue'
import {
  Archive,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Download,
  Eye,
  File as FileIcon,
  FileText,
  Film,
  Folder,
  FolderPlus,
  HardDrive,
  House,
  Image as ImageIcon,
  LockKeyhole,
  LogIn,
  LogOut,
  Music,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from '@lucide/vue'
import {
  apiRequest,
  clearAdminAccess,
  restoreAdminAccess,
  storeAdminAccess,
  verifyAdminAccess,
} from '../utils/admin-client'

interface DriveFile {
  key: string
  size: number
  lastModified: string
  isFolder: boolean
  etag?: string
}

type DriveStatus = 'loading' | 'ready' | 'error'
type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'unknown'

const files = ref<DriveFile[]>([])
const isMounted = ref(false)
const prefix = ref('')
const status = ref<DriveStatus>('loading')
const errorMessage = ref('')
const accessCode = ref('')
const isAuthenticated = ref(false)
const isUploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const showAuthDialog = ref(false)
const authCodeInput = ref('')
const authError = ref('')
const authSubmitting = ref(false)
const showFolderDialog = ref(false)
const folderName = ref('')
const folderError = ref('')
const folderSubmitting = ref(false)
const operationMessage = ref('')
const operationKind = ref<'success' | 'error'>('success')
const isDragging = ref(false)
const dragDepth = ref(0)
const previewFile = ref<DriveFile | null>(null)
const previewKind = ref<PreviewKind>('unknown')
const previewUrl = ref('')
const previewText = ref('')
const previewLoading = ref(false)
const previewError = ref('')
let listController: AbortController | null = null
let previewController: AbortController | null = null
let noticeTimer: number | null = null

const pathParts = computed(() => prefix.value.split('/').filter(Boolean))
const sortedFiles = computed(() => [...files.value].sort((a, b) => {
  if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
  return displayName(a).localeCompare(displayName(b), 'zh-CN')
}))

async function loadFiles() {
  listController?.abort()
  listController = new AbortController()
  status.value = 'loading'
  errorMessage.value = ''

  try {
    const collected: DriveFile[] = []
    let cursor = ''

    do {
      const query = new URLSearchParams({ prefix: prefix.value })
      if (cursor) query.set('cursor', cursor)
      const result = await apiRequest<{ files: DriveFile[]; truncated: boolean; cursor?: string }>(
        `/api/drive/files?${query}`,
        { signal: listController.signal },
      )
      collected.push(...result.files)
      cursor = result.truncated && result.cursor ? result.cursor : ''
    } while (cursor)

    files.value = collected
    status.value = 'ready'
  } catch (error) {
    if ((error as Error).name === 'AbortError') return
    status.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : '无法读取目录'
  }
}

function displayName(file: DriveFile) {
  const withoutPrefix = file.key.startsWith(prefix.value) ? file.key.slice(prefix.value.length) : file.key
  return withoutPrefix.replace(/\/$/, '') || file.key.replace(/\/$/, '')
}

function navigateToFolder(folder: string) {
  prefix.value = folder.endsWith('/') ? folder : `${folder}/`
  loadFiles()
}

function navigateToCrumb(index: number) {
  prefix.value = index < 0 ? '' : `${pathParts.value.slice(0, index + 1).join('/')}/`
  loadFiles()
}

function extension(file: DriveFile) {
  const name = file.key.split('/').pop() || ''
  return name.includes('.') ? name.split('.').pop()?.toLocaleLowerCase() || '' : ''
}

function kindFor(file: DriveFile): PreviewKind {
  const ext = extension(file)
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico'].includes(ext)) return 'image'
  if (['mp4', 'webm', 'mov', 'm4v'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'audio'
  if (ext === 'pdf') return 'pdf'
  if (['txt', 'md', 'json', 'yaml', 'yml', 'xml', 'csv', 'log', 'js', 'ts', 'jsx', 'tsx', 'vue', 'css', 'html', 'py', 'sh', 'sql'].includes(ext)) return 'text'
  return 'unknown'
}

function iconFor(file: DriveFile): Component {
  if (file.isFolder) return Folder
  const kind = kindFor(file)
  if (kind === 'image') return ImageIcon
  if (kind === 'video') return Film
  if (kind === 'audio') return Music
  if (kind === 'text' || kind === 'pdf') return FileText
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension(file))) return Archive
  return FileIcon
}

function canPreview(file: DriveFile) {
  if (file.isFolder) return false
  const kind = kindFor(file)
  return kind !== 'unknown' && (kind !== 'text' || file.size <= 2 * 1024 * 1024)
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / (1024 ** unitIndex)
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function showNotice(message: string, kind: 'success' | 'error' = 'success') {
  operationMessage.value = message
  operationKind.value = kind
  if (noticeTimer !== null) window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => {
    operationMessage.value = ''
    noticeTimer = null
  }, 2400)
}

function openAuthDialog() {
  authCodeInput.value = ''
  authError.value = ''
  showAuthDialog.value = true
}

function closeAuthDialog() {
  if (!authSubmitting.value) showAuthDialog.value = false
}

async function submitAuth() {
  authSubmitting.value = true
  authError.value = ''
  try {
    if (!await verifyAdminAccess(authCodeInput.value)) throw new Error('访问码不正确')
    accessCode.value = authCodeInput.value
    isAuthenticated.value = true
    storeAdminAccess(accessCode.value)
    showAuthDialog.value = false
    showNotice('管理员登录成功')
  } catch (error) {
    authError.value = error instanceof Error ? error.message : '登录失败'
  } finally {
    authSubmitting.value = false
  }
}

function logout() {
  accessCode.value = ''
  isAuthenticated.value = false
  clearAdminAccess()
  showNotice('已退出管理员')
}

function openFilePicker() {
  if (!isAuthenticated.value || isUploading.value) return
  fileInput.value?.click()
}

async function uploadFiles(nextFiles: File[]) {
  if (!isAuthenticated.value) {
    openAuthDialog()
    return
  }
  if (!nextFiles.length) return

  isUploading.value = true
  const formData = new FormData()
  formData.append('prefix', prefix.value)
  nextFiles.forEach((file) => formData.append('files', file))

  try {
    const result = await apiRequest<{ uploaded: string[] }>('/api/drive/files', {
      method: 'POST',
      headers: { 'X-Access-Code': accessCode.value },
      body: formData,
    })
    showNotice(`已上传 ${result.uploaded.length} 个文件`)
    await loadFiles()
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '上传失败', 'error')
  } finally {
    isUploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function handleFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  uploadFiles(Array.from(input.files || []))
}

function handleDragEnter() {
  dragDepth.value += 1
  isDragging.value = true
}

function handleDragLeave() {
  dragDepth.value = Math.max(0, dragDepth.value - 1)
  if (dragDepth.value === 0) isDragging.value = false
}

function handleDrop(event: DragEvent) {
  dragDepth.value = 0
  isDragging.value = false
  if (!isAuthenticated.value) {
    openAuthDialog()
    return
  }
  uploadFiles(Array.from(event.dataTransfer?.files || []))
}

function openFolderDialog() {
  if (!isAuthenticated.value) return
  folderName.value = ''
  folderError.value = ''
  showFolderDialog.value = true
}

function closeFolderDialog() {
  if (!folderSubmitting.value) showFolderDialog.value = false
}

async function createFolder() {
  folderSubmitting.value = true
  folderError.value = ''
  try {
    await apiRequest('/api/drive/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Access-Code': accessCode.value },
      body: JSON.stringify({ name: folderName.value, prefix: prefix.value }),
    })
    showFolderDialog.value = false
    showNotice('文件夹已创建')
    await loadFiles()
  } catch (error) {
    folderError.value = error instanceof Error ? error.message : '创建失败'
  } finally {
    folderSubmitting.value = false
  }
}

async function deleteEntry(file: DriveFile) {
  if (!isAuthenticated.value) return
  const accepted = window.confirm(`确定删除“${displayName(file)}”吗？${file.isFolder ? '文件夹内的内容也会被删除。' : ''}`)
  if (!accepted) return

  try {
    await apiRequest(`/api/drive/files?key=${encodeURIComponent(file.key)}`, {
      method: 'DELETE',
      headers: { 'X-Access-Code': accessCode.value },
    })
    showNotice('已删除')
    await loadFiles()
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '删除失败', 'error')
  }
}

function fileUrl(file: DriveFile, download = false) {
  const query = new URLSearchParams({ key: file.key })
  if (download) query.set('download', '')
  return `/api/drive/download?${query}`
}

function downloadFile(file: DriveFile) {
  const anchor = document.createElement('a')
  anchor.href = fileUrl(file, true)
  anchor.download = displayName(file)
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

async function openPreview(file: DriveFile) {
  previewController?.abort()
  previewController = new AbortController()
  previewFile.value = file
  previewKind.value = kindFor(file)
  previewUrl.value = fileUrl(file)
  previewText.value = ''
  previewError.value = ''
  previewLoading.value = previewKind.value === 'text'

  if (previewKind.value !== 'text') return

  try {
    const response = await fetch(previewUrl.value, { signal: previewController.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    previewText.value = await response.text()
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      previewError.value = error instanceof Error ? error.message : '预览失败'
    }
  } finally {
    previewLoading.value = false
  }
}

function closePreview() {
  previewController?.abort()
  previewFile.value = null
  previewText.value = ''
  previewError.value = ''
}

onMounted(async () => {
  isMounted.value = true
  loadFiles()
  const savedCode = await restoreAdminAccess()
  if (!savedCode) return
  accessCode.value = savedCode
  isAuthenticated.value = true
})

onBeforeUnmount(() => {
  listController?.abort()
  previewController?.abort()
  if (noticeTimer !== null) window.clearTimeout(noticeTimer)
})
</script>

<style scoped>
.drivePage {
  position: relative;
  width: calc(100% - 14px);
  margin: 0 7px;
  padding: 24px 0 76px;
}

.driveToolbar {
  min-height: 112px;
  padding: 24px 2px 18px;
  border-bottom: 1px solid var(--module_dock_border);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 22px;
}

.driveToolbar p,
.driveModal header p {
  margin: 0;
  font-size: 9px;
  font-weight: 600;
  line-height: 13px;
  opacity: 0.5;
}

.driveToolbar h2 {
  margin: 5px 0 0;
  font-size: 25px;
  font-weight: 600;
  line-height: 32px;
}

.driveCommands {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 7px;
}

.driveCommands button,
.drivePrimaryButton,
.drivePreviewModal footer button {
  min-height: 36px;
  padding: 0 11px;
  border: 1px solid var(--module_dock_border);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: inherit;
  background: var(--item_bg_color);
  font-size: 10px;
  cursor: pointer;
  transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
}

.driveCommands button:hover,
.drivePreviewModal footer button:hover {
  border-color: var(--module_dock_active_border);
  background: var(--item_hover_color);
  transform: translateY(-1px);
}

.driveCommands button:active,
.drivePreviewModal footer button:active {
  transform: scale(0.97);
}

.driveCommands button:disabled {
  opacity: 0.28;
  pointer-events: none;
}

.driveAuthButton.is-authenticated {
  border-color: rgba(148, 224, 178, 0.34);
}

.driveFileInput {
  position: fixed;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.driveBreadcrumb {
  min-height: 54px;
  padding: 8px 1px;
  border-bottom: 1px solid var(--module_dock_border);
  display: flex;
  align-items: center;
  gap: 3px;
  overflow-x: auto;
  scrollbar-width: thin;
}

.driveBreadcrumb button {
  min-height: 30px;
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  color: inherit;
  background: transparent;
  font-size: 10px;
  opacity: 0.52;
  cursor: pointer;
}

.driveBreadcrumb button:hover,
.driveBreadcrumb button.is-current {
  background: var(--item_bg_color);
  opacity: 1;
}

.driveNotice {
  min-height: 42px;
  margin-top: 10px;
  padding: 0 12px;
  border: 1px solid var(--module_dock_border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--item_bg_color);
  font-size: 10px;
}

.driveNotice.is-error { color: #ffb4b4; }

.driveTableWrap {
  overflow-x: auto;
  border-bottom: 1px solid var(--module_dock_active_border);
}

.driveTable {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.driveTable th {
  height: 42px;
  padding: 0 12px;
  border-bottom: 1px solid var(--module_dock_border);
  font-size: 8px;
  font-weight: 600;
  text-align: left;
  opacity: 0.46;
}

.driveTable th:first-child { width: auto; }
.driveTable .is-size { width: 96px; }
.driveTable .is-date { width: 164px; }
.driveTable .is-actions { width: 112px; }

.driveTable tbody tr {
  height: 62px;
  border-bottom: 1px solid color-mix(in srgb, var(--module_dock_border) 72%, transparent);
  animation: driveRowReveal 0.42s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--file-index) * 35ms);
  transition: background-color 0.2s ease;
}

.driveTable tbody tr:hover { background: color-mix(in srgb, var(--item_hover_color) 68%, transparent); }

.driveTable td {
  padding: 0 12px;
  font-size: 10px;
  opacity: 0.62;
}

.driveFileName {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  color: inherit;
  background: transparent;
  font: inherit;
  text-align: left;
}

.driveFileName svg { flex: 0 0 auto; opacity: 0.74; }
.driveFileName span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.driveFileName.is-folder { cursor: pointer; opacity: 1; }
.driveFileName.is-folder:hover span { text-decoration: underline; text-underline-offset: 3px; }

.driveRowActions {
  display: flex;
  justify-content: flex-end;
  gap: 3px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.driveTable tr:hover .driveRowActions,
.driveRowActions:focus-within { opacity: 1; }

.driveRowActions button,
.driveModal header > button {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 5px;
  display: grid;
  place-items: center;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

.driveRowActions button:hover,
.driveModal header > button:hover {
  border-color: var(--weather_dialog_line);
  background: var(--weather_dialog_control_hover);
}

.driveRowActions button.is-danger:hover { color: #ff8e8e; }

.driveSkeleton {
  border-bottom: 1px solid var(--module_dock_border);
}

.driveSkeleton span {
  height: 62px;
  border-bottom: 1px solid var(--module_dock_border);
  display: block;
  background: linear-gradient(100deg, transparent 20%, var(--item_bg_color) 45%, transparent 70%);
  background-size: 220% 100%;
  animation: driveShimmer 1.35s ease-in-out infinite;
}

.driveState {
  min-height: 340px;
  border-bottom: 1px solid var(--module_dock_border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.driveState h3 { margin-top: 14px; font-size: 18px; line-height: 25px; }
.driveState p { margin: 6px 0 0; font-size: 10px; line-height: 17px; opacity: 0.54; }
.driveState button {
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

.driveDropOverlay {
  position: absolute;
  inset: 18px 0 70px;
  z-index: 4;
  border: 1px dashed var(--module_dock_active_border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: color-mix(in srgb, var(--item_bg_color) 86%, rgba(20, 21, 24, 0.7));
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  font-size: 11px;
  pointer-events: none;
}

.driveModalBackdrop {
  position: fixed;
  inset: 0;
  z-index: 99999;
  padding: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--weather_dialog_backdrop);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.driveModal {
  width: min(420px, 100%);
  padding: 20px;
  border: 1px solid var(--weather_dialog_border);
  border-radius: 8px;
  color: var(--weather_dialog_text);
  background: var(--weather_dialog_bg);
  box-shadow: 0 24px 70px -34px var(--weather_dialog_shadow), inset 0 1px 0 var(--weather_dialog_inset);
}

.driveModal header {
  min-height: 56px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--weather_dialog_line);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.driveModal h3 {
  margin: 3px 0 0;
  font-size: 18px;
  line-height: 24px;
}

.driveModal label {
  margin-bottom: 7px;
  display: block;
  color: var(--weather_dialog_muted);
  font-size: 9px;
  line-height: 13px;
}

.driveInputWrap {
  height: 46px;
  border: 1px solid var(--weather_dialog_line_strong);
  border-radius: 6px;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  background: var(--weather_dialog_control_bg);
}

.driveInputWrap svg { justify-self: end; margin-right: 8px; color: var(--weather_dialog_subtle); }
.driveInputWrap input {
  width: 100%;
  height: 100%;
  padding-right: 12px;
  border: 0;
  outline: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  font-size: 12px;
  user-select: text;
}

.driveFormError {
  margin: 8px 0 0;
  color: #b14646;
  font-size: 9px;
  line-height: 14px;
}

.drivePrimaryButton {
  width: 100%;
  margin-top: 18px;
  border-color: var(--weather_dialog_active_bg);
  color: var(--weather_dialog_active_text);
  background: var(--weather_dialog_active_bg);
}

.drivePrimaryButton:disabled { opacity: 0.5; }

.drivePreviewModal {
  width: min(920px, 100%);
  max-height: calc(100dvh - 36px);
  display: flex;
  flex-direction: column;
}

.drivePreviewModal header { flex: 0 0 auto; }
.drivePreviewModal h3 {
  max-width: min(70vw, 720px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drivePreviewBody {
  min-height: 260px;
  max-height: 68dvh;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drivePreviewBody img,
.drivePreviewBody video {
  max-width: 100%;
  max-height: 64dvh;
  border-radius: 6px;
  display: block;
}

.drivePreviewBody audio { width: min(520px, 100%); }
.drivePreviewBody iframe { width: 100%; height: 64dvh; border: 0; border-radius: 6px; }
.drivePreviewBody pre {
  width: 100%;
  min-height: 260px;
  margin: 0;
  padding: 16px;
  border: 1px solid var(--weather_dialog_line);
  border-radius: 6px;
  overflow: auto;
  background: var(--weather_dialog_control_bg);
  font: 11px/19px "Cascadia Code", Consolas, monospace;
  white-space: pre;
  user-select: text;
}

.drivePreviewLoading { width: 100%; display: grid; gap: 9px; }
.drivePreviewLoading span {
  height: 260px;
  border-radius: 6px;
  background: linear-gradient(100deg, var(--weather_dialog_surface) 20%, var(--weather_dialog_control_hover) 45%, var(--weather_dialog_surface) 70%);
  background-size: 220% 100%;
  animation: driveShimmer 1.35s ease-in-out infinite;
}

.drivePreviewModal footer {
  padding-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.drivePreviewModal footer button {
  color: var(--weather_dialog_text);
  background: var(--weather_dialog_control_bg);
}

.drive-modal-enter-active,
.drive-modal-leave-active { transition: opacity 0.22s ease; }
.drive-modal-enter-active .driveModal,
.drive-modal-leave-active .driveModal { transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease; }
.drive-modal-enter-from,
.drive-modal-leave-to { opacity: 0; }
.drive-modal-enter-from .driveModal,
.drive-modal-leave-to .driveModal { opacity: 0; transform: translateY(10px) scale(0.98); }

.srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes driveRowReveal {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes driveShimmer {
  from { background-position: 120% 0; }
  to { background-position: -120% 0; }
}

@media (max-width: 800px) {
  .drivePage { width: calc(100% - 18px); margin: 0 9px; }
  .driveRowActions { opacity: 1; }
}

@media (max-width: 640px) {
  .driveToolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .driveCommands { width: 100%; justify-content: flex-start; }
  .driveCommands .driveAuthButton { margin-left: auto; }
  .driveCommands button span { display: none; }
  .driveCommands button { width: 36px; padding: 0; }
  .driveTable .is-size,
  .driveTable .is-date { display: none; }
  .driveTable .is-actions { width: 104px; }
  .driveTable th,
  .driveTable td { padding-right: 7px; padding-left: 7px; }
  .driveModalBackdrop { padding: 10px; }
  .drivePreviewModal { max-height: calc(100dvh - 20px); }
  .drivePreviewBody { max-height: 72dvh; }
}

@media (prefers-reduced-motion: reduce) {
  .driveTable tbody tr,
  .driveSkeleton span,
  .drivePreviewLoading span { animation: none; }
  .driveCommands button,
  .driveRowActions,
  .drive-modal-enter-active,
  .drive-modal-leave-active,
  .drive-modal-enter-active .driveModal,
  .drive-modal-leave-active .driveModal { transition: none; }
}
</style>
