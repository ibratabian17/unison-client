import { prettyTtml } from "@braccato/highlight"
import type { LyricsFormat } from "./types"
import { videoIdFromInput } from "./youtube-music"

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
  syncType: "richsync" | "linesync" | "plain"
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

export type XmlProblem = { message: string; line: number; column: number }

export const ISRC_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/
export const ISRC_HINT =
  "That doesn't look like an ISRC. It's 12 letters and numbers, like USRC17607839. Leave it blank if you don't have one."

export function normalizeIsrc(input: string): string | null {
  const candidate = input.normalize("NFKC").replace(/[\s-]/g, "").toUpperCase()
  return ISRC_PATTERN.test(candidate) ? candidate : null
}

const LAYOUT_WHITESPACE =
  /\s+(?=<(?:head|body|\/head|\/body|\/tt|div|\/div)[\s>]|<(?:p|ttm:agent|iTunesMetadata)[\s>/])/g

const NON_XML_CHAR = /[^\t\n\r\x20-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u
const NON_TAG_MARKUP = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>/g
const TAG = /<([^\s/>!?][^\s/>]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<\/([^>\s]+)\s*>/g
const ATTRIBUTE_NAME = /([^\s=]+)\s*=\s*(?:"[^"]*"|'[^']*')/g
const UNDEFINED_ENTITY = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)[^;\s<&]+;/
const TEXT_AFTER_ROOT = "The file has text after the closing </tt> tag. Remove everything after </tt>"

const STANDARD_NAMESPACES: Record<string, string> = {
  itunes: "http://music.apple.com/lyric-ttml-internal",
  ttm: "http://www.w3.org/ns/ttml#metadata",
  tts: "http://www.w3.org/ns/ttml#styling",
  ttp: "http://www.w3.org/ns/ttml#parameter",
  amll: "http://www.example.com/ns/amll",
  composer: "https://composer.betterlyrics.org/ttml",
}

const ROOT_TT_TAG_REGEX = /<(?:[\w.-]+:)?tt\b[^>]*>/
const DECLARED_PREFIX_REGEX = /xmlns:([A-Za-z][\w.-]*)\s*=/g
const ELEMENT_PREFIX_REGEX = /<\/?([A-Za-z][\w.-]*):/g
const ATTRIBUTE_PREFIX_REGEX = /\s([A-Za-z][\w.-]*):[\w.-]+\s*=/g

export const LRC_WORD_TAG = /<\d{1,2}:\d{2}[.:]\d{2,3}>/
export const LRC_LINE_TAG = /\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/

function positionOf(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index)
  const line = before.split("\n").length
  return { line, column: index - before.lastIndexOf("\n") }
}

function problemAt(text: string, index: number, message: string): XmlProblem {
  return { message, ...positionOf(text, index) }
}

export function missingRootPrefixes(ttml: string): string[] {
  const rootTag = ttml.match(ROOT_TT_TAG_REGEX)?.[0] ?? ""
  const declared = new Set<string>(["xml", "xmlns"])
  for (const match of rootTag.matchAll(DECLARED_PREFIX_REGEX)) {
    declared.add(match[1])
  }

  const used = [...ttml.matchAll(ELEMENT_PREFIX_REGEX), ...ttml.matchAll(ATTRIBUTE_PREFIX_REGEX)]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((match) => match[1])
  return [...new Set(used)].filter((p) => !declared.has(p))
}

export function declareStandardPrefixes(ttml: string): string | null {
  const missing = missingRootPrefixes(ttml)
  if (missing.some((prefix) => !Object.hasOwn(STANDARD_NAMESPACES, prefix))) return null
  if (missing.length === 0) return ttml
  const declarations = missing.map((prefix) => ` xmlns:${prefix}="${STANDARD_NAMESPACES[prefix]}"`)
  return ttml.replace(/<((?:[\w.-]+:)?tt)(?=[\s>])/, `<$1${declarations.join("")}`)
}

function declareMissingNamespaces(ttml: string): string {
  const rootMatch = ttml.match(ROOT_TT_TAG_REGEX)
  if (!rootMatch) return ttml
  const rootTag = rootMatch[0]
  const missing = missingRootPrefixes(ttml)
  if (missing.length === 0) return ttml
  const additions = missing
    .map((p) => ` xmlns:${p}="${STANDARD_NAMESPACES[p] ?? `urn:unison:unbound:${p}`}"`)
    .join("")
  const patched = rootTag.replace(/\/?>$/, (end) => `${additions}${end}`)
  return ttml.replace(rootTag, patched)
}

