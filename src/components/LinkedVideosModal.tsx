import { useEffect, useState } from "react"
import {
  IconAlertTriangle,
  IconChevronDown,
  IconExternalLink,
  IconTrash,
  IconX,
} from "@tabler/icons-react"
import { SongThumbnail } from "@/components/SongThumbnail"
import { CouncilOverlay } from "@/components/council/CouncilOverlay"
import { BlockHead, Callout, Chip } from "@/components/council/detail-parts"
import { Bone } from "@/components/skeleton"
import { buttonClass, chipClass, chipIconClass, glassClass, raisedChipClass } from "@/components/ui"
import { useUiMode } from "@/context/UiModeContext"
import {
  fetchLinkedVideos,
  fetchSuggestedVideos,
  linkVideoToLyric,
  unlinkVideoFromLyric,
} from "@/lib/api"
import { cn } from "@/lib/cn"
import { extractVideoId } from "@/lib/lyrics-parser"
import { pushToast } from "@/lib/toast"
import type { LinkedVideo, VariantFull, VideoSuggestion } from "@/lib/types"
import { fetchVideoMetadata, type VideoMetadata } from "@/lib/video-metadata"
import { youTubeMusicUrl } from "@/lib/youtube-music"

interface LinkedVideosModalProps {
  variant: VariantFull
  isOwner: boolean
  isOpen: boolean
  onClose: () => void
  onUpdated: () => void
}

const glassFieldClass =
  "w-full rounded-[10px] bg-white/[0.04] px-3 py-2 text-sm text-unison-text placeholder:text-unison-text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_0_1px_rgba(255,255,255,0.08)] focus:bg-white/[0.07] focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_0_0_1px_rgba(255,255,255,0.2)] focus:outline-none disabled:opacity-60"
const solidFieldClass =
  "w-full rounded-md border border-unison-border bg-unison-bg px-3 py-2 text-sm text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none disabled:opacity-60"

const SUGGESTED_PAGE_SIZE = 5

const videoMetaCache = new Map<string, VideoMetadata>()

function formatSec(sec?: number): string {
  if (!sec || sec <= 0) return ""
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

function normalizeTitle(title: string): string {
  return title.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()
}

function VideoThumb({
  videoId,
  src,
  alt = "",
}: {
  videoId: string
  src?: string | null
  alt?: string
}) {
  const [imgSrc, setImgSrc] = useState(src || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`)

  useEffect(() => {
    setImgSrc(src || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`)
  }, [videoId, src])

  return (
    <img
      src={imgSrc}
      alt={alt}
      loading="lazy"
      onError={() => {
        const fallback = `https://i.ytimg.com/vi/${videoId}/default.jpg`
        if (imgSrc !== fallback) setImgSrc(fallback)
      }}
      className="size-10 shrink-0 rounded-lg object-cover outline outline-1 -outline-offset-1 outline-white/10 bg-unison-bg-hover"
    />
  )
}

