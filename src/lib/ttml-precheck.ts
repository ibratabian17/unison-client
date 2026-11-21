// Ported from Composer (src/domain/unison/ttml-precheck.ts).
// Mirrors Unison's submit checks (`detectPrettyPrintedTtml` and `hasDegenerateWordTiming`).

export type UnisonTtmlProblem = "line-breaks" | "padded-words" | "zero-length-words"

export type UnisonTtmlPrecheck = { ok: true } | { ok: false; problem: UnisonTtmlProblem; message: string }

const LINE_BREAK_BETWEEN_SPANS = /<\/span>\s*[\r\n]\s*<span\b/i
const TRAILING_SPACE_IN_SPAN = /<span\b[^>]*>[^<]*?\S[ \t]+<\/span>\s*<span\b/i
const LEADING_SPACE_IN_SPAN = /<\/span>\s*<span\b[^>]*>[ \t]+\S[^<]*<\/span>/i
const MAX_ZERO_LENGTH_RATIO = 0.2
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u

function parseTtmlTimestamp(raw: string): number {
  const s = raw.trim()
  if (!s) return Number.NaN
  if (s.endsWith("ms")) return Number.parseFloat(s.slice(0, -2)) / 1000
  if (s.endsWith("s")) return Number.parseFloat(s.slice(0, -1))
  const parts = s.split(":").map((p) => Number.parseFloat(p))
  if (parts.some((n) => !Number.isFinite(n))) return Number.NaN
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0]
}

function directText(element: Element): string {
  return [...element.childNodes]
    .flatMap((node) => (node.nodeType === Node.TEXT_NODE ? [node.textContent ?? ""] : []))
    .join("")
}

function hasMostlyZeroLengthWords(content: string): boolean {
  if (typeof DOMParser === "undefined") return false
  try {
    const doc = new DOMParser().parseFromString(content, "application/xml")
    if (doc.querySelector("parsererror")) return false
    let timedWords = 0
    let zeroLengthWords = 0
    for (const span of doc.querySelectorAll("p span")) {
      const begin = span.getAttribute("begin")
      const end = span.getAttribute("end")
      if (begin === null || end === null || !HAS_LETTER_OR_DIGIT.test(directText(span))) continue
      const beginSeconds = parseTtmlTimestamp(begin)
      const endSeconds = parseTtmlTimestamp(end)
      if (!Number.isFinite(beginSeconds) || !Number.isFinite(endSeconds)) continue
      timedWords++
      if (endSeconds <= beginSeconds) zeroLengthWords++
    }
    return timedWords > 0 && zeroLengthWords / timedWords > MAX_ZERO_LENGTH_RATIO
  } catch {
    return false
  }
}

export const TTML_PROBLEM_MESSAGES: Record<UnisonTtmlProblem, string> = {
  "line-breaks":
    "Pretty-printed line breaks between word <span> tags will be rejected by Unison. Compact word spans onto a single line.",
  "padded-words":
    "Spaces are placed inside word <span> tags instead of between them. Keep spaces outside <span> elements.",
  "zero-length-words":
    "More than 20% of timed words have zero or negative duration (end <= begin).",
}

export function precheckUnisonTtml(content: string): UnisonTtmlPrecheck {
  if (LINE_BREAK_BETWEEN_SPANS.test(content)) {
    return { ok: false, problem: "line-breaks", message: TTML_PROBLEM_MESSAGES["line-breaks"] }
  }
  if (TRAILING_SPACE_IN_SPAN.test(content) || LEADING_SPACE_IN_SPAN.test(content)) {
    return { ok: false, problem: "padded-words", message: TTML_PROBLEM_MESSAGES["padded-words"] }
  }
  if (hasMostlyZeroLengthWords(content)) {
    return { ok: false, problem: "zero-length-words", message: TTML_PROBLEM_MESSAGES["zero-length-words"] }
  }
  return { ok: true }
}
