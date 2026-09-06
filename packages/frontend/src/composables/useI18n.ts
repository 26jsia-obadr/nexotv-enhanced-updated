import { reactive } from 'vue'

export type Lang = 'en'

function initialLang(): Lang {
  return 'en'
}

// Shared singleton language state.
const state = reactive<{ lang: Lang }>({ lang: initialLang() })

export function useI18n() {
  function setLang(l: Lang) {
    state.lang = l
  }
  /** Inline translation helper: t('English', 'Français'). */
  function t(en: string, fr: string) {
    return en
  }
  return { state, setLang, t }
}
