import { useEffect, useMemo, useRef, useState } from "react"
import {
  IconAlertTriangle,
  IconCheck,
  IconRosetteDiscountCheck,
  IconSearch,
  IconUpload,
  IconX,
} from "@tabler/icons-react"
import { LyricsRenderer } from "@/components/LyricsRenderer"
import { MetadataFinderModal, type SelectedMetadata } from "@/components/MetadataFinderModal"
import { SongThumbnail } from "@/components/SongThumbnail"
import { CouncilOverlay } from "@/components/council/CouncilOverlay"
import { type DiffMode, DiffView } from "@/components/council/DiffView"
import { EditMetadataButton } from "@/components/council/EditMetadataButton"
import { Segmented } from "@/components/council/Segmented"
import { Callout, Chip } from "@/components/council/detail-parts"
import { buttonClass, chipClass, chipIconClass, glassClass, raisedChipClass } from "@/components/ui"
import { useUiMode } from "@/context/UiModeContext"
import { useCouncilMetadata, useCouncilRole } from "@/hooks/useCouncilData"
import { useProposeMetadata } from "@/hooks/useCouncilMutations"
import {
  deleteLyrics,
  fetchLinkedVideos,
  linkVideoToLyric,
  previewLyricRevision,
  saveLyricRevision,
  submitLyrics,
  withdrawPendingRevision,
  type RevisionPreviewData,
} from "@/lib/api"
import { cn } from "@/lib/cn"
import { plural } from "@/lib/format"
import { detectLyricsLanguage, getLanguageOptions } from "@/lib/languages"
import {
  detectFormat,
  lyricsForSave,
  parseAndValidateLyrics,
  readableTtml,
} from "@/lib/lyrics-parser"
import { pushToast } from "@/lib/toast"
import type { FieldCheck, LyricsFormat, VariantFull } from "@/lib/types"

interface EditLyricModalProps {
  variant: VariantFull
  isOpen: boolean
  onClose: () => void
  onSaved: (newVariantId?: number) => void
}

type WorkspaceTab = "editor" | "preview" | "changes"

const glassFieldClass =
  "w-full rounded-[10px] bg-white/[0.04] px-3 py-2 text-sm text-unison-text placeholder:text-unison-text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_0_1px_rgba(255,255,255,0.08)] focus:bg-white/[0.07] focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_0_0_1px_rgba(255,255,255,0.2)] focus:outline-none disabled:opacity-60"
const solidFieldClass =
  "w-full rounded-md border border-unison-border bg-unison-bg px-3 py-2 text-sm text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none disabled:opacity-60"
const labelClass = "text-[10px] uppercase tracking-wider text-unison-text-muted"

const CHECK_LABELS: Record<FieldCheck["field"], string> = {
  lyrics: "Lyrics",
  language: "Language",
  isrc: "ISRC",
  album: "Album",
}

const REASON_LABELS: Record<string, string> = {
  sealed: "Sealed lyric",
  flagged: "Flagged for review",
  large_text_drift: "Large text change",
  large_timing_drift: "Large timing change",
  text_drift: "Large text change",
  timing_drift: "Large timing change",
  jev_flagged: "Flagged for review",
}

const pct = (value: number) => `${Math.round(value * 100)}%`

function resolveActualFormat(lyricsText: string, fallback: LyricsFormat): LyricsFormat {
  const trimmed = lyricsText.trim()
  if (!trimmed) return fallback
  const detected = detectFormat(trimmed)
  if (detected === "ttml") return "ttml"
  if (detected === "lrc") return "lrc"
  if (fallback === "ttml" && !trimmed.startsWith("<")) return detected
  return fallback
}

function DriftMeter({
  label,
  value,
  threshold,
}: {
  label: string
  value: number | null
  threshold: number
}) {
  const over = value !== null && value >= threshold
  return (
    <div className="rounded-[10px] bg-white/[0.03] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.06)]">
      <div className="flex items-baseline justify-between text-xs text-unison-text-muted">
        <span>{label}</span>
        {value === null ? (
          <span className="text-xs">Not scored</span>
        ) : (
          <b className={cn("font-mono text-[14px] font-medium", over ? "text-unison-warn" : "text-unison-text")}>
            {pct(value)}
          </b>
        )}
      </div>
      <div
        className="relative mt-2 h-1 rounded-[2px] bg-white/[0.08]"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value === null ? undefined : Math.round(value * 100)}
      >
        {value === null ? null : (
          <i
            className={cn("absolute inset-y-0 left-0 rounded-[2px]", over ? "bg-unison-warn" : "bg-council-edit")}
            style={{ width: `${Math.min(100, value * 100)}%` }}
          />
        )}
        <s
          className="absolute -inset-y-1 w-0.5 rounded-[1px] bg-unison-text-secondary"
          style={{ left: pct(threshold) }}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-unison-text-muted">Review threshold {pct(threshold)}</div>
    </div>
  )
}