function stripOutsideRoot(ttml: string): string | null {
  const root = ttml.search(/<(?:[\w.-]+:)?tt[\s>]/i)
  if (root < 0) return null
  const closeMatch = /<\/(?:[\w.-]+:)?tt\s*>/i.exec(ttml.slice(root))
  if (!closeMatch) return null
  const end = root + closeMatch.index + closeMatch[0].length
  const declaration = ttml.lastIndexOf("<?xml", root)
  return ttml.slice(declaration >= 0 ? declaration : root, end)
}

export function findXmlProblem(xml: string): XmlProblem | null {
  const badChar = NON_XML_CHAR.exec(xml)
  if (badChar && badChar.index !== undefined) {
    const code = badChar[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")
    return problemAt(xml, badChar.index, `The file contains an invalid control character (U+${code})`)
  }

  const fence = xml.indexOf("```")
  const rootStart = xml.search(/<(?:[\w.-]+:)?tt[\s>]/i)
  const lastClose = xml.search(/<\/(?:[\w.-]+:)?tt\s*>/i)
  const fenceOutsideRoot = fence >= 0 && (rootStart < 0 || fence < rootStart || (lastClose >= 0 && fence > lastClose))
  if (fenceOutsideRoot) {
    return problemAt(
      xml,
      fence,
      "The file is wrapped in a ``` code fence. Remove the fence so the file starts with <tt> and ends with </tt>",
    )
  }

  const start = xml.search(/[^\s\uFEFF]/)
  if (start >= 0 && xml[start] !== "<") {
    return problemAt(
      xml,
      start,
      "The file has text before the opening <tt> tag. Remove it so the file starts with <tt>",
    )
  }

  const closeTagMatch = /<\/(?:[\w.-]+:)?tt\s*>/i.exec(xml)
  if (closeTagMatch) {
    const afterRootIdx = closeTagMatch.index + closeTagMatch[0].length
    const trailing = xml.slice(afterRootIdx).search(/\S/)
    if (trailing >= 0) {
      return problemAt(xml, afterRootIdx + trailing, TEXT_AFTER_ROOT)
    }
  }

  const scopes = [new Set(["xml", "xmlns"])]
  const tagStack: Array<{ name: string; index: number }> = []
  const markup = xml.replace(NON_TAG_MARKUP, (skipped) => " ".repeat(skipped.length))
  let rootSeen = false

  for (const tag of markup.matchAll(TAG)) {
    const [, openName, attributeText, selfClosing, closeName] = tag
    const idx = tag.index ?? 0
    if (closeName !== undefined) {
      const expected = tagStack.pop()
      scopes.pop()
      if (!expected || expected.name !== closeName) {
        return problemAt(
          xml,
          idx,
          expected
            ? `Closing tag </${closeName}> does not match opening tag <${expected.name}>`
            : `Unexpected closing tag </${closeName}>`,
        )
      }
      continue
    }
    if (openName === undefined) continue
    if (scopes.length === 1 && rootSeen) return problemAt(xml, idx, TEXT_AFTER_ROOT)
    rootSeen = true
    const attributes = [...(attributeText ?? "").matchAll(ATTRIBUTE_NAME)].map((match) => match[1])
    const declared = attributes.filter((attr) => attr.startsWith("xmlns:"))
    const parent = scopes[scopes.length - 1]
    const scope = declared.length
      ? new Set([...parent, ...declared.map((attr) => attr.slice(6))])
      : parent
    for (const qualified of [openName, ...attributes]) {
      const colon = qualified.indexOf(":")
      const prefix = colon > 0 ? qualified.slice(0, colon) : null
      if (prefix && !scope.has(prefix)) {
        return problemAt(
          xml,
          idx,
          `"${qualified}" uses the prefix "${prefix}", but the file never declares it. Add xmlns:${prefix}="..." to the <tt> tag`,
        )
      }
    }
    if (!selfClosing) {
      scopes.push(scope)
      tagStack.push({ name: openName, index: idx })
    }
  }

  if (tagStack.length > 0) {
    const unclosed = tagStack[tagStack.length - 1]
    return problemAt(xml, unclosed.index, `Unclosed <${unclosed.name}> tag`)
  }

  if (!/<!DOCTYPE/i.test(xml)) {
    const entity = UNDEFINED_ENTITY.exec(markup)
    if (entity && entity.index !== undefined) {
      return problemAt(
        xml,
        entity.index,
        `The file uses the entity "${entity[0]}", which XML does not define. Write the character itself or a numeric reference such as &#160;`,
      )
    }
  }

  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(xml, "text/xml")
      const errEl = doc.querySelector("parsererror")
      if (errEl) {
        const rawErr = (errEl.textContent || "XML syntax error").replace(/\s+/g, " ").trim()
        const lineMatch = rawErr.match(/line\s+(\d+)/i)
        const colMatch = rawErr.match(/column\s+(\d+)/i)
        return {
          message: rawErr,
          line: lineMatch ? Number(lineMatch[1]) : 1,
          column: colMatch ? Number(colMatch[1]) : 1,
        }
      }
    } catch {
      // Ignore DOMParser unavailability
    }
  }

  return null
}

