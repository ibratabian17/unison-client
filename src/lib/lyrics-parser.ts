import { prettyTtml } from "@braccato/highlight"
import type { LyricsFormat } from "./types"

export interface TtmlSongMetadata {
  song: string | null
  artist: string | null
  album: string | null
  isrc: string | null
  videoId: string | null
  duration: number | null
}

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
    isrc?: string
    videoId?: string
    duration?: number
  }
}

const ISRC_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/
const VIDEO_ID_PATTERN = /^[\w-]{11}$/

const LAYOUT_WHITESPACE =
  /\s+(?=<(?:head|body|\/head|\/body|\/tt|div|\/div)[\s>]|<(?:p|ttm:agent|iTunesMetadata)[\s>/])/g

export function detectFormat(lyrics: string): LyricsFormat {
  const trimmed = lyrics.trim()
  if (
    /^<[\w.-]*:?tt[\s>]/i.test(trimmed) ||
    trimmed.startsWith("<?xml") ||
    trimmed.includes("http://www.w3.org/ns/ttml") ||
    /<(?:[\w.-]+:)?tt[\s>]/i.test(trimmed) ||
    /<p\b[^>]*\bbegin=/i.test(trimmed)
  ) {
    return "ttml"
  }
  if (/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/.test(trimmed)) {
    return "lrc"
  }
  return "plain"
}

export function compactTtml(src: string): string {
  return src.replace(LAYOUT_WHITESPACE, "")
}

export function readableTtml(src: string): { text: string; readable: boolean } {
  if (detectFormat(src) !== "ttml") return { text: src, readable: false }
  try {
    const pretty = prettyTtml(src)
    if (pretty === src || compactTtml(pretty) !== src) return { text: src, readable: false }
    return { text: pretty, readable: true }
  } catch {
    return { text: src, readable: false }
  }
}

export function isReadableLayout(text: string): boolean {
  const layout = readableTtml(compactTtml(text))
  return layout.readable && layout.text === text
}

export function lyricsForSave(text: string, original?: string): string {
  if (text === original) return text
  const compact = isReadableLayout(text) || (original !== undefined && readableTtml(original).readable)
  const source = compact ? compactTtml(text) : text
  return source === original ? source : source.trim()
}

export function parseDurationInput(value: string): number {
  const trimmed = value.replace(",", ".").trim()
  if (!trimmed) return 0
  const seconds = trimmed
    .split(":")
    .reduce((total, part) => total * 60 + Number(part), 0)
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0
}

/**
 * Extracts song, artist, album, isrc, videoId, and duration from TTML <head><metadata>
 * (supporting both unprefixed and namespace-prefixed TTML roots, matching Better Lyrics ttmlMetadata.ts).
 */