export function EditLyricModal({ variant, isOpen, onClose, onSaved }: EditLyricModalProps) {
  const { uiMode } = useUiMode()
  const isNew = uiMode === "new"
  const fieldClass = isNew ? glassFieldClass : solidFieldClass

  const role = useCouncilRole()
  const councilMetadata = useCouncilMetadata().data
  const proposeMetadataMutation = useProposeMetadata()

  const [song, setSong] = useState(variant.song ?? "")
  const [artist, setArtist] = useState(variant.artist ?? "")
  const [album, setAlbum] = useState(variant.album ?? "")
  const [language, setLanguage] = useState(variant.language ?? "")
  const [isrc, setIsrc] = useState(variant.isrc ?? "")
  const [lyrics, setLyrics] = useState(() => readableTtml(variant.lyrics).text)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("editor")
  const [diffMode, setDiffMode] = useState<DiffMode>("unified")
  const [saving, setSaving] = useState(false)
  const [finderOpen, setFinderOpen] = useState(false)
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<RevisionPreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const trimmedSong = song.trim()
  const trimmedArtist = artist.trim()
  const trimmedAlbum = album.trim() || null
  const trimmedIsrc = isrc.trim() || null
  const trimmedLang = language || null

  const languages = useMemo(() => getLanguageOptions(), [])
  const parsedLyrics = useMemo(() => parseAndValidateLyrics(lyrics), [lyrics])
  const format = useMemo(
    () => resolveActualFormat(lyrics, variant.format ?? "lrc"),
    [lyrics, variant.format],
  )
  const previewVariant = useMemo<VariantFull>(
    () => ({
      ...variant,
      song: trimmedSong || variant.song,
      artist: trimmedArtist || variant.artist,
      album: trimmedAlbum ?? undefined,
      lyrics: lyricsForSave(lyrics, variant.lyrics),
      format,
    }),
    [variant, trimmedSong, trimmedArtist, trimmedAlbum, lyrics, format],
  )

  const diffRows = useMemo(() => {
    const base = previewData?.noChanges ? [] : [...(previewData?.diff?.rows ?? [])]
    if (trimmedSong && trimmedSong !== variant.song) {
      base.push({
        kind: "field",
        field: "song",
        before: variant.song,
        after: trimmedSong,
      })
    }
    if (trimmedArtist && trimmedArtist !== variant.artist) {
      base.push({
        kind: "field",
        field: "artist",
        before: variant.artist,
        after: trimmedArtist,
      })
    }
    return base
  }, [previewData, trimmedSong, trimmedArtist, variant.song, variant.artist])

  useEffect(() => {
    if (!isOpen) return
    setSong(variant.song ?? "")
    setArtist(variant.artist ?? "")
    setAlbum(variant.album ?? "")
    setLanguage(variant.language ?? "")
    setIsrc(variant.isrc ?? "")
    setLyrics(readableTtml(variant.lyrics).text)
    setActiveTab("editor")
    setError(null)
    setPreviewData(null)
    setConfirmWithdraw(false)
    setConfirmReplaceOpen(false)
  }, [
    isOpen,
    variant.id,
    variant.song,
    variant.artist,
    variant.album,
    variant.language,
    variant.isrc,
    variant.lyrics,
  ])

  useEffect(() => {
    if (!confirmWithdraw) return
    const timer = window.setTimeout(() => setConfirmWithdraw(false), 4000)
    return () => window.clearTimeout(timer)
  }, [confirmWithdraw])

  useEffect(() => {
    if (!isOpen || !lyrics.trim()) {
      setPreviewData(null)
      return
    }
    let cancelled = false
    const compactContent = lyricsForSave(lyrics, variant.lyrics)
    const effectiveFormat = resolveActualFormat(compactContent, format)
    const timer = window.setTimeout(async () => {
      setPreviewLoading(true)
      const data = await previewLyricRevision(variant.id, {
        lyrics: compactContent,
        format: effectiveFormat,
        song: song.trim() || variant.song,
        artist: artist.trim() || variant.artist,
        album: album.trim() || null,
        isrc: isrc.trim() || null,
        language: language || null,
      })
      if (!cancelled) {
        setPreviewData(data)
        setPreviewLoading(false)
      }
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [isOpen, lyrics, format, song, artist, album, isrc, language, variant.id, variant.song, variant.artist, variant.lyrics])

  if (!isOpen) return null

  const applyNewLyricsText = (rawVal: string, fromPasteOrFile = false) => {
    const val = fromPasteOrFile ? readableTtml(rawVal).text : rawVal
    setLyrics(val)
    const detected = detectLyricsLanguage(val)
    if (detected && !language) {
      setLanguage(detected)
    }
    const parsed = parseAndValidateLyrics(val)
    if (parsed.extractedMeta.song && !song.trim()) {
      setSong(parsed.extractedMeta.song)
    }
    if (parsed.extractedMeta.artist && !artist.trim()) {
      setArtist(parsed.extractedMeta.artist)
    }
    if (parsed.extractedMeta.album && !album.trim()) {
      setAlbum(parsed.extractedMeta.album)
    }
    if (parsed.extractedMeta.isrc && !isrc.trim()) {
      setIsrc(parsed.extractedMeta.isrc)
    }
  }

  const handleFileUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = (ev.target?.result as string) || ""
      applyNewLyricsText(content, true)
    }
    reader.readAsText(file)
  }

  const titleOrArtistChanged = trimmedSong !== variant.song || trimmedArtist !== variant.artist
  const revisionFieldsChanged =
    !previewData?.noChanges ||
    trimmedAlbum !== (variant.album ?? null) ||
    trimmedIsrc !== (variant.isrc ?? null) ||
    trimmedLang !== (variant.language ?? null) ||
    lyricsForSave(lyrics, variant.lyrics) !== variant.lyrics

  const hasAnyChange = titleOrArtistChanged || !previewData?.noChanges
  const isSealed = Boolean(variant.marks?.some((m) => m.type === "seal"))
  const canDeleteOldWithoutPenalty = !isSealed && !(variant.voteCount >= 2 && variant.effectiveScore < 0)

  const executeSave = async () => {
    if (!trimmedSong || !trimmedArtist) {
      setError("Song title and artist cannot be empty.")
      return
    }
    if (!lyrics.trim()) {
      setError("Lyrics content cannot be empty.")
      return
    }

    try {
      setSaving(true)
      setError(null)

      const compactContent = lyricsForSave(lyrics, variant.lyrics)
      const parsed = parseAndValidateLyrics(compactContent)
      const effectiveFormat = resolveActualFormat(compactContent, format)
      const resolvedDuration =
        variant.duration && variant.duration > 0
          ? variant.duration
          : parsed.extractedMeta.duration && parsed.extractedMeta.duration > 0
            ? parsed.extractedMeta.duration
            : 180

      // Case 1: Title and Artist did not change -> standard revision save
      if (!titleOrArtistChanged) {
        await saveLyricRevision(variant.id, {
          videoId: variant.videoId,
          duration: resolvedDuration,
          song: trimmedSong,
          artist: trimmedArtist,
          album: trimmedAlbum ?? undefined,
          language: trimmedLang ?? undefined,
          isrc: trimmedIsrc ?? undefined,
          format: effectiveFormat,
          lyrics: compactContent,
        })
        pushToast({
          kind: "success",
          message:
            previewData && !previewData.outcome?.goesLive && !previewData.noChanges
              ? "Submitted revision for Council review"
              : "Saved lyric revision",
        })
        onSaved()
        onClose()
        return
      }

      // Case 2: Title or Artist changed and user is on the Council -> propose metadata + save revision if needed
      if (role !== null) {
        if (revisionFieldsChanged) {
          await saveLyricRevision(variant.id, {
            videoId: variant.videoId,
            duration: resolvedDuration,
            song: trimmedSong,
            artist: trimmedArtist,
            album: trimmedAlbum ?? undefined,
            language: trimmedLang ?? undefined,
            isrc: trimmedIsrc ?? undefined,
            format: effectiveFormat,
            lyrics: compactContent,
          })
        }
        await proposeMetadataMutation.mutateAsync({
          videoId: variant.videoId,
          lyricsId: variant.id,
          song: trimmedSong,
          artist: trimmedArtist,
          album: trimmedAlbum,
        })
        const needed = (councilMetadata?.needed ?? 3) - 1
        pushToast({
          kind: "success",
          message: revisionFieldsChanged
            ? `Saved revision and proposed new details (${plural(needed, "more approval", "more approvals")} needed).`
            : `Proposed new details. ${plural(needed, "more approval", "more approvals")} needed.`,
        })
        onSaved()
        onClose()
        return
      }

      // Case 3: Title or Artist changed and user is NOT on the Council -> replace via submitLyrics + deleteLyrics
      const { videos: linkedVideos } = await fetchLinkedVideos(variant.id)
      const extraVideoIds = linkedVideos
        .filter((v) => !v.primary && v.videoId !== variant.videoId)
        .map((v) => v.videoId)

      let deletedFirst = false
      if (canDeleteOldWithoutPenalty) {
        await deleteLyrics(variant.id)
        deletedFirst = true
      }

      try {
        const created = await submitLyrics({
          videoId: variant.videoId,
          song: trimmedSong,
          artist: trimmedArtist,
          album: trimmedAlbum ?? undefined,
          isrc: trimmedIsrc ?? undefined,
          duration: resolvedDuration,
          lyrics: compactContent,
          format: effectiveFormat,
          language: trimmedLang ?? undefined,
        })

        for (const extraVid of extraVideoIds) {
          await linkVideoToLyric(created.id, extraVid).catch(() => {})
        }

        setConfirmReplaceOpen(false)
        pushToast({
          kind: "success",
          message: deletedFirst
            ? "Replaced variant with updated song details"
            : "Submitted updated variant with new song details",
        })
        onSaved(created.id)
        onClose()
      } catch (submitErr) {
        if (deletedFirst) {
          await submitLyrics({
            videoId: variant.videoId,
            song: variant.song,
            artist: variant.artist,
            album: variant.album ?? undefined,
            isrc: variant.isrc ?? undefined,
            duration: resolvedDuration,
            lyrics: variant.lyrics,
            format: variant.format,
            language: variant.language ?? undefined,
          }).catch(() => {})
        }
        throw submitErr
      }
    } catch (err) {
      setConfirmReplaceOpen(false)
      setError(err instanceof Error ? err.message : "Failed to save revision")
    } finally {
      setSaving(false)
    }
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!trimmedSong || !trimmedArtist) {
      setError("Song title and artist cannot be empty.")
      return
    }
    if (!lyrics.trim()) {
      setError("Lyrics content cannot be empty.")
      return
    }
    if (titleOrArtistChanged && role === null) {
      setConfirmReplaceOpen(true)
      return
    }
    void executeSave()
  }

  const handleWithdrawPending = async () => {
    try {
      setWithdrawing(true)
      await withdrawPendingRevision(variant.id)
      pushToast({ kind: "info", message: "Withdrew pending revision" })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not withdraw pending revision")
    } finally {
      setWithdrawing(false)
    }
  }

  const handleMetadataSelect = (meta: SelectedMetadata) => {
    if (meta.song) setSong(meta.song)
    if (meta.artist) setArtist(meta.artist)
    if (meta.album) setAlbum(meta.album)
    if (meta.isrc) setIsrc(meta.isrc)
  }

  const changedCount = diffRows.filter((r) => r.kind !== "same" && r.kind !== "gap").length
  const badChecks = (previewData?.checks ?? []).filter((c) => c.status !== "ok")
  const hasBadCheck = (previewData?.checks ?? []).some((c) => c.status === "bad")
  const rateLimit = previewData?.rateLimit
  const remainingEdits = rateLimit
    ? Math.max(0, Math.min(rateLimit.lyricRemaining, rateLimit.userRemaining))
    : null
  const maxEdits = rateLimit
    ? rateLimit.userRemaining < rateLimit.lyricRemaining
      ? rateLimit.userLimit
      : rateLimit.lyricLimit
    : null

  const liveRevNo = variant.revision?.revNo ?? 1
  const dividerClass = isNew ? "border-white/[0.06]" : "border-unison-border"

  return (
    <>
      <CouncilOverlay
        open={isOpen}
        onOpenChange={(val) => (val ? null : onClose())}
        label="Edit lyrics"
        className="top-1/2 flex max-h-[90vh] w-[min(780px,calc(100vw-32px))] -translate-y-1/2 flex-col"
      >
        <div className={cn("flex items-start justify-between gap-4 border-b px-6 py-5", dividerClass)}>
          <div className="flex min-w-0 items-center gap-3.5">
            <SongThumbnail
              videoId={variant.videoId}
              song={trimmedSong || variant.song}
              artist={trimmedArtist || variant.artist}
              className="size-12 shrink-0 rounded-lg outline outline-1 -outline-offset-1 outline-white/10"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-semibold text-unison-text">
                  {trimmedSong || variant.song}
                </h2>
                <Chip>Rev {liveRevNo}</Chip>
                <Chip>{format.toUpperCase()}</Chip>
              </div>
              <p className="mt-0.5 truncate text-xs text-unison-text-secondary">
                {trimmedArtist || variant.artist}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <EditMetadataButton
              videoId={variant.videoId}
              lyricsId={variant.id}
              current={{ song: variant.song, artist: variant.artist, album: variant.album ?? null }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".lrc,.ttml,.txt,.xml,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFileUpload(f)
                e.target.value = ""
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={isNew ? chipClass : buttonClass("fill", "sm")}
            >
              <IconUpload className={chipIconClass} stroke={1.75} />
              <span>Import file</span>
            </button>
            <button
              type="button"
              onClick={() => setFinderOpen(true)}
              className={isNew ? chipClass : buttonClass("fill", "sm")}
            >
              <IconSearch className={chipIconClass} stroke={1.75} />
              <span>Find song</span>
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className={cn(
                glassClass,
                "grid size-8 cursor-pointer place-items-center rounded-full text-unison-text-secondary transition-[background-color,color,scale] duration-150 ease-out hover:bg-white/[0.14] hover:text-unison-text active:scale-[0.96]",
              )}
            >
              <IconX className="size-[15px]" stroke={2} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {error ? (
              <Callout tone="warn" icon={<IconAlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" stroke={1.5} />}>
                {error}
              </Callout>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className={labelClass}>Song title</label>
                <input
                  type="text"
                  required
                  value={song}
                  onChange={(e) => setSong(e.target.value)}
                  placeholder="Song title"
                  disabled={saving}
                  autoComplete="off"
                  className={fieldClass}
                />
                {parsedLyrics.extractedMeta.song &&
                parsedLyrics.extractedMeta.song.toLowerCase() !== song.trim().toLowerCase() ? (
                  <button
                    type="button"
                    onClick={() => setSong(parsedLyrics.extractedMeta.song ?? "")}
                    className="truncate text-[11px] text-unison-text-muted transition-colors hover:text-unison-text"
                  >
                    Detected <span className="text-unison-text-secondary">{parsedLyrics.extractedMeta.song}</span> · Use
                  </button>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Artist</label>
                <input
                  type="text"
                  required
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="Artist"
                  disabled={saving}
                  autoComplete="off"
                  className={fieldClass}
                />
                {parsedLyrics.extractedMeta.artist &&
                parsedLyrics.extractedMeta.artist.toLowerCase() !== artist.trim().toLowerCase() ? (
                  <button
                    type="button"
                    onClick={() => setArtist(parsedLyrics.extractedMeta.artist ?? "")}
                    className="truncate text-[11px] text-unison-text-muted transition-colors hover:text-unison-text"
                  >
                    Detected <span className="text-unison-text-secondary">{parsedLyrics.extractedMeta.artist}</span> · Use
                  </button>
                ) : null}
              </div>
            </div>

            {titleOrArtistChanged && role === null ? (
              <Callout
                tone="warn"
                icon={<IconAlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" stroke={1.5} />}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <b>Renaming title or artist without Council privileges replaces this variant.</b>{" "}
                    {canDeleteOldWithoutPenalty
                      ? `Variant #${variant.id} will be deleted and re-submitted as a new variant, resetting votes (${variant.upvotes ?? 0} up / ${variant.downvotes ?? 0} down) and revision history (Rev ${liveRevNo} → Rev 1). Linked videos are preserved.`
                      : "Because this variant is sealed or net-downvoted, a new variant will be submitted alongside it starting at 0 votes and Rev 1."}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSong(variant.song)
                      setArtist(variant.artist)
                    }}
                    className="shrink-0 font-semibold text-unison-text underline transition-opacity hover:opacity-80"
                  >
                    Reset title &amp; artist
                  </button>
                </div>
              </Callout>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className={labelClass}>Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  aria-label="Language"
                  disabled={saving}
                  className={fieldClass}
                >
                  <option value="">Unspecified</option>
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className={labelClass}>ISRC</label>
                <input
                  type="text"
                  value={isrc}
                  onChange={(e) => setIsrc(e.target.value)}
                  placeholder="e.g. USUM71607007"
                  disabled={saving}
                  spellCheck={false}
                  autoComplete="off"
                  className={cn(fieldClass, "font-mono text-[13px]")}
                />
                {parsedLyrics.extractedMeta.isrc &&
                parsedLyrics.extractedMeta.isrc.toLowerCase() !== isrc.trim().toLowerCase() ? (
                  <button
                    type="button"
                    onClick={() => setIsrc(parsedLyrics.extractedMeta.isrc ?? "")}
                    className="text-[11px] text-unison-text-muted transition-colors hover:text-unison-text"
                  >
                    Detected <span className="font-mono text-unison-text-secondary">{parsedLyrics.extractedMeta.isrc}</span> · Use
                  </button>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Album</label>
                <input
                  type="text"
                  value={album}
                  onChange={(e) => setAlbum(e.target.value)}
                  placeholder="Optional"
                  disabled={saving}
                  autoComplete="off"
                  className={fieldClass}
                />
                {parsedLyrics.extractedMeta.album &&
                parsedLyrics.extractedMeta.album.toLowerCase() !== album.trim().toLowerCase() ? (
                  <button
                    type="button"
                    onClick={() => setAlbum(parsedLyrics.extractedMeta.album ?? "")}
                    className="truncate text-[11px] text-unison-text-muted transition-colors hover:text-unison-text"
                  >
                    Detected <span className="text-unison-text-secondary">{parsedLyrics.extractedMeta.album}</span> · Use
                  </button>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Segmented
                  label="Editor view"
                  value={activeTab}
                  onChange={setActiveTab}
                  options={[
                    { value: "editor", label: "Lyrics" },
                    { value: "preview", label: "Preview" },
                    { value: "changes", label: changedCount > 0 ? `Changes (${changedCount})` : "Changes" },
                  ]}
                />

                {activeTab === "changes" ? (
                  <Segmented
                    label="Diff layout"
                    value={diffMode}
                    onChange={setDiffMode}
                    options={[
                      { value: "unified", label: "Unified" },
                      { value: "split", label: "Split" },
                    ]}
                  />
                ) : (
                  <span className="font-mono text-xs text-unison-text-muted">
                    {parsedLyrics.lineCount} lines · {parsedLyrics.timedLineCount} timed
                  </span>
                )}
              </div>

              {activeTab === "editor" ? (
                <textarea
                  required
                  rows={12}
                  value={lyrics}
                  disabled={saving}
                  onChange={(e) => applyNewLyricsText(e.target.value, false)}
                  onPaste={(e) => {
                    const selAll =
                      e.currentTarget.value === "" ||
                      (e.currentTarget.selectionStart === 0 &&
                        e.currentTarget.selectionEnd === e.currentTarget.value.length)
                    if (selAll) {
                      const pasted = e.clipboardData.getData("text/plain")
                      if (pasted && detectFormat(pasted) === "ttml") {
                        e.preventDefault()
                        applyNewLyricsText(pasted, true)
                      }
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const f = e.dataTransfer.files?.[0]
                    if (f) handleFileUpload(f)
                  }}
                  placeholder="Paste synced LRC or TTML lyrics, or drop a .lrc / .ttml file…"
                  spellCheck={false}
                  className={cn(
                    fieldClass,
                    "unison-code-scroll min-h-[240px] p-3.5 font-mono text-[12.5px] leading-[1.7]",
                  )}
                />
              ) : activeTab === "preview" ? (
                <div className="h-[260px] overflow-hidden rounded-[12px] bg-white/[0.03] px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                  <LyricsRenderer
                    variant={previewVariant}
                    getCurrentTime={() => 0}
                    getPlaying={() => false}
                    className="h-full"
                  />
                </div>
              ) : (
                <div className="max-h-[280px] space-y-2.5 overflow-y-auto rounded-[12px] bg-white/[0.03] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-unison-text-muted">
                    <span>
                      {previewData?.diff?.againstRevNo
                        ? `Compared with Rev ${previewData.diff.againstRevNo}`
                        : "Compared with live version"}
                      {previewLoading ? " · Updating…" : ""}
                    </span>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="inline-flex items-center gap-1.5">
                        <i className="inline-block size-2 rounded-full bg-council-edit-ink" /> Added
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <i className="inline-block size-2 rounded-full bg-council-reject-ink" /> Removed
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <i className="inline-block size-2 rounded-full bg-unison-warn" /> Timing
                      </span>
                    </div>
                  </div>
                  <DiffView rows={diffRows} mode={diffMode} />
                </div>
              )}
            </div>

            {previewData ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(["lyrics", "language", "isrc", "album"] as const).map((fieldKey) => {
                      const check = previewData.checks?.find((c) => c.field === fieldKey)
                      const status = !check || (!hasAnyChange && previewData.noChanges) ? "idle" : check.status
                      const tone =
                        status === "ok"
                          ? "good"
                          : status === "warn" || status === "bad"
                            ? "warn"
                            : "plain"
                      return (
                        <Chip key={fieldKey} tone={tone}>
                          {status === "ok" ? (
                            <IconCheck aria-hidden className="size-3" stroke={1.75} />
                          ) : status === "warn" || status === "bad" ? (
                            <IconAlertTriangle aria-hidden className="size-3" stroke={1.75} />
                          ) : null}
                          <span>{CHECK_LABELS[fieldKey]}</span>
                        </Chip>
                      )
                    })}
                  </div>
                  {remainingEdits !== null && maxEdits !== null ? (
                    <span
                      className={cn(
                        "font-mono text-xs",
                        remainingEdits === 0 ? "text-unison-warn" : "text-unison-text-muted",
                      )}
                    >
                      {remainingEdits} of {maxEdits} edits left today
                    </span>
                  ) : null}
                </div>

                {previewData.drift ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <DriftMeter
                      label={
                        previewData.drift.anchorRevNo
                          ? `Text drift since Rev ${previewData.drift.anchorRevNo}`
                          : "Text drift"
                      }
                      value={hasBadCheck ? null : previewData.drift.text}
                      threshold={previewData.drift.textLimit ?? 0.2}
                    />
                    <DriftMeter
                      label={
                        previewData.drift.anchorRevNo
                          ? `Timing drift since Rev ${previewData.drift.anchorRevNo}`
                          : "Timing drift"
                      }
                      value={hasBadCheck ? null : previewData.drift.timing}
                      threshold={previewData.drift.timingLimit ?? 0.2}
                    />
                  </div>
                ) : null}

                {badChecks.length > 0 && hasAnyChange ? (
                  <Callout
                    tone="warn"
                    icon={<IconAlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" stroke={1.5} />}
                  >
                    <ul className="space-y-1">
                      {badChecks.map((c, idx) => (
                        <li key={`${c.field}-${idx}`}>
                          {c.line ? `Line ${c.line}: ${c.message}` : c.message}
                        </li>
                      ))}
                    </ul>
                  </Callout>
                ) : hasAnyChange ? (
                  <Callout
                    tone={
                      titleOrArtistChanged
                        ? "warn"
                        : previewData.outcome?.goesLive
                          ? "plain"
                          : "warn"
                    }
                    icon={
                      titleOrArtistChanged && role !== null ? (
                        <IconRosetteDiscountCheck aria-hidden className="mt-0.5 size-4 shrink-0" stroke={1.5} />
                      ) : titleOrArtistChanged && role === null ? (
                        <IconAlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" stroke={1.5} />
                      ) : previewData.outcome?.goesLive ? (
                        <IconCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-unison-text" stroke={1.75} />
                      ) : (
                        <IconRosetteDiscountCheck aria-hidden className="mt-0.5 size-4 shrink-0" stroke={1.5} />
                      )
                    }
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {titleOrArtistChanged && role !== null ? (
                          <>
                            <b>Proposes new song details for Council vote.</b>{" "}
                            {revisionFieldsChanged
                              ? "Lyric revision will also be saved."
                              : "Changes apply to every version once approved."}
                          </>
                        ) : titleOrArtistChanged && role === null ? (
                          <>
                            <b>Replaces variant and resets vote &amp; revision history.</b>{" "}
                            {canDeleteOldWithoutPenalty
                              ? "You will be asked to confirm before deleting and re-submitting."
                              : "Submitted as a new variant on this video."}
                          </>
                        ) : previewData.outcome?.goesLive ? (
                          <>
                            <b>Goes live immediately.</b> Within the automatic drift thresholds.
                          </>
                        ) : (
                          <>
                            <b>Requires Council review ({REASON_LABELS[previewData.outcome?.reason ?? ""] ?? "Review required"}).</b>{" "}
                            Rev {liveRevNo} stays live until approved.
                          </>
                        )}
                      </span>
                      {changedCount > 0 && activeTab !== "changes" ? (
                        <button
                          type="button"
                          onClick={() => setActiveTab("changes")}
                          className="font-semibold text-unison-text underline transition-opacity hover:opacity-80"
                        >
                          View changes
                        </button>
                      ) : null}
                    </div>
                  </Callout>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className={cn("flex items-center justify-between gap-3 border-t px-6 py-4", dividerClass)}>
            {variant.revision?.pending ? (
              <button
                type="button"
                disabled={withdrawing}
                onClick={() => {
                  if (!confirmWithdraw) {
                    setConfirmWithdraw(true)
                    return
                  }
                  void handleWithdrawPending()
                }}
                className={
                  isNew
                    ? cn(chipClass, confirmWithdraw && "bg-red-500/20 text-[#fca5a5]")
                    : buttonClass(confirmWithdraw ? "danger" : "ghost", "sm")
                }
              >
                {withdrawing
                  ? "Withdrawing…"
                  : confirmWithdraw
                    ? `Confirm withdraw Rev ${variant.revision.pending.revNo}`
                    : `Withdraw pending Rev ${variant.revision.pending.revNo}`}
              </button>
            ) : (
              <span className="text-xs text-unison-text-muted">
                {titleOrArtistChanged
                  ? role !== null
                    ? "Title & artist changes will be proposed to the Council."
                    : "Renaming title or artist without Council replaces this variant."
                  : "Edit song title, artist, metadata, or synced lyrics."}
              </span>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className={isNew ? chipClass : buttonClass("ghost", "sm")}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  saving ||
                  hasBadCheck ||
                  (!titleOrArtistChanged && remainingEdits === 0) ||
                  !hasAnyChange ||
                  !trimmedSong ||
                  !trimmedArtist
                }
                className={
                  isNew
                    ? cn(raisedChipClass, "disabled:cursor-not-allowed disabled:opacity-45")
                    : buttonClass("primary", "sm")
                }
              >
                {saving
                  ? "Saving…"
                  : titleOrArtistChanged && role !== null && !revisionFieldsChanged
                    ? "Propose details"
                    : titleOrArtistChanged && role === null
                      ? "Replace & rename…"
                      : previewData && !previewData.outcome?.goesLive && !previewData.noChanges && !titleOrArtistChanged
                        ? "Submit for review"
                        : "Save revision"}
              </button>
            </div>
          </div>
        </form>
      </CouncilOverlay>

      <CouncilOverlay
        open={confirmReplaceOpen}
        onOpenChange={(val) => {
          if (!val && !saving) setConfirmReplaceOpen(false)
        }}
        label="Confirm variant replacement"
        className="top-1/2 w-[min(480px,calc(100vw-32px))] -translate-y-1/2 px-6 py-5"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-500/15 text-unison-warn">
              <IconAlertTriangle className="size-5" stroke={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-unison-text">
                Replace variant to rename title or artist?
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-unison-text-secondary">
                Only Council members can rename a song title or artist in-place. On a regular account, renaming requires deleting your current variant and submitting a replacement.
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-[12px] bg-white/[0.04] p-3.5 text-xs text-unison-text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.06)]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-unison-text-muted">Before</span>
              <span className="truncate font-medium text-unison-text">
                {variant.song} · {variant.artist}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-unison-text-muted">After</span>
              <span className="truncate font-medium text-unison-text">
                {trimmedSong} · {trimmedArtist}
              </span>
            </div>
          </div>

          <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-unison-text-secondary">
            <li>
              <b className="text-unison-text">Vote data will be lost:</b> Current votes ({variant.upvotes ?? 0} up / {variant.downvotes ?? 0} down, score {variant.effectiveScore}) will reset to 0.
            </li>
            <li>
              <b className="text-unison-text">Revision history will reset:</b> Revision history (currently Rev {liveRevNo}) will restart at Rev 1 with a new variant ID.
            </li>
            <li>
              <b className="text-unison-text">Linked videos are kept:</b> Secondary YouTube video links attached to this variant will be automatically re-linked.
            </li>
            <li>
              <b className="text-unison-text">Council metadata lock:</b> If the Council has previously approved locked metadata for this video, the server will keep the Council’s approved title and artist.
            </li>
          </ul>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmReplaceOpen(false)}
              className={isNew ? chipClass : buttonClass("ghost", "sm")}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setSong(variant.song)
                setArtist(variant.artist)
                setConfirmReplaceOpen(false)
              }}
              className={isNew ? chipClass : buttonClass("fill", "sm")}
            >
              Keep original title &amp; artist
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void executeSave()}
              className={
                isNew
                  ? cn(raisedChipClass, "bg-red-500/25 text-[#fecaca] hover:bg-red-500/35")
                  : buttonClass("danger", "sm")
              }
            >
              {saving ? "Replacing…" : "Replace & rename"}
            </button>
          </div>
        </div>
      </CouncilOverlay>

      <MetadataFinderModal
        isOpen={finderOpen}
        initialQuery={[song, artist].filter(Boolean).join(" ").trim() || isrc || variant.videoId}
        onClose={() => setFinderOpen(false)}
        onSelect={handleMetadataSelect}
      />
    </>
  )
}