export function LinkedVideosModal({
  variant,
  isOwner,
  isOpen,
  onClose,
  onUpdated,
}: LinkedVideosModalProps) {
  const { uiMode } = useUiMode()
  const isNew = uiMode === "new"
  const fieldClass = isNew ? glassFieldClass : solidFieldClass
  const dividerClass = isNew ? "border-white/[0.06]" : "border-unison-border"
  const rowClass = isNew
    ? "flex items-center justify-between gap-3 rounded-[12px] bg-white/[0.04] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.06)]"
    : "flex items-center justify-between gap-3 rounded-[10px] bg-white/[0.02] px-3.5 py-2.5 shadow-[inset_0_0_0_1px_var(--color-unison-border)]"

  const [videos, setVideos] = useState<LinkedVideo[]>([])
  const [metaMap, setMetaMap] = useState<Record<string, VideoMetadata>>({})
  const [suggestions, setSuggestions] = useState<VideoSuggestion[]>([])
  const [newVideoInput, setNewVideoInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null)
  const [confirmLinkSug, setConfirmLinkSug] = useState<VideoSuggestion | null>(null)
  const [showAllLikely, setShowAllLikely] = useState(false)
  const [showOthers, setShowOthers] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = async (cancelled = false) => {
    try {
      setLoading(true)
      setError(null)
      const [vRes, sRes] = await Promise.all([
        fetchLinkedVideos(variant.id).catch(() => ({ videos: [] })),
        isOwner ? fetchSuggestedVideos(variant.id).catch(() => ({ suggestions: [] })) : Promise.resolve({ suggestions: [] }),
      ])
      if (cancelled) return
      const list = vRes.videos.length > 0 ? [...vRes.videos] : [{ videoId: variant.videoId, primary: true }]
      if (!list.some((v) => v.videoId === variant.videoId)) {
        list.unshift({ videoId: variant.videoId, primary: true })
      }
      setVideos(list)
      setSuggestions(sRes.suggestions)
    } catch (err) {
      if (!cancelled) setError(err instanceof Error ? err.message : "Could not load linked videos")
    } finally {
      if (!cancelled) setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setConfirmUnlinkId(null)
    setConfirmLinkSug(null)
    setShowAllLikely(false)
    setShowOthers(false)
    void loadData(cancelled)
    return () => {
      cancelled = true
    }
  }, [isOpen, variant.id, variant.videoId, isOwner])

  useEffect(() => {
    if (!isOpen || videos.length === 0) return
    let cancelled = false

    const cached: Record<string, VideoMetadata> = {}
    const toFetch: string[] = []

    for (const v of videos) {
      const hit = videoMetaCache.get(v.videoId)
      if (hit) {
        cached[v.videoId] = hit
      } else {
        toFetch.push(v.videoId)
      }
    }

    if (Object.keys(cached).length > 0) {
      setMetaMap((prev) => ({ ...prev, ...cached }))
    }

    if (toFetch.length > 0) {
      void Promise.all(
        toFetch.map(async (vid) => {
          const meta = await fetchVideoMetadata(vid)
          if (!meta) return
          videoMetaCache.set(vid, meta)
          if (!cancelled) {
            setMetaMap((prev) => ({ ...prev, [vid]: meta }))
          }
        }),
      )
    }

    return () => {
      cancelled = true
    }
  }, [isOpen, videos])

  useEffect(() => {
    if (!confirmUnlinkId) return
    const timer = window.setTimeout(() => setConfirmUnlinkId(null), 4000)
    return () => window.clearTimeout(timer)
  }, [confirmUnlinkId])

  if (!isOpen) return null

  const handleLink = async (videoIdToLink?: string, sugMeta?: VideoSuggestion) => {
    const raw = videoIdToLink ?? newVideoInput
    const cleanId = extractVideoId(raw)
    if (!/^[a-zA-Z0-9_-]{11}$/.test(cleanId)) {
      setError("Enter a valid 11-character YouTube video ID or URL.")
      return
    }
    if (videos.some((v) => v.videoId === cleanId)) {
      setError("That video is already linked to these lyrics.")
      return
    }

    try {
      setLinkingId(cleanId)
      setError(null)
      if (sugMeta) {
        const enriched: VideoMetadata = {
          title: sugMeta.title,
          artist: sugMeta.artist || sugMeta.author || variant.artist,
          song: sugMeta.title,
          authorName: sugMeta.artist || sugMeta.author || "",
          thumbnailUrl:
            sugMeta.artworkUrl ||
            sugMeta.thumbnailUrl ||
            `https://i.ytimg.com/vi/${cleanId}/mqdefault.jpg`,
        }
        videoMetaCache.set(cleanId, enriched)
        setMetaMap((prev) => ({ ...prev, [cleanId]: enriched }))
      }
      const res = await linkVideoToLyric(variant.id, cleanId)
      setVideos(res.videos)
      if (!videoIdToLink) setNewVideoInput("")
      setConfirmLinkSug(null)
      pushToast({ kind: "success", message: `Linked ${cleanId}` })
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link video")
    } finally {
      setLinkingId(null)
    }
  }

  const handleUnlink = async (videoIdToUnlink: string) => {
    try {
      setUnlinkingId(videoIdToUnlink)
      setError(null)
      const res = await unlinkVideoFromLyric(variant.id, videoIdToUnlink)
      setVideos(res.videos)
      setConfirmUnlinkId(null)
      pushToast({ kind: "info", message: `Removed ${videoIdToUnlink}` })
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove video")
    } finally {
      setUnlinkingId(null)
    }
  }

  const unlinkedSuggestions = suggestions.filter((s) => !videos.some((v) => v.videoId === s.videoId))
  const likely = unlinkedSuggestions.filter((s) => s.match?.level !== "different")
  const others = unlinkedSuggestions.filter((s) => s.match?.level === "different")
  const visibleLikely = showAllLikely ? likely : likely.slice(0, SUGGESTED_PAGE_SIZE)

  const renderSuggestionRow = (sug: VideoSuggestion) => {
    const dur = sug.durationSeconds ?? sug.duration
    const level = sug.match?.level
    const isConfirming = confirmLinkSug?.videoId === sug.videoId
    const busy = linkingId === sug.videoId
    const thumbSrc = sug.artworkUrl || sug.thumbnailUrl || `https://i.ytimg.com/vi/${sug.videoId}/mqdefault.jpg`

    return (
      <li key={sug.videoId} className="space-y-2">
        <div className={rowClass}>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <VideoThumb videoId={sug.videoId} src={thumbSrc} alt={sug.title} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <a
                  href={youTubeMusicUrl(sug.videoId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={sug.videoId}
                  className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-unison-text transition-colors hover:underline"
                >
                  <span className="truncate">{sug.title}</span>
                  <IconExternalLink aria-hidden className="size-3 shrink-0 text-unison-text-muted" stroke={1.5} />
                </a>
                {level ? (
                  <Chip tone={level === "same" ? "good" : level === "related" ? "warn" : "plain"}>
                    {level === "same" ? "Same song" : level === "related" ? "Related" : "Different"}
                  </Chip>
                ) : null}
              </div>
              <div className="mt-0.5 truncate text-xs text-unison-text-muted">
                {[sug.artist || sug.author, sug.album, formatSec(dur), sug.videoId].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>

          {isOwner ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const titleDiffers = normalizeTitle(sug.title) !== normalizeTitle(variant.song)
                if (level !== "same" && titleDiffers && !isConfirming) {
                  setConfirmLinkSug(sug)
                  return
                }
                void handleLink(sug.videoId, sug)
              }}
              className={
                isNew
                  ? isConfirming
                    ? raisedChipClass
                    : chipClass
                  : buttonClass(isConfirming ? "primary" : "fill", "sm")
              }
            >
              {busy ? "Adding…" : isConfirming ? "Confirm add" : "Add video"}
            </button>
          ) : null}
        </div>

        {isConfirming ? (
          <Callout tone="warn" icon={<IconAlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" stroke={1.5} />}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <b>Link “{sug.title}” to “{variant.song}”?</b> Make sure the audio timing matches these lyrics.
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmLinkSug(null)}
                  className={isNew ? chipClass : buttonClass("ghost", "sm")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleLink(sug.videoId, sug)}
                  className={isNew ? raisedChipClass : buttonClass("primary", "sm")}
                >
                  {busy ? "Adding…" : "Add video"}
                </button>
              </div>
            </div>
          </Callout>
        ) : null}
      </li>
    )
  }

  return (
    <CouncilOverlay
      open={isOpen}
      onOpenChange={(val) => (val ? null : onClose())}
      label="Linked videos"
      className="top-1/2 flex max-h-[85vh] w-[min(560px,calc(100vw-32px))] -translate-y-1/2 flex-col"
    >
      <div className={cn("flex items-start justify-between gap-4 border-b px-6 py-5", dividerClass)}>
        <div className="flex min-w-0 items-center gap-3.5">
          <SongThumbnail
            videoId={variant.videoId}
            song={variant.song}
            artist={variant.artist}
            className="size-12 shrink-0 rounded-lg outline outline-1 -outline-offset-1 outline-white/10"
          />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-unison-text">Linked videos</h2>
            <p className="mt-0.5 truncate text-xs text-unison-text-secondary">
              {variant.song} · {variant.artist}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className={cn(
            glassClass,
            "grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-unison-text-secondary transition-[background-color,color,scale] duration-150 ease-out hover:bg-white/[0.14] hover:text-unison-text active:scale-[0.96]",
          )}
        >
          <IconX className="size-[15px]" stroke={2} />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {error ? (
          <Callout tone="warn" icon={<IconAlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" stroke={1.5} />}>
            {error}
          </Callout>
        ) : null}

        <div>
          <BlockHead title="Linked videos" aside={`${videos.length}`} />
          {loading ? (
            <div className="space-y-2">
              <Bone className="h-14 w-full rounded-[10px]" />
              <Bone className="h-14 w-full rounded-[10px]" />
            </div>
          ) : (
            <ul className="space-y-2">
              {videos.map((item) => {
                const isPrimary = item.primary || item.isPrimary || item.videoId === variant.videoId
                const confirming = confirmUnlinkId === item.videoId
                const busy = unlinkingId === item.videoId
                const meta = metaMap[item.videoId]
                const displayTitle = meta?.title || (isPrimary ? `${variant.song} · ${variant.artist}` : item.videoId)
                const sublineParts = [
                  meta?.authorName || (isPrimary ? variant.artist : undefined),
                  item.videoId,
                ].filter(Boolean)

                return (
                  <li key={item.videoId} className={rowClass}>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <VideoThumb
                        videoId={item.videoId}
                        src={meta?.thumbnailUrl}
                        alt={displayTitle}
                      />
                      <div className="min-w-0 flex-1">
                        <a
                          href={youTubeMusicUrl(item.videoId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1.5 text-[13px] font-medium text-unison-text transition-colors hover:underline"
                        >
                          <span className="truncate">{displayTitle}</span>
                          <IconExternalLink aria-hidden className="size-3.5 shrink-0 text-unison-text-muted" stroke={1.5} />
                        </a>
                        <div className="mt-0.5 truncate font-mono text-xs text-unison-text-muted">
                          {sublineParts.join(" · ")}
                        </div>
                      </div>
                    </div>

                    {isPrimary ? (
                      <Chip>Primary</Chip>
                    ) : isOwner ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (!confirming) {
                            setConfirmUnlinkId(item.videoId)
                            return
                          }
                          void handleUnlink(item.videoId)
                        }}
                        className={
                          isNew
                            ? cn(chipClass, confirming && "bg-red-500/20 text-[#fca5a5]")
                            : buttonClass(confirming ? "danger" : "ghost", "sm")
                        }
                      >
                        <IconTrash className={chipIconClass} stroke={1.75} />
                        <span>{busy ? "Removing…" : confirming ? "Confirm" : "Remove"}</span>
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}

          {isOwner ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleLink()
              }}
              className="mt-3 flex gap-2"
            >
              <input
                type="text"
                value={newVideoInput}
                onChange={(e) => {
                  setNewVideoInput(e.target.value)
                  if (error) setError(null)
                }}
                placeholder="YouTube or YouTube Music URL or 11-character ID"
                spellCheck={false}
                autoComplete="off"
                className={cn(fieldClass, "font-mono text-[13px]")}
              />
              <button
                type="submit"
                disabled={Boolean(linkingId) || !newVideoInput.trim()}
                className={
                  isNew
                    ? cn(raisedChipClass, "h-[38px] px-3.5 disabled:cursor-not-allowed disabled:opacity-45")
                    : buttonClass("primary", "sm")
                }
              >
                {linkingId && !confirmLinkSug ? "Adding…" : "Add video"}
              </button>
            </form>
          ) : null}
        </div>

        {isOwner ? (
          <div>
            <BlockHead title="Suggested videos" />
            {loading ? (
              <div className="space-y-2">
                <Bone className="h-14 w-full rounded-[10px]" />
                <Bone className="h-14 w-full rounded-[10px]" />
              </div>
            ) : unlinkedSuggestions.length === 0 ? (
              <p className="text-[13px] text-unison-text-muted">No suggested videos found for this track.</p>
            ) : (
              <ul className="space-y-2">
                {likely.length === 0 ? (
                  <li className="text-[13px] text-unison-text-muted">No matching videos with similar duration.</li>
                ) : (
                  visibleLikely.map(renderSuggestionRow)
                )}

                {likely.length > SUGGESTED_PAGE_SIZE && !showAllLikely ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => setShowAllLikely(true)}
                      className={isNew ? chipClass : buttonClass("ghost", "sm")}
                    >
                      Show more ({likely.length - SUGGESTED_PAGE_SIZE})
                    </button>
                  </li>
                ) : null}

                {others.length > 0 ? (
                  <li className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowOthers((v) => !v)}
                      className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-unison-text-muted transition-colors hover:text-unison-text"
                    >
                      <IconChevronDown
                        className={cn("size-3.5 transition-transform", !showOthers && "-rotate-90")}
                        stroke={2}
                      />
                      <span>
                        {showOthers ? "Hide other versions" : `Other versions (${others.length})`}
                      </span>
                    </button>
                    {showOthers ? <ul className="mt-2 space-y-2">{others.map(renderSuggestionRow)}</ul> : null}
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </CouncilOverlay>
  )
}
