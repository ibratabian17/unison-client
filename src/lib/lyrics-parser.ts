import type { LyricsFormat } from "./types"

export interface ParseLyricsResult {
  format: LyricsFormat
  lineCount: number
  timedLineCount: number
  errors: string[]
  warnings: string[]
  extractedMeta: {
    song?: string
    artist?: string
    album?: string
    duration?: number
  }
}

export function detectFormat(lyrics: string): LyricsFormat {
  const trimmed = lyrics.trim()
  if (trimmed.startsWith("<tt") || trimmed.includes("http://www.w3.org/ns/ttml") || trimmed.includes("<p begin=")) {
    return "ttml"
  }
  if (/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/.test(trimmed)) {
    return "lrc"
  }
  return "plain"
}

export function parseAndValidateLyrics(raw: string): ParseLyricsResult {
  const trimmed = raw.trim()
  const errors: string[] = []
  const warnings: string[] = []
  const extractedMeta: ParseLyricsResult["extractedMeta"] = {}

  if (!trimmed) {
    return {
      format: "plain",
      lineCount: 0,
      timedLineCount: 0,
      errors: ["Lyrics content is empty"],
      warnings: [],
      extractedMeta,
    }
  }

  const format = detectFormat(trimmed)
  const lines = trimmed.split(/\r?\n/)
  let timedCount = 0

  if (format === "ttml") {
    // Validate XML structure
    if (!trimmed.includes("</tt>") && !trimmed.includes("<tt")) {
      errors.push("Invalid TTML: Missing root <tt> element")
    }
    const paragraphMatches = trimmed.match(/<p\b[^>]*>/gi)
    timedCount = paragraphMatches ? paragraphMatches.length : 0
    if (timedCount === 0) {
      warnings.push("No <p begin=\"...\"> timed paragraph elements found in TTML")
    }

    // Extract title / metadata if available in TTML metadata
    const titleMatch = trimmed.match(/<ttm:title>([^<]+)<\/ttm:title>/i)
    if (titleMatch) extractedMeta.song = titleMatch[1].trim()
    const descMatch = trimmed.match(/<ttm:desc>([^<]+)<\/ttm:desc>/i)
    if (descMatch) extractedMeta.album = descMatch[1].trim()
  } else if (format === "lrc") {
    let lastTime = -1

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Check header tags
      const tiMatch = line.match(/^\[ti:(.+)\]$/i)
      if (tiMatch) extractedMeta.song = tiMatch[1].trim()
      const arMatch = line.match(/^\[ar:(.+)\]$/i)
      if (arMatch) extractedMeta.artist = arMatch[1].trim()
      const alMatch = line.match(/^\[al:(.+)\]$/i)
      if (alMatch) extractedMeta.album = alMatch[1].trim()
      const lenMatch = line.match(/^\[length:(\d+):(\d+)\]$/i)
      if (lenMatch) extractedMeta.duration = Number(lenMatch[1]) * 60 + Number(lenMatch[2])

      // Check timestamp line
      const tsMatch = line.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)$/)
      if (tsMatch) {
        timedCount++
        const min = Number(tsMatch[1])
        const sec = Number(tsMatch[2])
        const ms = tsMatch[3] ? Number(tsMatch[3].padEnd(3, "0").slice(0, 3)) : 0
        const totalSec = min * 60 + sec + ms / 1000

        if (totalSec < lastTime) {
          warnings.push(`Timestamp on line ${i + 1} (${tsMatch[1]}:${tsMatch[2]}) is out of chronological order`)
        }
        lastTime = totalSec
      }
    }

    if (timedCount === 0) {
      warnings.push("No [mm:ss.xx] timestamps found in LRC file")
    }
  } else {
    // Plain text
    warnings.push("Unsynchronized plain text lyrics (timestamps missing)")
  }

  return {
    format,
    lineCount: lines.filter((l) => l.trim().length > 0).length,
    timedLineCount: timedCount,
    errors,
    warnings,
    extractedMeta,
  }
}