export function repairTtml(ttml: string): string | null {
  if (findXmlProblem(ttml) === null) return ttml
  const stripped = stripOutsideRoot(ttml)
  const repaired = stripped === null ? null : declareStandardPrefixes(stripped)
  return repaired !== null && findXmlProblem(repaired) === null ? repaired : null
}

export function validateTtmlStructure(ttml: string): boolean {
  const hasRoot = /<(?:[\w.-]+:)?tt[\s>]/i.test(ttml)
  const hasBody = /<(?:[\w.-]+:)?body[\s>]/i.test(ttml) || /<(?:[\w.-]+:)?body\s*\/>/i.test(ttml)
  const hasClosingTt = /<\/(?:[\w.-]+:)?tt\s*>/i.test(ttml)
  if (!hasRoot || !hasClosingTt) return false
  const divCount = (ttml.match(/<(?:[\w.-]+:)?div[\s>]/gi) || []).length
  const pCount = (ttml.match(/<(?:[\w.-]+:)?p[\s>]/gi) || []).length
  if (divCount === 0 && pCount === 0 && !hasBody) return false
  return true
}

export type PrettyPrintCheckResult =
  | { ok: true }
  | {
      ok: false
      reason: "inter-span-newline" | "span-trailing-whitespace" | "span-leading-whitespace"
    }

const INTER_SPAN_NEWLINE_REGEX = /<\/span>\s*[\r\n]\s*<span\b/i
const SPAN_TRAILING_WS_REGEX = /<span\b[^>]*>[^<]*?\S[ \t]+<\/span>\s*<span\b/i
const SPAN_LEADING_WS_REGEX = /<\/span>\s*<span\b[^>]*>[ \t]+\S[^<]*<\/span>/i

export function detectPrettyPrintedTtml(content: string): PrettyPrintCheckResult {
  if (INTER_SPAN_NEWLINE_REGEX.test(content)) {
    return { ok: false, reason: "inter-span-newline" }
  }
  if (SPAN_TRAILING_WS_REGEX.test(content)) {
    return { ok: false, reason: "span-trailing-whitespace" }
  }
  if (SPAN_LEADING_WS_REGEX.test(content)) {
    return { ok: false, reason: "span-leading-whitespace" }
  }
  return { ok: true }
}

export function prettyPrintHint(
  reason: "inter-span-newline" | "span-trailing-whitespace" | "span-leading-whitespace",
): string {
  switch (reason) {
    case "inter-span-newline":
      return "The TTML file has line breaks between word tags, which throws off the word-by-word timing. Try re-exporting without auto-formatting."
    case "span-trailing-whitespace":
      return "Some words in the TTML have extra spaces tacked onto the end, which throws off the highlighting. Try re-exporting from a clean source."
    case "span-leading-whitespace":
      return "Some words in the TTML start with extra spaces, which throws off the highlighting. Try re-exporting from a clean source."
  }
}

export function parseTtmlTime(value: string): number | null {
  const v = value.trim()
  const clock = v.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/)
  if (clock) {
    const hours = clock[1] ? Number(clock[1]) : 0
    const minutes = Number(clock[2])
    const seconds = Number(clock[3])
    const fraction = clock[4] ? Number(`0.${clock[4]}`) : 0
    return hours * 3600 + minutes * 60 + seconds + fraction
  }
  const offset = v.match(/^(\d+(?:\.\d+)?)(h|m|s|ms)$/)
  if (offset) {
    const n = Number(offset[1])
    switch (offset[2]) {
      case "h":
        return n * 3600
      case "m":
        return n * 60
      case "s":
        return n
      case "ms":
        return n / 1000
    }
  }
  return null
}

