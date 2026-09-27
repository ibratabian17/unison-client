import { useEffect, useRef, useState } from "react"
import { IconClock, IconLoader2, IconSearch, IconX } from "@tabler/icons-react"
import type { LyricsFormat, VariantFull } from "@/lib/types"
import { getLanguageOptions, detectLyricsLanguage } from "@/lib/languages"
import { parseAndValidateLyrics } from "@/lib/lyrics-parser"
import { saveLyricRevision } from "@/lib/api"
import { MetadataFinderModal, type SelectedMetadata } from "@/components/MetadataFinderModal"

interface EditLyricModalProps {
  variant: VariantFull
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export function EditLyricModal({ variant, isOpen, onClose, onSaved }: EditLyricModalProps) {
  const [song, setSong] = useState(variant.song)
  const [artist, setArtist] = useState(variant.artist)
  const [album, setAlbum] = useState(variant.album ?? "")
  const [duration, setDuration] = useState<number | "">(variant.duration ?? "")
  const [language, setLanguage] = useState(variant.language ?? "en")
  const [isrc, setIsrc] = useState(variant.isrc ?? "")
  const [format, setFormat] = useState<LyricsFormat>(variant.format ?? "lrc")
  const [lyrics, setLyrics] = useState(variant.lyrics)
  const [saving, setSaving] = useState(false)
  const [finderOpen, setFinderOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoDetectNotice, setAutoDetectNotice] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const languages = getLanguageOptions()

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

  // Initial duration parse if missing
  useEffect(() => {
    if (!isOpen) return
    if (!duration || duration === 0) {
      const parsed = parseAndValidateLyrics(lyrics)
      if (parsed.extractedMeta.duration && parsed.extractedMeta.duration > 0) {
        setDuration(parsed.extractedMeta.duration)
      }
    }
  }, [isOpen, lyrics, duration])

  if (!isOpen) return null

  const handleLyricsChange = (val: string) => {
    setLyrics(val)
    const detected = detectLyricsLanguage(val)
    if (detected && (language === "en" || !language)) {
      setLanguage(detected)
    }
    const parsed = parseAndValidateLyrics(val)
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
        format,
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
        <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[18px] bg-[#111114] border border-unison-border-strong shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
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

            {/* Apple Music Finder Trigger Bar */}
            <div className="flex items-center justify-between rounded-[9px] border border-unison-border/70 bg-[#0d0d10] px-3.5 py-2">
              <span className="text-[12px] text-unison-text-secondary">
                Auto-fill track details from Apple Music:
              </span>
              <button
                type="button"
                onClick={() => setFinderOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-[7px] border border-unison-border bg-unison-surface px-2.5 py-1 text-[11.5px] font-medium text-unison-text hover:bg-unison-bg-hover transition-colors cursor-pointer"
              >
                <IconSearch className="size-3 text-unison-text-muted" />
                <span>Search Apple Music</span>
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
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-unison-border/80">
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
          </form>
        </div>
      </div>

      <MetadataFinderModal
        isOpen={finderOpen}
        initialQuery={[song, artist].filter(Boolean).join(" ")}
        onClose={() => setFinderOpen(false)}
        onSelect={handleMetadataSelect}
      />
    </>
  )
}
