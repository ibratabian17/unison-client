import { useState, useEffect } from "react"
import { useSearchParams, useLocation } from "react-router-dom"
import { translateLyrics } from "@/lib/api"
import { IconLanguage, IconLoader2, IconCopy, IconCheck, IconArrowsExchange } from "@tabler/icons-react"

export function TranslatePage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const [inputText, setInputText] = useState("")
  const [targetLang, setTargetLang] = useState("en")
  const [translatedLines, setTranslatedLines] = useState<string[]>([])
  const [romanizedLines, setRomanizedLines] = useState<string[] | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const queryLyrics = searchParams.get("lyrics")
    const stateLyrics = (location.state as { lyrics?: string } | null)?.lyrics
    const initial = queryLyrics || stateLyrics
    if (initial) {
      // Strip LRC timestamps if any for clean translation
      const clean = initial
        .split(/\r?\n/)
        .map((line) => line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim())
        .filter(Boolean)
        .join("\n")
      setInputText(clean || initial)
    }
  }, [searchParams, location.state])

  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return

    const lines = inputText.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length === 0) return

    try {
      setLoading(true)
      setError(null)
      const res = await translateLyrics(lines, targetLang)
      setTranslatedLines(res.translated)
      setRomanizedLines(res.romanized)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    const text = translatedLines.join("\n")
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-unison-text">Lyrics Translator & Romanizer</h1>
        <p className="text-sm text-unison-text-secondary mt-1">
          Translate lyrics between languages or romanize non-Latin scripts (Japanese Kanji/Kana, Korean Hangul, Chinese Hanzi).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Source Box */}
        <form onSubmit={handleTranslate} className="space-y-4 rounded-xl border border-unison-border bg-unison-bg-elevated p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-unison-text-secondary">Source Lyrics</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-unison-text-muted">Target:</span>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                aria-label="Target language"
                className="rounded border border-unison-border bg-unison-bg px-2.5 py-1 text-xs text-unison-text focus:border-unison-border-strong focus:outline-none"
              >
                <option value="en">English (en)</option>
                <option value="ja">Japanese (ja)</option>
                <option value="ko">Korean (ko)</option>
                <option value="zh">Chinese (zh)</option>
                <option value="es">Spanish (es)</option>
                <option value="fr">French (fr)</option>
                <option value="de">German (de)</option>
                <option value="id">Indonesian (id)</option>
                <option value="ru">Russian (ru)</option>
              </select>
            </div>
          </div>

          <textarea
            rows={15}
            required
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste raw or timed lyrics to translate..."
            className="w-full font-mono text-xs leading-relaxed rounded-lg border border-unison-border bg-unison-bg p-3 text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none"
            spellCheck={false}
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? <IconLoader2 className="size-4 animate-spin" /> : <IconArrowsExchange className="size-4" />}
              Translate & Romanize
            </button>
          </div>
        </form>

        {/* Translation Output Box */}
        <div className="flex flex-col space-y-4 rounded-xl border border-unison-border bg-unison-bg-elevated p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-unison-border pb-3">
            <span className="text-xs font-semibold text-unison-text-secondary">Translated Output</span>
            {translatedLines.length > 0 && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 rounded bg-white/5 px-2.5 py-1 text-xs text-unison-text-secondary transition-colors hover:bg-white/10 hover:text-unison-text"
              >
                {copied ? <IconCheck className="size-3.5 text-emerald-400" /> : <IconCopy className="size-3.5" />}
                <span>{copied ? "Copied!" : "Copy All"}</span>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[480px] rounded-lg border border-unison-border/50 bg-unison-bg p-4 space-y-2 font-mono text-xs">
            {translatedLines.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-unison-text-muted text-center">
                <IconLanguage className="size-8 opacity-40 mb-2" />
                <p>Click "Translate & Romanize" to see output.</p>
              </div>
            ) : (
              translatedLines.map((line, idx) => (
                <div key={idx} className="space-y-0.5 p-1 rounded hover:bg-white/5 transition-colors">
                  <p className="text-unison-text">{line}</p>
                  {romanizedLines && romanizedLines[idx] && (
                    <p className="text-[11px] text-cyan-400/80">{romanizedLines[idx]}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
