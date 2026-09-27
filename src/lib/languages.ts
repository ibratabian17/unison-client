export const LANGUAGE_CODES = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "nl",
  "sv",
  "da",
  "no",
  "fi",
  "pl",
  "cs",
  "sk",
  "hu",
  "ro",
  "el",
  "tr",
  "ru",
  "uk",
  "ja",
  "ko",
  "zh",
  "zh-Hant",
  "hi",
  "bn",
  "pa",
  "ta",
  "te",
  "ur",
  "id",
  "ms",
  "vi",
  "th",
  "fil",
  "ar",
  "he",
  "fa",
  "sw",
] as const

export interface LanguageOption {
  code: string
  name: string
}

let cachedOptions: LanguageOption[] | null = null

export function getLanguageOptions(): LanguageOption[] {
  if (cachedOptions) return cachedOptions

  let displayNames: Intl.DisplayNames | null = null
  try {
    displayNames = new Intl.DisplayNames(undefined, { type: "language" })
  } catch {
    displayNames = null
  }

  cachedOptions = LANGUAGE_CODES.map((code) => ({
    code,
    name: displayNames ? `${displayNames.of(code) || code} (${code})` : code,
  }))

  return cachedOptions
}

export function detectLyricsLanguage(text: string): string | null {
  // Check TTML xml:lang
  const ttmlMatch = text.match(/<tt\b[^>]*\bxml:lang\s*=\s*["']([^"']+)["']/i)
  if (ttmlMatch) {
    const lang = ttmlMatch[1].toLowerCase()
    const found = LANGUAGE_CODES.find((c) => c.toLowerCase() === lang || c.toLowerCase().split("-")[0] === lang.split("-")[0])
    if (found) return found
  }

  // Detect script (Japanese, Korean, Chinese, Cyrillic, Arabic, Hebrew)
  if (/[\u3040-\u30ff\u31f0-\u31ff]/.test(text)) return "ja"
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(text)) return "ko"
  if (/[\u4e00-\u9fff]/.test(text)) return "zh"
  if (/[\u0400-\u04ff]/.test(text)) return "ru"
  if (/[\u0600-\u06ff]/.test(text)) return "ar"
  if (/[\u0590-\u05ff]/.test(text)) return "he"

  return null
}
