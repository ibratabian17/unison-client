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
  if (
    trimmed.startsWith("<tt") ||
    trimmed.startsWith("<?xml") ||
    trimmed.includes("http://www.w3.org/ns/ttml") ||
    /<p\b[^>]*\bbegin=/i.test(trimmed)
  ) {
    return "ttml"
  }
  if (/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/.test(trimmed)) {
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
    if (!trimmed.includes("</tt>") && !trimmed.includes("<tt")) {
      errors.push("Invalid TTML: Missing root <tt> element")
    }
    const paragraphMatches = trimmed.match(/<p\b[^>]*>/gi)
    timedCount = paragraphMatches ? paragraphMatches.length : 0
    if (timedCount === 0) {
      warnings.push('No <p begin="..."> timed paragraph elements found in TTML')
    }

    const titleMatch = trimmed.match(/<ttm:title>([^<]+)<\/ttm:title>/i)
    if (titleMatch) extractedMeta.song = titleMatch[1].trim()
    const descMatch = trimmed.match(/<ttm:desc>([^<]+)<\/ttm:desc>/i)
    if (descMatch) extractedMeta.album = descMatch[1].trim()

    const durMatch = trimmed.match(/<body\b[^>]*\bdur="(\d{1,2}):(\d{2})(?:\.(\d+))?"/i)
    if (durMatch) {
      extractedMeta.duration = Math.round(
        Number(durMatch[1]) * 60 + Number(durMatch[2]) + (durMatch[3] ? Number(`0.${durMatch[3]}`) : 0),
      )
    } else {
      const endMatches = Array.from(trimmed.matchAll(/\bend="(\d{1,2}):(\d{2})(?:\.(\d+))?"/gi))
      if (endMatches.length > 0) {
        let maxSec = 0
        for (const m of endMatches) {
          const sec = Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(`0.${m[3]}`) : 0)
          if (sec > maxSec) maxSec = sec
        }
        if (maxSec > 0) extractedMeta.duration = Math.ceil(maxSec)
      }
    }
  } else if (format === "lrc") {
    let maxTime = 0
    let lastSingleLineTime = -1
    let outOfOrderWarned = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const tiMatch = line.match(/^\[ti:(.+)\]$/i)
      if (tiMatch) extractedMeta.song = tiMatch[1].trim()
      const arMatch = line.match(/^\[ar:(.+)\]$/i)
      if (arMatch) extractedMeta.artist = arMatch[1].trim()
      const alMatch = line.match(/^\[al:(.+)\]$/i)
      if (alMatch) extractedMeta.album = alMatch[1].trim()
      const lenMatch = line.match(/^\[length:(\d+):(\d+)\]$/i)
      if (lenMatch) extractedMeta.duration = Number(lenMatch[1]) * 60 + Number(lenMatch[2])

      // Support single or multiple [mm:ss.xx] / [mm:ss:xx] timestamps on the same LRC line
      const tagMatches = Array.from(line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g))
      if (tagMatches.length > 0) {
        timedCount += tagMatches.length
        for (const m of tagMatches) {
          const min = Number(m[1])
          const sec = Number(m[2])
          const ms = m[3] ? Number(m[3].padEnd(3, "0").slice(0, 3)) : 0
          const totalSec = min * 60 + sec + ms / 1000
          if (totalSec > maxTime) maxTime = totalSec
        }

        // Only check chronological order on single-timestamp lines so multi-timestamp chorus lines ([00:10][01:20]) don't false-warn
        if (tagMatches.length === 1) {
          const m = tagMatches[0]
          const min = Number(m[1])
          const sec = Number(m[2])
          const ms = m[3] ? Number(m[3].padEnd(3, "0").slice(0, 3)) : 0
          const totalSec = min * 60 + sec + ms / 1000
          if (totalSec < lastSingleLineTime && !outOfOrderWarned) {
            outOfOrderWarned = true
            warnings.push(`Timestamp on line ${i + 1} (${m[1]}:${m[2]}) is out of chronological order`)
          }
          lastSingleLineTime = totalSec
        }
      }
    }

    if (!extractedMeta.duration && maxTime > 0) {
      extractedMeta.duration = Math.ceil(maxTime)
    }

    if (timedCount === 0) {
      warnings.push("No [mm:ss.xx] timestamps found in LRC file")
    }
  } else {
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

export function extractVideoId(input: string): string {
  const trimmed = input.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed
  const urlMatch = trimmed.match(/(?:v=|\/embed\/|\.be\/|\/v\/|watch\?v=|\/shorts\/)([a-zA-Z0-9_-]{11})/)
  return urlMatch ? urlMatch[1] : trimmed
}
