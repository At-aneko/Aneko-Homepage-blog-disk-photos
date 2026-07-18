<template>
  <BlogHeader
    v-if="page === 'blog'"
    :theme="theme"
    :compact="compact"
    :active-section="blogSection"
    @toggle-theme="toggleTheme"
    @open-search="searchOpen = true"
  />
  <WorkspaceHeader
    v-else-if="page === 'photos' || page === 'drive'"
    :product="page"
    :theme="theme"
    @toggle-theme="toggleTheme"
  />
  <PageHeader
    v-else
    :theme="theme"
    @open-popup="popupImage = $event"
    @toggle-theme="toggleTheme"
  />
  <PopupModal
    v-if="page === 'home'"
    :image-url="popupImage"
    @close="popupImage = ''"
  />
  <BlogSearch v-if="page === 'blog'" :open="searchOpen" @close="searchOpen = false" />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import BlogHeader from './BlogHeader.vue'
import BlogSearch from './BlogSearch.vue'
import PageHeader from './PageHeader.vue'
import PopupModal from './PopupModal.vue'
import WorkspaceHeader from './WorkspaceHeader.vue'
import { setCookie } from '../utils/cookie.js'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  page: {
    type: String,
    default: 'home',
  },
  compact: {
    type: Boolean,
    default: false,
  },
  blogSection: {
    type: String,
    default: 'articles',
  },
})

const theme = ref('Light')
const searchOpen = ref(false)
const popupImage = ref('')

function handleSearchShortcut(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
    event.preventDefault()
    searchOpen.value = !searchOpen.value
  }

  if (event.key === 'Escape') searchOpen.value = false
}

function toggleTheme() {
  theme.value = theme.value === 'Dark' ? 'Light' : 'Dark'
  setCookie('themeState', theme.value, 365)
  document.documentElement.dataset.theme = theme.value
}

onMounted(() => {
  theme.value = document.documentElement.dataset.theme || 'Light'
  if (props.page === 'blog') window.addEventListener('keydown', handleSearchShortcut)

  const loading = document.getElementById('at-loading')
  if (!loading) return

  const hideLoading = () => {
    loading.style.opacity = '0'
    window.setTimeout(() => {
      loading.style.display = 'none'
    }, 300)
  }

  if (document.readyState === 'complete') hideLoading()
  else window.addEventListener('load', hideLoading, { once: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleSearchShortcut)
})
</script>
