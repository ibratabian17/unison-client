import { useState, useEffect, useMemo } from "react"
import { useSearchParams, useLocation } from "react-router-dom"
import { translateLyrics, type TranslateResult } from "@/lib/api"
import {
  IconLanguage,
  IconLoader2,
  IconCopy,
  IconCheck,
  IconArrowsExchange,
  IconDownload,
  IconTrash,
} from "@tabler/icons-react"
import { cn } from "@/lib/cn"
import {
  TRANSLATE_LANGUAGES,
  POPULAR_TRANSLATE_LANGUAGES,
  formatLanguageName,
} from "@/lib/languages"
import { detectFormat } from "@/lib/lyrics-parser"
import type { LyricsFormat } from "@/lib/types"

interface ParsedLyricLine {
  id: string
  raw: string
  isHeader: boolean
  timestamps: string
  text: string
  isBlank: boolean
  ttmlAttrs?: string
}

const SAMPLE_LRC = `[ti:夜に駆ける]
[ar:YOASOBI]
[00:00.00]
[00:15.20]沈むように溶けてゆくように
[00:18.90]二人だけの空が広がる夜に
[00:23.00]「さよなら」だけだった
[00:25.80]その一言で全てが伝わった
[00:30.10]日が沈み出した空と君の姿
[00:34.20]フェンス越しに重なっていた`

const SAMPLE_TTML = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <head>
    <metadata>
      <ttm:title>夜に駆ける</ttm:title>
      <ttm:agent type="person">YOASOBI</ttm:agent>
    </metadata>
  </head>
  <body dur="04:21.000">
    <div>
      <p begin="00:15.200" end="00:18.900">沈むように溶けてゆくように</p>
      <p begin="00:18.900" end="00:23.000">二人だけの空が広がる夜に</p>
      <p begin="00:23.000" end="00:25.800">「さよなら」だけだった</p>
      <p begin="00:25.800" end="00:30.100">その一言で全てが伝わった</p>
      <p begin="00:30.100" end="00:34.200">日が沈み出した空と君の姿</p>
      <p begin="00:34.200" end="00:39.500">フェンス越しに重なっていた</p>
    </div>
  </body>
