import { useState, useEffect, useMemo } from "react"
import { useSearchParams, useLocation } from "react-router-dom"
import { translateLyrics, type TranslateResult } from "@/lib/api"
import {
  IconLanguage,
  IconLoader2,
  IconCopy,
  IconCheck,
  IconArrowsExchange,
  IconSparkles,
} from "@tabler/icons-react"
import { cn } from "@/lib/cn"

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ja", name: "Japanese (日本語)" },
  { code: "ko", name: "Korean (한국어)" },
  { code: "zh", name: "Chinese Simplified (简体中文)" },
  { code: "zh-Hant", name: "Chinese Traditional (繁體中文)" },
  { code: "id", name: "Indonesian (Bahasa Indonesia)" },
  { code: "es", name: "Spanish (Español)" },
  { code: "fr", name: "French (Français)" },
  { code: "de", name: "German (Deutsch)" },
  { code: "it", name: "Italian (Italiano)" },
  { code: "pt", name: "Portuguese (Português)" },
  { code: "ru", name: "Russian (Русский)" },
  { code: "vi", name: "Vietnamese (Tiếng Việt)" },
  { code: "th", name: "Thai (ไทย)" },
  { code: "hi", name: "Hindi (हिन्दी)" },
  { code: "ar", name: "Arabic (العربية)" },
  { code: "ms", name: "Malay (Bahasa Melayu)" },
  { code: "fil", name: "Filipino (Tagalog)" },
]

