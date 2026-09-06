import type { AddonConfig } from '../types/config'
import { useAuth } from './useAuth'

export function useConfigToken(appendDetail: (line: string) => void) {
  async function buildUrls(config: AddonConfig): Promise<{ token: string; manifestUrl: string; stremioUrl: string }> {
    let token = ''
    try {
      const res = await fetch('/encrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (res.status === 401) {
        // Session expired / gate active — surface login instead of leaking a
        // base64 (unencrypted) token.
        useAuth().markUnauthenticated()
        const err: any = new Error('Session expired — please sign in again.')
        err.auth = true
        throw err
      }
      if (res.ok) {
        const data = await res.json()
        token = data.token
        appendDetail('✔ Config securely encrypted and stored with a short URL')
      } else {
        appendDetail(`⚠ Encryption unavailable (HTTP ${res.status}). No manifest URL was created.`)
        throw new Error(`Encryption unavailable (HTTP ${res.status}). Please try again.`)
      }
    } catch (e: any) {
      if (e?.auth) throw e // propagate auth errors so the gate shows
      if (!e?.message?.startsWith('Encryption unavailable')) {
        appendDetail(`⚠ Encryption error (${e.message}). No manifest URL was created.`)
      }
      throw e
    }

    // In dev mode the frontend runs on a different port (5173) from the backend (7000).
    // Manifest and Stremio URLs must point to the backend, not the Vite dev server.
    const backendOrigin = import.meta.env.DEV
      ? `${window.location.protocol}//${window.location.hostname}:7000`
      : window.location.origin
    const manifestUrl = `${backendOrigin}/${token}/manifest.json`
    const stremioUrl = manifestUrl.replace(/^https?:\/\//, 'stremio://')
    return { token, manifestUrl, stremioUrl }
  }

  return { buildUrls }
}
