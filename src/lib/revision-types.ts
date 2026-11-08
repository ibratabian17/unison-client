import type { PendingReason } from "./council-types"
import type { LyricsFormat } from "./types"

export type DiffPart = ["=" | "+" | "-", string]

export interface HeadTextRef {
  kind: "translation" | "transliteration" | "credit"
  lang: string | null
  line: number | null
}

export interface SyllableChange {
  before: string | null
  after: string | null
  moved: number
}

export type DiffRow =
  | { kind: "same"; lineNo: number; startMs: number | null; text: string; head?: HeadTextRef }
  | { kind: "add"; lineNo: number; startMs: number | null; text: string; head?: HeadTextRef }
  | { kind: "del"; lineNo: number; startMs: number | null; text: string; head?: HeadTextRef }
  | { kind: "word"; lineNo: number; startMs: number | null; parts: DiffPart[]; head?: HeadTextRef }
  | {
      kind: "timing"
      lineNo: number
      startMs: number
      deltaMs: number
      text: string
      syllables?: SyllableChange
    }
  | ({ kind: "syllable"; lineNo: number; startMs: number | null; text: string } & SyllableChange)
  | { kind: "gap"; count: number; section?: "head" }
  | {
      kind: "field"
      field: "language" | "isrc" | "album" | "song" | "artist"
      before: string | null
      after: string | null
    }

export interface RevisionDiff {
  rows: DiffRow[]
  againstRevNo: number | null
}

export type RevisionStatus = "live" | "past" | "pending" | "superseded" | "rejected" | "withdrawn"

export interface RevisionSummary {
  id: number
  revNo: number
  status: RevisionStatus
  pendingReason: PendingReason | null
  isAnchor: boolean
  textDrift: number
  timingDrift: number
  revertsRevNo: number | null
  author: { displayName: string; keyId?: string; avatarUrl?: string | null } | null
  reviewNote: string | null
  createdAt: number
  reviewedAt: number | null
}

export interface RevisionDetail extends RevisionSummary {
  lyrics: string
  format: LyricsFormat
  language: string | null
  isrc: string | null
  album: string | null
}

export interface FieldCheck {
  field: "lyrics" | "language" | "isrc" | "album"
  status: "ok" | "warn" | "bad"
  message: string
  line?: number
}

export interface PreviewResult {
  checks: FieldCheck[]
  drift: {
    text: number
    timing: number
    timingOffsetMs: number
    textLimit: number
    timingLimit: number
    anchorRevNo?: number | null
  }
  outcome: {
    goesLive: boolean
    reason: PendingReason | null
  }
  noChanges: boolean
  rateLimit: {
    lyricRemaining: number
    lyricLimit: number
    userRemaining: number
    userLimit: number
  }
  diff?: RevisionDiff
}