export function TranslatePage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const [inputText, setInputText] = useState("")
  const [sourceLang, setSourceLang] = useState("auto")
  const [targetLang, setTargetLang] = useState("en")
  const [keepTimestamps, setKeepTimestamps] = useState(true)
  const [result, setResult] = useState<TranslateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [copiedType, setCopiedType] = useState<"translated" | "romanized" | "both" | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const queryLyrics = searchParams.get("lyrics")
    const stateLyrics = (location.state as { lyrics?: string } | null)?.lyrics
    const initial = queryLyrics || stateLyrics
    if (initial) {
      setInputText(initial)
    }
  }, [searchParams, location.state])

  // Extract timestamps from lines for clean processing
  const parsedInput = useMemo(() => {
    const rawLines = inputText.split(/\r?\n/)
    return rawLines.map((raw) => {
      const match = raw.match(/^(\[\d{2}:\d{2}(?:\.\d{2,3})?\]\s*)(.*)$/)
      if (match) {
        return { timestamp: match[1], text: match[2].trim(), raw }
      }
      return { timestamp: "", text: raw.trim(), raw }
    })
  }, [inputText])

  const hasTimestamps = useMemo(
    () => parsedInput.some((p) => p.timestamp.length > 0),
    [parsedInput],
  )

  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return

    const plainLines = parsedInput.map((p) => (p.text.length > 0 ? p.text : p.raw))
    if (plainLines.length === 0) return

    try {
      setLoading(true)
      setError(null)
      const res = await translateLyrics(plainLines, targetLang, sourceLang === "auto" ? undefined : sourceLang)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed")
    } finally {
      setLoading(false)
    }
  }

  // Generate output lines with or without timestamps
  const outputFormatted = useMemo(() => {
    if (!result) return { translated: [], romanized: [] }
    const trans = result.translated.map((t, i) => {
      const prefix = keepTimestamps && parsedInput[i] ? parsedInput[i].timestamp : ""
      return `${prefix}${t}`
    })
    const rom = result.romanized
      ? result.romanized.map((r, i) => {
          const prefix = keepTimestamps && parsedInput[i] ? parsedInput[i].timestamp : ""
          return `${prefix}${r}`
        })
      : []
    return { translated: trans, romanized: rom }
  }, [result, keepTimestamps, parsedInput])

  const handleCopy = async (type: "translated" | "romanized" | "both") => {
    let text = ""
    if (type === "translated") {
      text = outputFormatted.translated.join("\n")
    } else if (type === "romanized") {
      text = outputFormatted.romanized.join("\n")
    } else {
      text = outputFormatted.translated
        .map((t, i) => {
          const r = outputFormatted.romanized[i]
          return r ? `${t}\n${r}` : t
        })
        .join("\n\n")
    }
    await navigator.clipboard.writeText(text)
    setCopiedType(type)
    setTimeout(() => setCopiedType(null), 1500)
  }

  const detectedLangName = useMemo(() => {
    if (!result?.detectedLang) return null
    const found = LANGUAGES.find((l) => l.code === result.detectedLang.toLowerCase())
    return found ? found.name : result.detectedLang.toUpperCase()
  }, [result])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-unison-text">Lyrics Translator & Romanizer</h1>
        <p className="text-sm text-unison-text-secondary mt-1">
          Translate lyrics and romanize non-Latin scripts (Japanese Kanji/Kana, Korean Hangul, Chinese Hanzi) powered by the Unison translation engine.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Source Box */}
        <form onSubmit={handleTranslate} className="flex flex-col space-y-4 rounded-xl border border-unison-border bg-unison-bg-elevated p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-unison-text-secondary">Source Lyrics</span>
            <div className="flex items-center gap-2">
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                aria-label="Source language"
                className="rounded-[7px] border border-unison-border bg-unison-bg px-2.5 py-1 text-xs text-unison-text focus:border-unison-border-strong focus:outline-none cursor-pointer"
              >
                <option value="auto">Auto-detect</option>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
              <IconArrowsExchange className="size-4 text-unison-text-muted" />
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                aria-label="Target language"
                className="rounded-[7px] border border-unison-border bg-unison-bg px-2.5 py-1 text-xs text-unison-text focus:border-unison-border-strong focus:outline-none cursor-pointer font-medium"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            rows={16}
            required
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste plain or timed LRC lyrics here..."
            className="w-full flex-1 font-mono text-xs leading-relaxed rounded-lg border border-unison-border bg-unison-bg p-3 text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none min-h-[280px]"
            spellCheck={false}
          />

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {hasTimestamps ? (
              <label className="flex items-center gap-2 text-xs text-unison-text-secondary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={keepTimestamps}
                  onChange={(e) => setKeepTimestamps(e.target.checked)}
                  className="rounded border-unison-border bg-unison-bg text-red-600 focus:ring-0"
                />
                <span>Preserve LRC timestamps in output</span>
              </label>
            ) : (
              <span className="text-[11.5px] text-unison-text-muted">
                {parsedInput.filter((p) => p.text.length > 0).length} lines
              </span>
            )}

            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? <IconLoader2 className="size-4 animate-spin" /> : <IconSparkles className="size-4" />}
              <span>Translate & Romanize</span>
            </button>
          </div>
        </form>

        {/* Translation Output Box */}
        <div className="flex flex-col space-y-4 rounded-xl border border-unison-border bg-unison-bg-elevated p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-unison-border pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-unison-text-secondary">Translated Output</span>
              {detectedLangName && (
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  Detected: {detectedLangName}
                </span>
              )}
              {result?.cached && (
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-unison-text-muted">
                  Cached
                </span>
              )}
            </div>

            {result && result.translated.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCopy("translated")}
                  className="flex items-center gap-1 rounded-[7px] border border-unison-border bg-unison-surface px-2.5 py-1 text-xs text-unison-text-secondary hover:text-unison-text hover:bg-unison-bg-hover transition-colors cursor-pointer"
                >
                  {copiedType === "translated" ? <IconCheck className="size-3 text-emerald-400" /> : <IconCopy className="size-3" />}
                  <span>Translation</span>
                </button>

                {outputFormatted.romanized.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleCopy("romanized")}
                    className="flex items-center gap-1 rounded-[7px] border border-unison-border bg-unison-surface px-2.5 py-1 text-xs text-cyan-400 hover:bg-unison-bg-hover transition-colors cursor-pointer"
                  >
                    {copiedType === "romanized" ? <IconCheck className="size-3 text-emerald-400" /> : <IconCopy className="size-3" />}
                    <span>Romanized</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px] rounded-lg border border-unison-border/60 bg-unison-bg p-4 space-y-2.5 font-mono text-xs">
            {!result || result.translated.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center text-unison-text-muted text-center space-y-2">
                <IconLanguage className="size-8 opacity-30" />
                <p className="text-xs">Click "Translate & Romanize" to see output.</p>
                <p className="text-[11px] text-unison-text-muted max-w-xs">
                  Supports Asian scripts (Japanese, Korean, Chinese) with automatic romanization.
                </p>
              </div>
            ) : (
              outputFormatted.translated.map((transLine, idx) => {
                const romLine = outputFormatted.romanized[idx]
                const orig = parsedInput[idx]
                return (
                  <div
                    key={idx}
                    className="space-y-1 p-2 rounded-[8px] bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-colors"
                  >
                    {orig && orig.text.length > 0 && (
                      <p className="text-[11px] text-unison-text-muted select-none">
                        {orig.timestamp && <span className="text-unison-text-muted/60 mr-1">{orig.timestamp}</span>}
                        {orig.text}
                      </p>
                    )}
                    <p className="text-unison-text font-medium leading-relaxed">{transLine}</p>
                    {romLine && (
                      <p className="text-[11.5px] text-cyan-400/90 leading-relaxed">{romLine}</p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
