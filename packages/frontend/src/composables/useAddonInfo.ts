import { ref } from 'vue'
import type { AddonInfo } from '../types/config'

const info = ref<AddonInfo | null>(null)
const loading = ref(true)
let loadPromise: Promise<void> | null = null

async function load() {
  try {
    const [infoData, capsData] = await Promise.all([
      fetch('/api/addon-info').then(r => r.json()),
      fetch('/api/capabilities').then(r => r.json()).catch(() => ({ encryptionEnabled: false }))
    ])
    info.value = {
      name: infoData.name || 'NexoTV-Enhanced',
      description: infoData.description || '',
      logoUrl: infoData.logoUrl || '',
      encryptionEnabled: capsData.encryptionEnabled ?? false
    }
  } catch {
    info.value = { name: 'NexoTV-Enhanced', description: '', logoUrl: '', encryptionEnabled: false }
  } finally {
    loading.value = false
  }
}

export function useAddonInfo() {
  if (!loadPromise) loadPromise = load()

  return { info, loading }
}
