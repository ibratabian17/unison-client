import { useEffect, useRef, useState } from "react"
import { IconLoader2, IconSearch, IconX } from "@tabler/icons-react"
import type { LyricsFormat, VariantFull } from "@/lib/types"
import { getLanguageOptions, detectLyricsLanguage } from "@/lib/languages"
import { detectFormat, parseAndValidateLyrics } from "@/lib/lyrics-parser"
import { previewLyricRevision, saveLyricRevision, withdrawPendingRevision, type RevisionPreviewData } from "@/lib/api"
import { MetadataFinderModal, type SelectedMetadata } from "@/components/MetadataFinderModal"
import { cn } from "@/lib/cn"

interface EditLyricModalProps {
  variant: VariantFull
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

function resolveActualFormat(lyricsText: string, fallback: LyricsFormat): LyricsFormat {
  const trimmed = lyricsText.trim()
  if (!trimmed) return fallback
  const detected = detectFormat(trimmed)
  // Never allow sending "ttml" when content does not have XML/TTML tags, or sending "lrc"/"plain" when content is TTML
  if (detected === "ttml") return "ttml"
  if (detected === "lrc") return "lrc"
  if (fallback === "ttml" && !trimmed.startsWith("<")) return detected
  return fallback
}

export function EditLyricModal({ variant, isOpen, onClose, onSaved }: EditLyricModalProps) {
  const [song, setSong] = useState(variant.song)
  const [artist, setArtist] = useState(variant.artist)
  const [album, setAlbum] = useState(variant.album ?? "")
  const [duration, setDuration] = useState<number | "">(variant.duration ?? "")
  const [language, setLanguage] = useState(variant.language ?? "en")
  const [isrc, setIsrc] = useState(variant.isrc ?? "")
  const [format, setFormat] = useState<LyricsFormat>(() =>
    resolveActualFormat(variant.lyrics, variant.format ?? "lrc"),
  )
  const [lyrics, setLyrics] = useState(variant.lyrics)
  const [saving, setSaving] = useState(false)
  const [finderOpen, setFinderOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoDetectNotice, setAutoDetectNotice] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<RevisionPreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  const languages = getLanguageOptions()

  // Sync state whenever the selected variant changes or the modal re-opens
  useEffect(() => {
    if (!isOpen) return
    setSong(variant.song)
    setArtist(variant.artist)
    setAlbum(variant.album ?? "")
    setLanguage(variant.language ?? "en")
    setIsrc(variant.isrc ?? "")
    setLyrics(variant.lyrics)
    const actualFormat = resolveActualFormat(variant.lyrics, variant.format ?? "lrc")
    setFormat(actualFormat)
    setError(null)
    setPreviewData(null)

    if (variant.duration && variant.duration > 0) {
      setDuration(variant.duration)
    } else {
      const parsed = parseAndValidateLyrics(variant.lyrics)
      setDuration(parsed.extractedMeta.duration && parsed.extractedMeta.duration > 0 ? parsed.extractedMeta.duration : "")
    }
  }, [
    isOpen,
    variant.id,
    variant.song,
    variant.artist,
    variant.album,
    variant.duration,
    variant.language,
    variant.isrc,
    variant.format,
    variant.lyrics,
  ])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    if (isOpen) {
      document.addEventListener("keydown", onKey)
      closeRef.current?.focus()
    }
    return () => document.removeEventListener("keydown", onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleLyricsChange = (val: string) => {
    setLyrics(val)
    const detected = detectLyricsLanguage(val)
    if (detected && (language === "en" || !language)) {
      setLanguage(detected)
    }
    const parsed = parseAndValidateLyrics(val)
    if (val.trim()) {
      setFormat(parsed.format)
    }
    if (parsed.extractedMeta.duration && (!duration || duration === 0)) {
      setDuration(parsed.extractedMeta.duration)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!song.trim() || !artist.trim() || !lyrics.trim()) {
      setError("Song, Artist, and Lyrics content are required.")
      return
    }

    try {
      setSaving(true)
      setError(null)

      const parsed = parseAndValidateLyrics(lyrics)
      const effectiveFormat = resolveActualFormat(lyrics, format)
      if (effectiveFormat !== format) {
        setFormat(effectiveFormat)
      }

      const numDur = typeof duration === "number" && duration > 0 ? duration : Number(duration)
      const resolvedDuration =
        numDur > 0
          ? numDur
          : (parsed.extractedMeta.duration && parsed.extractedMeta.duration > 0
            ? parsed.extractedMeta.duration
            : (variant.duration && variant.duration > 0 ? variant.duration : 180))

      await saveLyricRevision(variant.id, {
        videoId: variant.videoId,
        duration: resolvedDuration,
        song: song.trim(),
        artist: artist.trim(),
        album: album.trim() || undefined,
        language: language || undefined,
        isrc: isrc.trim() || undefined,
        format: effectiveFormat,
        lyrics: lyrics.trim(),
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save revision")
    } finally {
      setSaving(false)
    }
  }

  // Debounced revision preview to check immediate vs pending Council review
  useEffect(() => {
    if (!isOpen || !lyrics.trim()) {
      setPreviewData(null)
      return
    }
    let cancelled = false
    const effectiveFormat = resolveActualFormat(lyrics, format)
    const timer = setTimeout(async () => {
      setPreviewLoading(true)
      const data = await previewLyricRevision(variant.id, {
        lyrics,
        format: effectiveFormat,
        song,
        artist,
        album,
        isrc,
        language,
      })
      if (!cancelled) {
        setPreviewData(data)
        setPreviewLoading(false)
      }
    }, 450)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isOpen, lyrics, format, song, artist, album, isrc, language, variant.id])

  const handleWithdrawPending = async () => {
    if (!window.confirm("Withdraw your pending revision?")) return
    try {
      setWithdrawing(true)
      await withdrawPendingRevision(variant.id)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not withdraw pending revision")
    } finally {
      setWithdrawing(false)
    }
  }

  const handleFormatAutoDetect = () => {
    const parsed = parseAndValidateLyrics(lyrics)
    setFormat(parsed.format)
    if (parsed.extractedMeta.duration && (!duration || duration === 0)) {
      setDuration(parsed.extractedMeta.duration)
    }
    setAutoDetectNotice(`Detected ${parsed.format.toUpperCase()} (${parsed.timedLineCount} timed lines)`)
    setTimeout(() => setAutoDetectNotice(null), 3000)
  }

  const handleMetadataSelect = (meta: SelectedMetadata) => {
    if (meta.song) setSong(meta.song)
    if (meta.artist) setArtist(meta.artist)
    if (meta.album) setAlbum(meta.album)
    if (meta.isrc) setIsrc(meta.isrc)
    if (meta.duration && meta.duration > 0) setDuration(meta.duration)
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit Lyrics"
        className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,10,12,0.75)] p-4 backdrop-blur-[6px] animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[18px] bg-[#121117]/90 border border-white/12 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-unison-border/80 px-5 py-3.5 bg-[#141418]">
            <div className="min-w-0 pr-8">
              <h2 className="text-[15px] font-bold text-unison-text tracking-[-0.01em]">Edit Metadata & Lyrics</h2>
              <p className="text-[12px] text-unison-text-muted truncate">Create a new submission revision</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="grid size-[28px] cursor-pointer place-items-center rounded-[8px] bg-unison-surface text-unison-text-secondary transition-colors hover:bg-unison-bg-hover hover:text-unison-text"
            >
              <IconX className="size-[14px]" stroke={2} />
            </button>
          </div>

          {/* Content Form */}
          <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-y-auto p-5 space-y-3.5">
            {error && (
              <div className="rounded-[8px] bg-red-500/10 border border-red-500/20 px-3 py-2 text-[12px] text-red-400">
                {error}
              </div>
            )}

            {/* BiniLink + Apple Music Search Trigger Bar */}
            <div className="flex items-center justify-between rounded-[9px] border border-unison-border/70 bg-[#0d0d10] px-3.5 py-2">
              <span className="text-[12px] text-unison-text-secondary">
                Find song (Apple Music catalog) or match via BiniLink:
              </span>
              <button
                type="button"
                onClick={() => setFinderOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-[7px] border border-unison-border bg-unison-surface px-2.5 py-1 text-[11.5px] font-medium text-unison-text hover:bg-unison-bg-hover transition-colors cursor-pointer"
              >
                <IconSearch className="size-3 text-unison-text-muted" />
                <span>Find / Match Song</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-[12px] font-medium text-unison-text-secondary">
                  Song Title <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={song}
                  onChange={(e) => setSong(e.target.value)}
                  className="w-full rounded-[8px] border border-unison-border bg-[#0a0a0c] px-3 py-1.5 text-[13px] text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[12px] font-medium text-unison-text-secondary">
                  Artist Name <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  className="w-full rounded-[8px] border border-unison-border bg-[#0a0a0c] px-3 py-1.5 text-[13px] text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-[12px] font-medium text-unison-text-secondary">Album</span>
                <input
                  type="text"
                  value={album}
                  onChange={(e) => setAlbum(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-[8px] border border-unison-border bg-[#0a0a0c] px-3 py-1.5 text-[13px] text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[12px] font-medium text-unison-text-secondary">Duration (Seconds)</span>
                <input
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g. 210"
                  className="w-full font-mono rounded-[8px] border border-unison-border bg-[#0a0a0c] px-3 py-1.5 text-[13px] text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-[12px] font-medium text-unison-text-secondary">Language</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  aria-label="Language"
                  className="w-full rounded-[8px] border border-unison-border bg-[#0a0a0c] px-3 py-1.5 text-[13px] text-unison-text focus:border-unison-border-strong focus:outline-none"
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[12px] font-medium text-unison-text-secondary">Format</span>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as LyricsFormat)}
                  aria-label="Format"
                  className="w-full rounded-[8px] border border-unison-border bg-[#0a0a0c] px-3 py-1.5 text-[13px] text-unison-text focus:border-unison-border-strong focus:outline-none"
                >
                  <option value="ttml">TTML (Word sync)</option>
                  <option value="lrc">LRC (Line sync)</option>
                  <option value="plain">Plain text</option>
                </select>
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-[12px] font-medium text-unison-text-secondary">ISRC</span>
              <input
                type="text"
                value={isrc}
                onChange={(e) => setIsrc(e.target.value)}
                placeholder="e.g. USUM71607007"
                className="w-full font-mono rounded-[8px] border border-unison-border bg-[#0a0a0c] px-3 py-1.5 text-[12.5px] text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none"
              />
            </label>

            <div className="space-y-1.5 flex-1 flex flex-col pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-unison-text-secondary">
                  Lyrics Content <span className="text-red-500">*</span>
                </span>
                <button
                  type="button"
                  onClick={handleFormatAutoDetect}
                  className="text-[11px] text-unison-text-secondary hover:text-unison-text underline cursor-pointer"
                >
                  Auto-detect format
                </button>
              </div>

              {autoDetectNotice && (
                <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-[6px]">
                  {autoDetectNotice}
                </div>
              )}

              {/* Revision disposition preview badge */}
              {previewData ? (
                <div
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-1.5 text-[11px]",
                    previewData.disposition === "immediate"
                      ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                      : "border border-amber-500/20 bg-amber-500/10 text-amber-300",
                  )}
                >
                  <span>
                    {previewData.disposition === "immediate"
                      ? "✓ Low drift: changes will apply immediately upon saving."
                      : "⚡ Significant change: will be submitted to Council for verification."}
                  </span>
                  {previewData.drift ? (
                    <span className="font-mono text-[10px] opacity-75">
                      Text: {Math.round(previewData.drift.textDrift * 100)}% · Timing: {Math.round(previewData.drift.timingDrift * 100)}%
                    </span>
                  ) : null}
                </div>
              ) : previewLoading ? (
                <div className="text-[11px] text-unison-text-muted">Evaluating revision drift…</div>
              ) : null}

              <textarea
                required
                rows={9}
                value={lyrics}
                onChange={(e) => handleLyricsChange(e.target.value)}
                placeholder="Paste synced LRC or TTML lyrics..."
                className="w-full flex-1 font-mono text-[12px] rounded-[8px] border border-unison-border bg-[#0a0a0c] p-3 text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none leading-relaxed min-h-[160px]"
              />
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-unison-border/80">
              <button
                type="button"
                onClick={handleWithdrawPending}
                disabled={withdrawing}
                className="rounded-[8px] px-2.5 py-1 text-[11px] text-unison-text-muted hover:text-red-400 transition-colors cursor-pointer"
              >
                {withdrawing ? "Withdrawing…" : "Withdraw pending edit"}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-[8px] px-3.5 py-1.5 text-[12.5px] text-unison-text-secondary hover:bg-unison-bg-hover hover:text-unison-text transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-[8px] bg-red-600 px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {saving ? <IconLoader2 className="size-3.5 animate-spin" /> : null}
                  <span>Save Revision</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <MetadataFinderModal
        isOpen={finderOpen}
        initialQuery={[song, artist].filter(Boolean).join(" ").trim() || isrc || variant.videoId}
        onClose={() => setFinderOpen(false)}
        onSelect={handleMetadataSelect}
      />
    </>
  )
}