</tt>`

const HEADER_ACTION_CLASS =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-unison-border bg-unison-bg px-2 py-1 text-xs text-unison-text-secondary transition-colors hover:border-unison-border-strong hover:bg-unison-bg-hover hover:text-unison-text disabled:opacity-50 disabled:cursor-not-allowed shrink-0"

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function parseTtmlTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0
  const trimmed = timeStr.trim()
  if (trimmed.endsWith("ms")) return (parseFloat(trimmed.slice(0, -2)) || 0) / 1000
  if (trimmed.endsWith("s")) return parseFloat(trimmed.slice(0, -1)) || 0
  const parts = trimmed.split(":")
  if (parts.length === 3) {
    const h = parseFloat(parts[0]) || 0
    const m = parseFloat(parts[1]) || 0
    const s = parseFloat(parts[2]) || 0
    return h * 3600 + m * 60 + s
  }
  if (parts.length === 2) {
    const m = parseFloat(parts[0]) || 0
    const s = parseFloat(parts[1]) || 0
    return m * 60 + s
  }
  return parseFloat(trimmed) || 0
}

function secondsToLrcTimestamp(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 100)
  return `[${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(2, "0")}]`
}

export function TranslatePage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()

  const [inputText, setInputText] = useState("")
  const [sourceLang, setSourceLang] = useState("auto")
  const [targetLang, setTargetLang] = useState("en")
  const [keepTimestamps, setKeepTimestamps] = useState(true)
  const [viewMode, setViewMode] = useState<"cards" | "raw" | "bilingual">("cards")
  const [rawFormatChoice, setRawFormatChoice] = useState<"auto" | "ttml" | "lrc" | "plain">("auto")

  const [result, setResult] = useState<TranslateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [copiedType, setCopiedType] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const queryLyrics = searchParams.get("lyrics")
    const stateLyrics = (location.state as { lyrics?: string } | null)?.lyrics
    const initial = queryLyrics || stateLyrics
    if (initial) {
      setInputText(initial)
    }
  }, [searchParams, location.state])

  const inputFormat: LyricsFormat = useMemo(() => {
    return detectFormat(inputText)
  }, [inputText])

  const parsedLines = useMemo<ParsedLyricLine[]>(() => {
    if (!inputText.trim()) return []

    // 1. TTML XML
    if (inputFormat === "ttml") {
      const pRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi
      const matches = Array.from(inputText.matchAll(pRegex))

      if (matches.length > 0) {
        return matches.map((m, idx) => {
          const attrs = m[1]
          const innerXml = m[2]
          const beginMatch = attrs.match(/\bbegin\s*=\s*["']([^"']+)["']/i)
          const beginStr = beginMatch ? beginMatch[1] : ""
          const sec = beginStr ? parseTtmlTimeToSeconds(beginStr) : 0
          const lrcTs = beginStr ? secondsToLrcTimestamp(sec) : ""

          const cleanText = decodeXmlEntities(innerXml.replace(/<[^>]+>/g, "").trim())
          const isBlank = cleanText === "" || cleanText === "♪"

          return {
            id: `ttml-${idx}`,
            raw: m[0],
            isHeader: false,
            timestamps: lrcTs,
            text: cleanText,
            isBlank,
            ttmlAttrs: attrs,
          }
        })
      }
    }

    // 2. LRC / Plain
    const lines = inputText.split(/\r?\n/)
    return lines.map((raw, idx) => {
      const trimmed = raw.trim()
      if (/^\[(ti|ar|al|au|by|length|offset|re|ve|encoding):.*\]$/i.test(trimmed)) {
        return {
          id: `line-${idx}`,
          raw,
          isHeader: true,
          timestamps: "",
          text: trimmed,
          isBlank: false,
        }
      }

      const tsMatch = trimmed.match(/^((?:\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]\s*)+)(.*)$/)
      if (tsMatch) {
        const timestamps = tsMatch[1]
        const cleanText = tsMatch[2].replace(/<[^>]+>/g, "").trim()
        const isBlank = cleanText === "" || cleanText === "♪"
        return {
          id: `line-${idx}`,
          raw,
          isHeader: false,
          timestamps,
          text: cleanText,
          isBlank,
        }
      }

      const cleanText = trimmed.replace(/<[^>]+>/g, "").trim()
      return {
        id: `line-${idx}`,
        raw,
        isHeader: false,
        timestamps: "",
        text: cleanText,
        isBlank: cleanText === "" || cleanText === "♪",
      }
    })
  }, [inputText, inputFormat])

  const hasTimestamps = useMemo(
    () => parsedLines.some((p) => p.timestamps.length > 0),
    [parsedLines],
  )

  const handleTranslate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputText.trim()) return

    const queryLines = parsedLines.map((p) => {
      if (p.isHeader || p.isBlank) return ""
      return p.text
    })

    const hasAnyTranslatable = queryLines.some((l) => l.length > 0)
    if (!hasAnyTranslatable) {
      setError("No translatable lyric lines found.")
      return
    }

    try {
      setLoading(true)
      setError(null)
      const res = await translateLyrics(
        queryLines,
        targetLang,
        sourceLang === "auto" ? undefined : sourceLang,
      )
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed")
    } finally {
      setLoading(false)
    }
  }

  const formattedOutput = useMemo(() => {
    if (!result || parsedLines.length === 0) {
      return {
        translatedText: "",
        romanizedText: "",
        bilingualText: "",
        translatedTtml: "",
        romanizedTtml: "",
        bilingualTtml: "",
        lines: [],
      }
    }

    const lines = parsedLines.map((p, i) => {
      if (p.isHeader) {
        return {
          id: p.id,
          original: p.raw,
          translated: p.raw,
          romanized: p.raw,
          isHeader: true,
          timestamps: "",
        }
      }

      if (p.isBlank) {
        const lineVal = keepTimestamps && p.timestamps ? `${p.timestamps}${p.text}` : p.text
        return {
          id: p.id,
          original: p.text || p.raw,
          translated: lineVal,
          romanized: lineVal,
          isHeader: false,
          timestamps: p.timestamps,
        }
      }

      const resLine = result.lines[i]
      const transBody = resLine?.translation || p.text
      const romBody = resLine?.romanization || ""

      const tsPrefix = keepTimestamps && p.timestamps ? p.timestamps : ""
      const transFormatted = `${tsPrefix}${transBody}`
      const romFormatted = romBody ? `${tsPrefix}${romBody}` : ""

      return {
        id: p.id,
        original: p.text,
        translated: transFormatted,
        romanized: romFormatted,
        isHeader: false,
        timestamps: p.timestamps,
      }
    })

    const translatedLrc = lines.map((l) => l.translated).join("\n")
    const romanizedLrc = lines
      .map((l) => (l.isHeader ? l.translated : l.romanized || l.translated))
      .join("\n")

    const bilingualLrc = lines
      .map((l) => {
        if (l.isHeader) return l.translated
        if (l.translated === l.original) return l.translated
        const prefix = keepTimestamps && l.timestamps ? l.timestamps : ""
        return `${prefix}${l.original}\n${l.translated}`
      })
      .join("\n")

    let translatedTtml = ""
    let romanizedTtml = ""
    let bilingualTtml = ""

    if (inputFormat === "ttml") {
      let pIdx = 0
      translatedTtml = inputText.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs) => {
        const lineRes = result.lines[pIdx]
        const origLine = parsedLines[pIdx]
        pIdx++
        if (!origLine || origLine.isBlank) return match
        const transText = lineRes?.translation || origLine.text
        return `<p${attrs}>${escapeXml(transText)}</p>`
      })

      pIdx = 0
      romanizedTtml = inputText.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs) => {
        const lineRes = result.lines[pIdx]
        const origLine = parsedLines[pIdx]
        pIdx++
        if (!origLine || origLine.isBlank) return match
        const romText = lineRes?.romanization || lineRes?.translation || origLine.text
        return `<p${attrs}>${escapeXml(romText)}</p>`
      })

      pIdx = 0
      bilingualTtml = inputText.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs) => {
        const lineRes = result.lines[pIdx]
        const origLine = parsedLines[pIdx]
        pIdx++
        if (!origLine || origLine.isBlank) return match
        const transText = lineRes?.translation || origLine.text
        return `<p${attrs}>${escapeXml(origLine.text)}&#10;${escapeXml(transText)}</p>`
      })
    }

    const effectiveRawFormat =
      rawFormatChoice === "auto" ? (inputFormat === "ttml" ? "ttml" : "lrc") : rawFormatChoice

    const translatedText = effectiveRawFormat === "ttml" ? translatedTtml : translatedLrc
    const romanizedText = effectiveRawFormat === "ttml" ? romanizedTtml : romanizedLrc
    const bilingualText = effectiveRawFormat === "ttml" ? bilingualTtml : bilingualLrc

    return {
      translatedText,
      romanizedText,
      bilingualText,
      translatedLrc,
      romanizedLrc,
      bilingualLrc,
      translatedTtml,
      romanizedTtml,
      bilingualTtml,
      lines,
    }
  }, [result, parsedLines, inputText, inputFormat, keepTimestamps, rawFormatChoice])

  const handleCopy = async (type: "translated" | "romanized" | "bilingual" | "single", textVal?: string) => {
    let textToCopy = ""
    if (type === "translated") textToCopy = formattedOutput.translatedText
    else if (type === "romanized") textToCopy = formattedOutput.romanizedText
    else if (type === "bilingual") textToCopy = formattedOutput.bilingualText
    else if (type === "single" && textVal) textToCopy = textVal

    if (!textToCopy) return
    await navigator.clipboard.writeText(textToCopy)
    setCopiedType(type + (textVal ? `-${textVal}` : ""))
    setTimeout(() => setCopiedType(null), 1500)
  }

  const handleDownload = (type: "translated" | "romanized" | "bilingual") => {
    let text = ""
    let ext = "txt"
    let suffix = "_translated"

    const isTtml = inputFormat === "ttml" && rawFormatChoice !== "lrc" && rawFormatChoice !== "plain"

    if (type === "translated") {
      text = (isTtml ? formattedOutput.translatedTtml : formattedOutput.translatedLrc) || ""
      suffix = `_${targetLang}`
      ext = isTtml ? "ttml" : hasTimestamps && keepTimestamps ? "lrc" : "txt"
    } else if (type === "romanized") {
      text = (isTtml ? formattedOutput.romanizedTtml : formattedOutput.romanizedLrc) || ""
      suffix = "_romanized"
      ext = isTtml ? "ttml" : hasTimestamps && keepTimestamps ? "lrc" : "txt"
    } else {
      text = (isTtml ? formattedOutput.bilingualTtml : formattedOutput.bilingualLrc) || ""
      suffix = "_bilingual"
      ext = isTtml ? "ttml" : hasTimestamps && keepTimestamps ? "lrc" : "txt"
    }

    const mime = isTtml ? "application/xml;charset=utf-8" : "text/plain;charset=utf-8"
    const blob = new Blob([text], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `lyrics${suffix}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleSwap = () => {
    if (sourceLang === "auto") {
      if (result?.detectedLang) {
        setSourceLang(targetLang)
        setTargetLang(result.detectedLang)
      }
      return
    }
    setSourceLang(targetLang)
    setTargetLang(sourceLang)
  }

  const detectedLangName = useMemo(() => {
    if (!result?.detectedLang) return null
    return formatLanguageName(result.detectedLang)
  }, [result])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-unison-text">Translate</h1>
          <p className="text-sm text-unison-text-secondary mt-1">
            Translate and romanize lyrics across 130+ languages, preserving TTML markup and LRC timing tags.
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setInputText(SAMPLE_LRC)}
            className={HEADER_ACTION_CLASS}
            title="Load sample LRC"
          >
            <span>LRC Sample</span>
          </button>
          <button
            type="button"
            onClick={() => setInputText(SAMPLE_TTML)}
            className={HEADER_ACTION_CLASS}
            title="Load sample TTML"
          >
            <span>TTML Sample</span>
          </button>
          {inputText && (
            <button
              type="button"
              onClick={() => {
                setInputText("")
                setResult(null)
                setError(null)
              }}
              className={cn(HEADER_ACTION_CLASS, "hover:text-red-400")}
              title="Clear input"
            >
              <IconTrash className="size-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Language Bar & Action Controls */}
      <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-unison-border bg-unison-bg-elevated flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-unison-text-secondary whitespace-nowrap">From</span>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              aria-label="Source language"
              className="w-36 sm:w-44 rounded-md border border-unison-border bg-unison-bg px-2 py-1 text-xs text-unison-text-secondary hover:text-unison-text focus:border-unison-border-strong focus:outline-none cursor-pointer truncate"
            >
              <option value="auto">Auto-detect</option>
              <optgroup label="Popular Languages">
                {POPULAR_TRANSLATE_LANGUAGES.map((l) => (
                  <option key={`src-pop-${l.code}`} value={l.code}>
                    {l.native && l.native !== l.name ? `${l.name} (${l.native})` : l.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="All Languages (130+)">
                {TRANSLATE_LANGUAGES.map((l) => (
                  <option key={`src-all-${l.code}`} value={l.code}>
                    {l.native && l.native !== l.name ? `${l.name} (${l.native})` : l.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <button
            type="button"
            onClick={handleSwap}
            title="Swap languages"
            className={HEADER_ACTION_CLASS}
          >
            <IconArrowsExchange className="size-3.5" />
          </button>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-unison-text-secondary whitespace-nowrap">To</span>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              aria-label="Target language"
              className="w-36 sm:w-44 rounded-md border border-unison-border bg-unison-bg px-2 py-1 text-xs font-medium text-unison-text hover:text-unison-text focus:border-unison-border-strong focus:outline-none cursor-pointer truncate"
            >
              <optgroup label="Popular Languages">
                {POPULAR_TRANSLATE_LANGUAGES.map((l) => (
                  <option key={`tgt-pop-${l.code}`} value={l.code}>
                    {l.native && l.native !== l.name ? `${l.name} (${l.native})` : l.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="All Languages (130+)">
                {TRANSLATE_LANGUAGES.map((l) => (
                  <option key={`tgt-all-${l.code}`} value={l.code}>
                    {l.native && l.native !== l.name ? `${l.name} (${l.native})` : l.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-1.5 text-xs text-unison-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={keepTimestamps}
              onChange={(e) => setKeepTimestamps(e.target.checked)}
              className="rounded border-unison-border bg-unison-bg text-red-600 focus:ring-0 cursor-pointer"
            />
            <span className="hidden sm:inline">Preserve timestamps</span>
            <span className="sm:hidden">Timestamps</span>
          </label>

          <button
            type="button"
            disabled={loading || !inputText.trim()}
            onClick={() => handleTranslate()}
            className="flex items-center justify-center gap-1.5 rounded-md bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-unison-text shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.07)] transition-colors hover:bg-white/[0.12] active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <IconLoader2 className="size-3.5 animate-spin" />
            ) : (
              <IconLanguage className="size-3.5 text-unison-text-secondary" />
            )}
            <span>Translate</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => handleTranslate()}
            className="font-medium underline hover:no-underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Dual-Pane Grid */}
      <div className="grid gap-4 sm:grid-cols-2 min-w-0">
        {/* Left Pane: Source */}
        <div className="overflow-hidden rounded-lg border border-unison-border bg-unison-bg-elevated flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-unison-border/60 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-unison-text-secondary">Source Lyrics</span>
              {inputFormat !== "plain" && (
                <span className="rounded bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.2 text-[10px] font-mono text-unison-text-secondary uppercase">
                  {inputFormat}
                </span>
              )}
            </div>
            <span className="text-[11px] text-unison-text-muted">
              {parsedLines.filter((p) => !p.isBlank).length} lines
            </span>
          </div>

          {/* Input Textarea */}
          <div className="p-3 flex-1 min-h-[460px]">
            <textarea
              rows={16}
              required
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste TTML XML, LRC, or plain lyrics here..."
              className="w-full h-full min-h-[440px] bg-transparent border-0 font-mono text-xs text-unison-text placeholder:text-unison-text-muted focus:outline-none resize-none leading-relaxed"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Right Pane: Translation Output */}
        <div className="overflow-hidden rounded-lg border border-unison-border bg-unison-bg-elevated flex flex-col min-w-0">
          {/* Toolbar Header */}
          <div className="flex items-center justify-between border-b border-unison-border/60 px-3 py-2 flex-wrap gap-2 min-h-[41px]">
            {/* Mode Toggle */}
            <fieldset className="inline-flex rounded-md border border-unison-border bg-unison-bg p-0.5 shrink-0">
              <legend className="sr-only">Translation output mode</legend>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={cn(
                  "cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  viewMode === "cards"
                    ? "bg-unison-bg-hover text-unison-text"
                    : "text-unison-text-muted hover:text-unison-text",
                )}
              >
                Synced
              </button>
              <button
                type="button"
                onClick={() => setViewMode("raw")}
                className={cn(
                  "cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  viewMode === "raw"
                    ? "bg-unison-bg-hover text-unison-text"
                    : "text-unison-text-muted hover:text-unison-text",
                )}
              >
                Raw
              </button>
              <button
                type="button"
                onClick={() => setViewMode("bilingual")}
                className={cn(
                  "cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  viewMode === "bilingual"
                    ? "bg-unison-bg-hover text-unison-text"
                    : "text-unison-text-muted hover:text-unison-text",
                )}
              >
                Bilingual
              </button>
            </fieldset>

            {/* Action Buttons */}
            {result && (
              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                {detectedLangName && (
                  <span className="text-[11px] text-unison-text-muted mr-1 hidden lg:inline">
                    {detectedLangName}
                    {result.cached && " (cached)"}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handleCopy("translated")}
                  className={HEADER_ACTION_CLASS}
                  title="Copy translated output"
                >
                  {copiedType === "translated" ? (
                    <IconCheck className="size-3.5 text-emerald-400" />
                  ) : (
                    <IconCopy className="size-3.5" />
                  )}
                  <span>Copy</span>
                </button>

                {result.romanized && (
                  <button
                    type="button"
                    onClick={() => handleCopy("romanized")}
                    className={HEADER_ACTION_CLASS}
                    title="Copy romanized lyrics"
                  >
                    {copiedType === "romanized" ? (
                      <IconCheck className="size-3.5 text-emerald-400" />
                    ) : (
                      <IconCopy className="size-3.5" />
                    )}
                    <span>Romanized</span>
                  </button>
                )}

                {inputFormat === "ttml" && viewMode === "raw" && (
                  <select
                    value={rawFormatChoice}
                    onChange={(e) => setRawFormatChoice(e.target.value as any)}
                    className="w-18 rounded border border-unison-border bg-unison-bg px-1.5 py-0.5 text-xs text-unison-text-secondary truncate"
                  >
                    <option value="auto">TTML</option>
                    <option value="lrc">LRC</option>
                    <option value="plain">Plain</option>
                  </select>
                )}

                <button
                  type="button"
                  onClick={() => handleDownload("translated")}
                  className={HEADER_ACTION_CLASS}
                  title="Download output file"
                >
                  <IconDownload className="size-3.5" />
                  <span>Download</span>
                </button>
              </div>
            )}
          </div>

          {/* Output Body */}
          <div className="p-3 flex-1 min-h-[460px] max-h-[500px] overflow-y-auto font-mono text-xs">
            {!result ? (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-unison-text-muted text-center space-y-1">
                <IconLanguage className="size-8 opacity-25" />
                <p className="text-xs">Translation will appear here</p>
              </div>
            ) : viewMode === "raw" ? (
              <textarea
                readOnly
                value={formattedOutput.translatedText}
                className="w-full h-full min-h-[440px] bg-transparent border-0 font-mono text-xs text-unison-text focus:outline-none resize-none leading-relaxed"
              />
            ) : viewMode === "bilingual" ? (
              <div className="space-y-3">
                {formattedOutput.lines.map((line) => {
                  if (line.isHeader) {
                    return (
                      <div key={line.id} className="text-unison-text-muted/60 text-[11px]">
                        {line.translated}
                      </div>
                    )
                  }
                  return (
                    <div
                      key={line.id}
                      className="p-2 rounded bg-white/[0.02] border border-white/[0.04] space-y-0.5"
                    >
                      <p className="text-unison-text-muted text-[11.5px]">{line.original}</p>
                      <p className="text-unison-text">{line.translated}</p>
                      {line.romanized && line.romanized !== line.translated && (
                        <p className="text-unison-text-secondary/80 text-[11.5px]">{line.romanized}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              /* Synced Cards View */
              <div className="space-y-1.5">
                {formattedOutput.lines.map((line, idx) => {
                  const origParsed = parsedLines[idx]
                  if (line.isHeader) {
                    return (
                      <div
                        key={line.id}
                        className="px-1.5 py-0.5 text-[11px] text-unison-text-muted/60 font-mono select-none"
                      >
                        {line.translated}
                      </div>
                    )
                  }
                  return (
                    <div
                      key={line.id}
                      className="group relative p-2 rounded bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-colors space-y-0.5"
                    >
                      {origParsed && origParsed.text && (
                        <div className="text-[11px] text-unison-text-muted flex items-center gap-1.5">
                          {origParsed.timestamps && (
                            <span className="text-unison-text-muted/60">{origParsed.timestamps}</span>
                          )}
                          <span>{origParsed.text}</span>
                        </div>
                      )}

                      <p className="text-unison-text leading-relaxed">{line.translated}</p>

                      {line.romanized && line.romanized !== line.translated && (
                        <p className="text-[11.5px] text-unison-text-secondary/80 font-mono">
                          {line.romanized}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCopy("single", line.translated)}
                        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10 text-unison-text-muted hover:text-unison-text cursor-pointer"
                        title="Copy line"
                      >
                        {copiedType === `single-${line.translated}` ? (
                          <IconCheck className="size-3 text-emerald-400" />
                        ) : (
                          <IconCopy className="size-3" />
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
