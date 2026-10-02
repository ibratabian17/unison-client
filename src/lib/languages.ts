export interface LanguageItem {
  code: string
  name: string
  native?: string
}

// 130+ languages supported by Google Translate / Unison API
export const TRANSLATE_LANGUAGES: LanguageItem[] = [
  { code: "af", name: "Afrikaans", native: "Afrikaans" },
  { code: "ak", name: "Akan / Twi", native: "Akan" },
  { code: "sq", name: "Albanian", native: "Shqip" },
  { code: "am", name: "Amharic", native: "አማርኛ" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "hy", name: "Armenian", native: "Հայերեն" },
  { code: "as", name: "Assamese", native: "অসমীয়া" },
  { code: "ay", name: "Aymara", native: "Aymar aru" },
  { code: "az", name: "Azerbaijani", native: "Azərbaycan" },
  { code: "bm", name: "Bambara", native: "Bamanankan" },
  { code: "eu", name: "Basque", native: "Euskara" },
  { code: "be", name: "Belarusian", native: "Беларуская" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "bho", name: "Bhojpuri", native: "भोजपुरी" },
  { code: "bs", name: "Bosnian", native: "Bosanski" },
  { code: "bg", name: "Bulgarian", native: "Български" },
  { code: "ca", name: "Catalan", native: "Català" },
  { code: "ceb", name: "Cebuano", native: "Bisaya" },
  { code: "ny", name: "Chichewa", native: "ChiCheŵa" },
  { code: "zh", name: "Chinese (Simplified)", native: "简体中文" },
  { code: "zh-Hant", name: "Chinese (Traditional)", native: "繁體中文" },
  { code: "co", name: "Corsican", native: "Corsu" },
  { code: "hr", name: "Croatian", native: "Hrvatski" },
  { code: "cs", name: "Czech", native: "Čeština" },
  { code: "da", name: "Danish", native: "Dansk" },
  { code: "dv", name: "Dhivehi", native: "ދިވެހި" },
  { code: "doi", name: "Dogri", native: "डोगरी" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "en", name: "English", native: "English" },
  { code: "eo", name: "Esperanto", native: "Esperanto" },
  { code: "et", name: "Estonian", native: "Eesti" },
  { code: "ee", name: "Ewe", native: "Èʋegbe" },
  { code: "fil", name: "Filipino (Tagalog)", native: "Wikang Filipino" },
  { code: "fi", name: "Finnish", native: "Suomi" },
  { code: "fr", name: "French", native: "Français" },
  { code: "fy", name: "Frisian", native: "Frysk" },
  { code: "gl", name: "Galician", native: "Galego" },
  { code: "ka", name: "Georgian", native: "ქართული" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "el", name: "Greek", native: "Ελληνικά" },
  { code: "gn", name: "Guarani", native: "Avañe'ẽ" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "ht", name: "Haitian Creole", native: "Kreyòl ayisyen" },
  { code: "ha", name: "Hausa", native: "هَوُسَ" },
  { code: "haw", name: "Hawaiian", native: "ʻŌlelo Hawaiʻi" },
  { code: "he", name: "Hebrew", native: "עברית" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "hmn", name: "Hmong", native: "Hmoob" },
  { code: "hu", name: "Hungarian", native: "Magyar" },
  { code: "is", name: "Icelandic", native: "Íslenska" },
  { code: "ig", name: "Igbo", native: "Asụsụ Igbo" },
  { code: "ilo", name: "Ilocano", native: "Ilokano" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ga", name: "Irish", native: "Gaeilge" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "jv", name: "Javanese", native: "Basa Jawa" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "kk", name: "Kazakh", native: "Қазақ тілі" },
  { code: "km", name: "Khmer", native: "ភាសាខ្មែរ" },
  { code: "rw", name: "Kinyarwanda", native: "Ikinyarwanda" },
  { code: "gom", name: "Konkani", native: "कोंकणी" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "kri", name: "Krio", native: "Krio" },
  { code: "ku", name: "Kurdish (Kurmanji)", native: "Kurdî" },
  { code: "ckb", name: "Kurdish (Sorani)", native: "کوردی" },
  { code: "ky", name: "Kyrgyz", native: "Кыргызча" },
  { code: "lo", name: "Lao", native: "ລາວ" },
  { code: "la", name: "Latin", native: "Latīna" },
  { code: "lv", name: "Latvian", native: "Latviešu" },
  { code: "ln", name: "Lingala", native: "Lingála" },
  { code: "lt", name: "Lithuanian", native: "Lietuvių" },
  { code: "lg", name: "Luganda", native: "Oluganda" },
  { code: "lb", name: "Luxembourgish", native: "Lëtzebuergesch" },
  { code: "mk", name: "Macedonian", native: "Македонски" },
  { code: "mai", name: "Maithili", native: "मैथिली" },
  { code: "mg", name: "Malagasy", native: "Fiteny malagasy" },
  { code: "ms", name: "Malay", native: "Bahasa Melayu" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "mt", name: "Maltese", native: "Malti" },
  { code: "mi", name: "Maori", native: "Māori" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "mni-Mtei", name: "Meiteilon (Manipuri)", native: "মৈতৈলোন্" },
  { code: "lus", name: "Mizo", native: "Mizo ṭawng" },
  { code: "mn", name: "Mongolian", native: "Монгол хэл" },
  { code: "my", name: "Myanmar (Burmese)", native: "မြန်မာစာ" },
  { code: "ne", name: "Nepali", native: "नेपाली" },
  { code: "no", name: "Norwegian", native: "Norsk" },
  { code: "or", name: "Odia (Oriya)", native: "ଓଡ଼ିଆ" },
  { code: "om", name: "Oromo", native: "Afaan Oromoo" },
  { code: "ps", name: "Pashto", native: "پښتو" },
  { code: "fa", name: "Persian (Farsi)", native: "فارسی" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "qu", name: "Quechua", native: "Runasimi" },
  { code: "ro", name: "Romanian", native: "Română" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "sm", name: "Samoan", native: "Gagana Samoa" },
  { code: "sa", name: "Sanskrit", native: "संस्कृतम्" },
  { code: "gd", name: "Scots Gaelic", native: "Gàidhlig" },
  { code: "nso", name: "Sepedi", native: "Sesotho sa Leboa" },
  { code: "sr", name: "Serbian", native: "Српски" },
  { code: "st", name: "Sesotho", native: "Sesotho" },
  { code: "sn", name: "Shona", native: "chiShona" },
  { code: "sd", name: "Sindhi", native: "سنڌي" },
  { code: "si", name: "Sinhala", native: "සිංහල" },
  { code: "sk", name: "Slovak", native: "Slovenčina" },
  { code: "sl", name: "Slovenian", native: "Slovenščina" },
  { code: "so", name: "Somali", native: "Soomaaliga" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "su", name: "Sundanese", native: "Basa Sunda" },
  { code: "sw", name: "Swahili", native: "Kiswahili" },
  { code: "sv", name: "Swedish", native: "Svenska" },
  { code: "tg", name: "Tajik", native: "Тоҷикӣ" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "tt", name: "Tatar", native: "Татар теле" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "th", name: "Thai", native: "ไทย" },
  { code: "ti", name: "Tigrinya", native: "ትግርኛ" },
  { code: "ts", name: "Tsonga", native: "Xitsonga" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "tk", name: "Turkmen", native: "Türkmen dili" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
  { code: "ur", name: "Urdu", native: "اردو" },
  { code: "ug", name: "Uyghur", native: "ئۇيغۇرچە" },
  { code: "uz", name: "Uzbek", native: "Oʻzbekcha" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "cy", name: "Welsh", native: "Cymraeg" },
  { code: "xh", name: "Xhosa", native: "isiXhosa" },
  { code: "yi", name: "Yiddish", native: "ייִדיש" },
  { code: "yo", name: "Yoruba", native: "Èdè Yorùbá" },
  { code: "zu", name: "Zulu", native: "isiZulu" },
]

export const POPULAR_TRANSLATE_CODES = [
  "en",
  "ja",
  "ko",
  "zh",
  "zh-Hant",
  "es",
  "id",
  "fr",
  "de",
  "it",
  "pt",
  "ru",
  "vi",
  "th",
  "hi",
  "ar",
  "tr",
  "pl",
  "uk",
  "nl",
  "sv",
  "ms",
  "fil",
]

export const POPULAR_TRANSLATE_LANGUAGES = POPULAR_TRANSLATE_CODES.map(
  (code) => TRANSLATE_LANGUAGES.find((l) => l.code === code)!,
).filter(Boolean)

// Core submission validation supported language codes
export const LANGUAGE_CODES = TRANSLATE_LANGUAGES.map((l) => l.code)

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

  cachedOptions = TRANSLATE_LANGUAGES.map((item) => {
    let name = item.name
    if (displayNames) {
      try {
        const resolved = displayNames.of(item.code)
        if (resolved) name = resolved
      } catch {
        // fallback to item.name
      }
    }
    return {
      code: item.code,
      name: `${name} (${item.code})`,
    }
  })

  return cachedOptions
}

export function formatLanguageName(code: string): string {
  const item = TRANSLATE_LANGUAGES.find(
    (l) => l.code.toLowerCase() === code.toLowerCase() || l.code.toLowerCase().split("-")[0] === code.toLowerCase().split("-")[0],
  )
  if (item) {
    return item.native && item.native !== item.name ? `${item.name} (${item.native})` : item.name
  }
  try {
    const displayNames = new Intl.DisplayNames(undefined, { type: "language" })
    const resolved = displayNames.of(code)
    if (resolved) return resolved
  } catch {
    // fallback
  }
  return code.toUpperCase()
}

export function detectLyricsLanguage(text: string): string | null {
  // Check TTML xml:lang
  const ttmlMatch = text.match(/<tt\b[^>]*\bxml:lang\s*=\s*["']([^"']+)["']/i)
  if (ttmlMatch) {
    const lang = ttmlMatch[1].toLowerCase()
    const found = TRANSLATE_LANGUAGES.find(
      (c) => c.code.toLowerCase() === lang || c.code.toLowerCase().split("-")[0] === lang.split("-")[0],
    )
    if (found) return found.code
  }

  // Detect script (Japanese, Korean, Chinese, Cyrillic, Arabic, Hebrew, Thai, Hindi, Bengali)
  if (/[\u3040-\u30ff\u31f0-\u31ff]/.test(text)) return "ja"
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(text)) return "ko"
  if (/[\u4e00-\u9fff]/.test(text)) return "zh"
  if (/[\u0400-\u04ff]/.test(text)) return "ru"
  if (/[\u0600-\u06ff]/.test(text)) return "ar"
  if (/[\u0590-\u05ff]/.test(text)) return "he"
  if (/[\u0e00-\u0e7f]/.test(text)) return "th"
  if (/[\u0900-\u097f]/.test(text)) return "hi"
  if (/[\u0980-\u09ff]/.test(text)) return "bn"

  return null
}