const RICHSYNC_MAX_ZERO_DURATION_RATIO = 0.2
const WORD_CHAR_REGEX = /[\p{L}\p{N}]/u

interface TtmlTiming {
  hasLineTiming: boolean
  sawWordSpan: boolean
  comparableWords: number
  positiveWords: number
}

function analyzeTtmlTiming(ttml: string): TtmlTiming {
  const hasLineTiming = /<(?:[\w.-]+:)?p\b[^>]*\b(?:begin|end)\s*=/i.test(ttml)
  let sawWordSpan = false
  let comparableWords = 0
  let positiveWords = 0

  const spanRegex = /<(?:[\w.-]+:)?span\b([^>]*)>([^<]*)<\/(?:[\w.-]+:)?span\s*>/gi
  for (const m of ttml.matchAll(spanRegex)) {
    const attrs = m[1] ?? ""
    const text = (m[2] ?? "").trim()
    const beginMatch = attrs.match(/\bbegin\s*=\s*["']([^"']+)["']/i)
    const endMatch = attrs.match(/\bend\s*=\s*["']([^"']+)["']/i)
    if (beginMatch && endMatch && WORD_CHAR_REGEX.test(text)) {
      sawWordSpan = true
      const b = parseTtmlTime(beginMatch[1])
      const e = parseTtmlTime(endMatch[1])
      if (b !== null && e !== null) {
        comparableWords++
        if (e > b) positiveWords++
      }
    }
  }

  return { hasLineTiming, sawWordSpan, comparableWords, positiveWords }
}

function hasDegenerateTiming(timing: TtmlTiming): boolean {
  if (timing.comparableWords === 0) return false
  const zeroDurationWords = timing.comparableWords - timing.positiveWords
  return zeroDurationWords / timing.comparableWords > RICHSYNC_MAX_ZERO_DURATION_RATIO
}

export function hasDegenerateWordTiming(content: string, format: LyricsFormat): boolean {
  if (format !== "ttml") return false
  const timing = analyzeTtmlTiming(content)
  return timing.sawWordSpan && hasDegenerateTiming(timing)
}

export function detectSyncType(
  content: string,
  format: LyricsFormat,
): "richsync" | "linesync" | "plain" {
  if (format === "ttml") {
    const timing = analyzeTtmlTiming(content)
    if (timing.sawWordSpan && !hasDegenerateTiming(timing)) return "richsync"
    if (timing.hasLineTiming || timing.sawWordSpan) return "linesync"
    return "plain"
  }
  if (format === "lrc") {
    if (LRC_WORD_TAG.test(content)) return "richsync"
    if (LRC_LINE_TAG.test(content)) return "linesync"
    return "plain"
  }
  return "plain"
}