export function readTtmlMetadata(text: string): TtmlSongMetadata {
  const empty: TtmlSongMetadata = {
    song: null,
    artist: null,
    album: null,
    isrc: null,
    videoId: null,
    duration: null,
  }
  if (!/<(?:[\w.-]+:)?tt[\s>]/i.test(text)) return empty

  try {
    if (typeof DOMParser !== "undefined") {
      const doc = new DOMParser().parseFromString(text, "text/xml")
      if (!doc.querySelector("parsererror")) {
        const allElements = Array.from(doc.getElementsByTagName("*"))
        const localNameOf = (el: Element) => (el.localName || el.tagName.split(":").pop() || "").toLowerCase()

        const titleEl = allElements.find((el) => localNameOf(el) === "title" && el.textContent?.trim())
        const descEl = allElements.find((el) => localNameOf(el) === "desc" && el.textContent?.trim())

        const metaEls = allElements.filter((el) => localNameOf(el) === "meta")
        const metaValues = (...keys: string[]): string[] => {
          const lowerKeys = keys.map((k) => k.toLowerCase())
          const out: string[] = []
          for (const el of metaEls) {
            const keyAttr =
              el.getAttribute("key") ||
              Array.from(el.attributes).find((a) => a.localName?.toLowerCase() === "key")?.value ||
              ""
            if (!lowerKeys.includes(keyAttr.toLowerCase())) continue
            const valAttr =
              el.getAttribute("value") ||
              Array.from(el.attributes).find((a) => a.localName?.toLowerCase() === "value")?.value ||
              el.textContent ||
              ""
            const clean = valAttr.trim()
            if (clean) out.push(clean)
          }
          return out
        }

        const song = titleEl?.textContent?.trim() || metaValues("musicname", "title", "song")[0] || null
        const artists = metaValues("artists", "artist")
        const artist = artists.length > 0 ? artists.join(", ") : null
        const album = metaValues("album")[0] || descEl?.textContent?.trim() || null
        const isrc =
          metaValues("isrc")
            .map((v) => v.toUpperCase().replace(/[\s-]/g, ""))
            .find((v) => ISRC_PATTERN.test(v)) ?? null
        const rawVid = metaValues("ytvideoid", "videoid")[0]
        const videoId = rawVid && VIDEO_ID_PATTERN.test(rawVid) ? rawVid : null

        const bodyEl = allElements.find((el) => localNameOf(el) === "body")
        const ttEl = allElements.find((el) => localNameOf(el) === "tt")
        const durAttr = (bodyEl?.getAttribute("dur") || ttEl?.getAttribute("dur") || "").trim()
        let duration: number | null = durAttr ? parseDurationInput(durAttr) || null : null

        if (!duration) {
          const endMatches = Array.from(text.matchAll(/\bend="(\d{1,2}):(\d{2})(?:\.(\d+))?"/gi))
          let maxSec = 0
          for (const m of endMatches) {
            const sec = Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(`0.${m[3]}`) : 0)
            if (sec > maxSec) maxSec = sec
          }
          if (maxSec > 0) duration = Math.ceil(maxSec)
        }

        return { song, artist, album, isrc, videoId, duration }
      }
    }
  } catch {
    // Fall back to regex extraction below
  }

  // Regex fallback for environments without DOMParser or slightly malformed XML
  const titleMatch = text.match(/<(?:[\w.-]+:)?title>([^<]+)<\/(?:[\w.-]+:)?title>/i)
  const descMatch = text.match(/<(?:[\w.-]+:)?desc>([^<]+)<\/(?:[\w.-]+:)?desc>/i)

  const readMetaRegex = (...keys: string[]): string[] => {
    const out: string[] = []
    const re = /<(?:[\w.-]+:)?meta\b[^>]*>/gi
    for (const m of text.matchAll(re)) {
      const tag = m[0]
      const k = tag.match(/\bkey\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()
      const v = tag.match(/\bvalue\s*=\s*["']([^"']+)["']/i)?.[1]?.trim()
      if (k && v && keys.includes(k)) out.push(v)
    }
    return out
  }

  const song = titleMatch?.[1]?.trim() || readMetaRegex("musicname", "title", "song")[0] || null
  const artists = readMetaRegex("artists", "artist")
  const artist = artists.length > 0 ? artists.join(", ") : null
  const album = readMetaRegex("album")[0] || descMatch?.[1]?.trim() || null
  const isrc =
    readMetaRegex("isrc")
      .map((v) => v.toUpperCase().replace(/[\s-]/g, ""))
      .find((v) => ISRC_PATTERN.test(v)) ?? null
  const rawVid = readMetaRegex("ytvideoid", "videoid")[0]
  const videoId = rawVid && VIDEO_ID_PATTERN.test(rawVid) ? rawVid : null

  const durMatch = text.match(/<(?:body|tt)\b[^>]*\bdur="([^"]+)"/i)
  let duration: number | null = durMatch ? parseDurationInput(durMatch[1]) || null : null
  if (!duration) {
    const endMatches = Array.from(text.matchAll(/\bend="(\d{1,2}):(\d{2})(?:\.(\d+))?"/gi))
    let maxSec = 0
    for (const m of endMatches) {
      const sec = Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(`0.${m[3]}`) : 0)
      if (sec > maxSec) maxSec = sec
    }
    if (maxSec > 0) duration = Math.ceil(maxSec)
  }

  return { song, artist, album, isrc, videoId, duration }
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
    if (!/<(?:[\w.-]+:)?tt[\s>]/i.test(trimmed)) {
      errors.push("Invalid TTML: Missing root <tt> element")
    }
    const paragraphMatches = trimmed.match(/<(?:[\w.-]+:)?p\b[^>]*>/gi)
    timedCount = paragraphMatches ? paragraphMatches.length : 0
    if (timedCount === 0) {
      warnings.push('No <p begin="..."> timed paragraph elements found in TTML')
    }

    const ttmlMeta = readTtmlMetadata(trimmed)
    if (ttmlMeta.song) extractedMeta.song = ttmlMeta.song
    if (ttmlMeta.artist) extractedMeta.artist = ttmlMeta.artist
    if (ttmlMeta.album) extractedMeta.album = ttmlMeta.album
    if (ttmlMeta.isrc) extractedMeta.isrc = ttmlMeta.isrc
    if (ttmlMeta.videoId) extractedMeta.videoId = ttmlMeta.videoId
    if (ttmlMeta.duration) extractedMeta.duration = ttmlMeta.duration
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
      const isrcMatch = line.match(/^\[isrc:(.+)\]$/i)
      if (isrcMatch) {
        const cleanIsrc = isrcMatch[1].trim().toUpperCase().replace(/[\s-]/g, "")
        if (ISRC_PATTERN.test(cleanIsrc)) extractedMeta.isrc = cleanIsrc
      }
      const lenMatch = line.match(/^\[length:(\d+:\d+(?:\.\d+)?)\]$/i)
      if (lenMatch) {
        const d = parseDurationInput(lenMatch[1])
        if (d > 0) extractedMeta.duration = d
      }

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
