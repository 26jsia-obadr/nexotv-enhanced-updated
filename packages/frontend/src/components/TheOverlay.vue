<template>
  <div v-if="visible" class="overlay">
    <div class="overlay-box">
      <header class="overlay-header">
        <h2>{{ message }}</h2>
        <p class="overlay-sub">{{ Math.round(progress) }}%</p>
      </header>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: Math.min(100, progress) + '%' }"></div>
      </div>
      <pre class="status-log" ref="logRef">{{ details }}</pre>
      <div class="overlay-actions">
        <template v-if="isReady">
          <button v-if="manifestUrl" class="btn primary" @click="openStremio">Open in Stremio</button>
          <button v-if="manifestUrl" class="btn" @click="copyManifest">{{ copyLabel }}</button>
        </template>
      </div>
      <button v-if="isReady" class="btn" style="margin-top: 14px" @click="$emit('close')">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  progress: number
  message: string
  details: string
  manifestUrl: string
  stremioUrl: string
  isReady: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const copyLabel = ref('Copy URL')
const logRef = ref<HTMLPreElement>()

// Auto-scroll log to bottom when details change
watch(() => props.details, () => {
  if (logRef.value) {
    logRef.value.scrollTop = logRef.value.scrollHeight
  }
})

function getInstallUrl(): string {
  return props.stremioUrl || props.manifestUrl
}

function copyText(value: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(value)
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  const copied = document.execCommand('copy')
  textarea.remove()
  return copied ? Promise.resolve() : Promise.reject(new Error('Copy failed'))
}

function copyManifest() {
  const url = getInstallUrl()
  if (!url) return

  copyText(url)
    .then(() => {
      copyLabel.value = 'Copied!'
      setTimeout(() => { copyLabel.value = 'Copy URL' }, 1600)
    })
    .catch(() => {
      copyLabel.value = 'Copy Failed'
      setTimeout(() => { copyLabel.value = 'Copy URL' }, 1600)
    })
}

function openStremio() {
  const url = getInstallUrl()
  if (!url) return

  try {
    const link = document.createElement('a')
    link.href = url
    link.rel = 'noopener noreferrer'
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()
    return
  } catch {
    // Fall back to direct navigation if custom-protocol launching is blocked.
  }

  window.location.href = url
}
</script>