export function detectFormat(lyrics: string): LyricsFormat {
  const trimmed = lyrics.trim()
  if (
    validateTtmlStructure(trimmed) ||
    /^<[\w.-]*:?tt[\s>]/i.test(trimmed) ||
    trimmed.startsWith("<?xml") ||
    trimmed.includes("http://www.w3.org/ns/ttml") ||
    /<(?:[\w.-]+:)?tt[\s>]/i.test(trimmed) ||
    /<p\b[^>]*\bbegin=/i.test(trimmed)
  ) {
    return "ttml"
  }
  if (LRC_WORD_TAG.test(trimmed) || LRC_LINE_TAG.test(trimmed)) {
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
    const patched = declareStandardPrefixes(src) ?? src
    const pretty = prettyTtml(patched)
    if (pretty === patched || compactTtml(pretty) !== patched) return { text: src, readable: false }
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
  let source = compact ? compactTtml(text) : text.trim()
  if (detectFormat(source) === "ttml") {
    source = repairTtml(source) ?? declareStandardPrefixes(source) ?? source
  }
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

  const patched = declareMissingNamespaces(text)

  try {
    if (typeof DOMParser !== "undefined") {
      const doc = new DOMParser().parseFromString(patched, "text/xml")
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
            .map((v) => normalizeIsrc(v))
            .find((v): v is string => v !== null) ?? null
        const rawVid = metaValues("ytvideoid", "videoid")[0]
        const videoId = rawVid ? videoIdFromInput(rawVid) : null

        const bodyEl = allElements.find((el) => localNameOf(el) === "body")
        const ttEl = allElements.find((el) => localNameOf(el) === "tt")
        const durAttr = (bodyEl?.getAttribute("dur") || ttEl?.getAttribute("dur") || "").trim()
        let duration: number | null = durAttr ? (parseTtmlTime(durAttr) ?? parseDurationInput(durAttr)) || null : null

        if (!duration) {
          const endMatches = Array.from(text.matchAll(/\bend="([^"]+)"/gi))
          let maxSec = 0
          for (const m of endMatches) {
            const sec = parseTtmlTime(m[1]) ?? 0
            if (sec > maxSec) maxSec = sec
          }
          if (maxSec > 0) duration = Math.ceil(maxSec)
        } else {
          duration = Math.round(duration)
        }

        return { song, artist, album, isrc, videoId, duration }
      }
    }
  } catch {
    // Fall back to regex extraction below
  }

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
      .map((v) => normalizeIsrc(v))
      .find((v): v is string => v !== null) ?? null
  const rawVid = readMetaRegex("ytvideoid", "videoid")[0]
  const videoId = rawVid ? videoIdFromInput(rawVid) : null

  const durMatch = text.match(/<(?:body|tt)\b[^>]*\bdur="([^"]+)"/i)
  let duration: number | null = durMatch
    ? (parseTtmlTime(durMatch[1]) ?? parseDurationInput(durMatch[1])) || null
    : null
  if (!duration) {
    const endMatches = Array.from(text.matchAll(/\bend="([^"]+)"/gi))
    let maxSec = 0
    for (const m of endMatches) {
      const sec = parseTtmlTime(m[1]) ?? 0
      if (sec > maxSec) maxSec = sec
    }
    if (maxSec > 0) duration = Math.ceil(maxSec)
  } else {
    duration = Math.round(duration)
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
      syncType: "plain",
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
    const compactCandidate = isReadableLayout(trimmed) ? compactTtml(trimmed) : trimmed
    const repaired = repairTtml(compactCandidate) ?? declareStandardPrefixes(compactCandidate) ?? compactCandidate

    if (!validateTtmlStructure(repaired)) {
      errors.push("Invalid TTML: Missing root <tt> element, closing </tt>, or <body>/<p> structure")
    } else {
      const xmlProblem = findXmlProblem(repaired)
      if (xmlProblem) {
        errors.push(
          `The TTML file is not valid XML. ${xmlProblem.message} (line ${xmlProblem.line}, column ${xmlProblem.column}).`,
        )
      } else {
        const prettyCheck = detectPrettyPrintedTtml(repaired)
        if (!prettyCheck.ok) {
          warnings.push(prettyPrintHint(prettyCheck.reason))
        }
        if (hasDegenerateWordTiming(repaired, "ttml")) {
          warnings.push(
            "More than 20% of word spans have zero duration (begin === end), which disables word-by-word karaoke sweep.",
          )
        }
      }
    }

    const paragraphMatches = repaired.match(/<(?:[\w.-]+:)?p\b[^>]*>/gi)
    timedCount = paragraphMatches ? paragraphMatches.length : 0
    if (timedCount === 0) {
      warnings.push('No <p begin="..."> timed paragraph elements found in TTML')
    }

    const ttmlMeta = readTtmlMetadata(repaired)
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
        const cleanIsrc = normalizeIsrc(isrcMatch[1])
        if (cleanIsrc) extractedMeta.isrc = cleanIsrc
      }
      const lenMatch = line.match(/^\[length:(\d+:\d+(?:\.\d+)?)\]$/i)
      if (lenMatch) {
        const d = parseDurationInput(lenMatch[1])
        if (d > 0) extractedMeta.duration = d
      }

      const tagMatches = Array.from(line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g))
      const wordTagMatches = Array.from(line.matchAll(/<(\d{1,2}):(\d{2})[.:](\d{2,3})>/g))
      if (tagMatches.length > 0 || wordTagMatches.length > 0) {
        timedCount += Math.max(1, tagMatches.length)
        for (const m of [...tagMatches, ...wordTagMatches]) {
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

  const syncType = detectSyncType(
    format === "ttml" ? lyricsForSave(trimmed) : trimmed,
    format,
  )

  return {
    format,
    syncType,
    lineCount: lines.filter((l) => l.trim().length > 0).length,
    timedLineCount: timedCount,
    errors,
    warnings,
    extractedMeta,
  }
}

export function extractVideoId(input: string): string {
  return videoIdFromInput(input) ?? input.trim()
}
