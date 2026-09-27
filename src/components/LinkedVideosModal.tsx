import { useEffect, useRef, useState } from "react"
import {
  IconCheck,
  IconExternalLink,
  IconLink,
  IconLoader2,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react"
import type { LinkedVideo, VideoSuggestion, VariantFull } from "@/lib/types"
import {
  fetchLinkedVideos,
  linkVideoToLyric,
  unlinkVideoFromLyric,
  fetchSuggestedVideos,
} from "@/lib/api"
import { extractVideoId } from "@/lib/lyrics-parser"

interface LinkedVideosModalProps {
  variant: VariantFull
  isOwner: boolean
  isOpen: boolean
  onClose: () => void
  onUpdated: () => void
}

export function LinkedVideosModal({
  variant,
  isOwner,
  isOpen,
  onClose,
  onUpdated,
}: LinkedVideosModalProps) {
  const [videos, setVideos] = useState<LinkedVideo[]>([])
  const [suggestions, setSuggestions] = useState<VideoSuggestion[]>([])
  const [newVideoInput, setNewVideoInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState(false)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

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

  const loadData = async (cancelled = false) => {
    try {
      setLoading(true)
      setError(null)
      const [vRes, sRes] = await Promise.all([
        fetchLinkedVideos(variant.id).catch(() => ({ videos: [] })),
        fetchSuggestedVideos(variant.id).catch(() => ({ suggestions: [] })),
      ])
      if (cancelled) return
      const list = vRes.videos.length > 0 ? vRes.videos : [{ videoId: variant.videoId, primary: true }]
      if (!list.some((v) => v.videoId === variant.videoId)) {
        list.unshift({ videoId: variant.videoId, primary: true })
      }
      setVideos(list)
      setSuggestions(sRes.suggestions)
    } catch (err) {
      if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load linked videos")
    } finally {
      if (!cancelled) setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    void loadData(cancelled)
    return () => {
      cancelled = true
    }
  }, [isOpen, variant.id, variant.videoId])

  if (!isOpen) return null

  const handleLink = async (videoIdToLink?: string) => {
    const raw = videoIdToLink ?? newVideoInput
    const cleanId = extractVideoId(raw)
    if (!/^[a-zA-Z0-9_-]{11}$/.test(cleanId)) {
      setError("Please enter a valid 11-character YouTube video ID or URL.")
      return
    }

    if (videos.some((v) => v.videoId === cleanId)) {
      setError("This video is already linked.")
      return
    }

    try {
      setLinking(true)
      setError(null)
      setSuccessMsg(null)
      const res = await linkVideoToLyric(variant.id, cleanId)
      setVideos(res.videos)
      setNewVideoInput("")
      setSuccessMsg(`Linked ${cleanId}`)
      onUpdated()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link video")
    } finally {
      setLinking(false)
    }
  }

  const handleUnlink = async (videoIdToUnlink: string) => {
    if (!window.confirm(`Unlink video ${videoIdToUnlink} from this lyric?`)) return
    try {
      setUnlinkingId(videoIdToUnlink)
      setError(null)
      setSuccessMsg(null)
      const res = await unlinkVideoFromLyric(variant.id, videoIdToUnlink)
      setVideos(res.videos)
      setSuccessMsg(`Unlinked ${videoIdToUnlink}`)
      onUpdated()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink video")
    } finally {
      setUnlinkingId(null)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Video Variants"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,10,12,0.75)] p-4 backdrop-blur-[6px] animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative flex flex-col w-full max-w-lg max-h-[85vh] overflow-hidden rounded-[18px] bg-[#111114] border border-unison-border-strong shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-unison-border/80 px-5 py-3.5 bg-[#141418]">
          <div className="min-w-0 pr-8">
            <h2 className="text-[15px] font-bold text-unison-text tracking-[-0.01em]">Linked Video Variants</h2>
            <p className="text-[12px] text-unison-text-muted truncate">{variant.song} · {variant.artist}</p>
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
          <p className="text-[12px] text-unison-text-secondary leading-relaxed">
            Link YouTube variants (MV, Lyric Video, Audio) so listeners across versions get these lyrics.
          </p>

          {error && (
            <div className="rounded-[8px] bg-red-500/10 border border-red-500/20 px-3 py-2 text-[12px] text-red-400">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="rounded-[8px] bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-[12px] text-emerald-300 flex items-center gap-1.5">
              <IconCheck className="size-3.5 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Add Video Link Form */}
          {isOwner && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleLink()
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={newVideoInput}
                onChange={(e) => setNewVideoInput(e.target.value)}
                placeholder="YouTube Video ID or URL..."
                className="flex-1 font-mono text-[12.5px] rounded-[8px] border border-unison-border bg-[#0a0a0c] px-3 py-1.5 text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none"
              />
              <button
                type="submit"
                disabled={linking || !newVideoInput.trim()}
                className="inline-flex items-center gap-1 rounded-[8px] bg-red-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-red-500 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
              >
                {linking ? <IconLoader2 className="size-3 animate-spin" /> : <IconPlus className="size-3.5" />}
                <span>Link</span>
              </button>
            </form>
          )}

          {/* Linked Videos List */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-unison-text-muted uppercase tracking-wider">
              Linked Videos ({videos.length})
            </span>

            {loading ? (
              <div className="flex h-24 items-center justify-center text-unison-text-muted">
                <IconLoader2 className="size-4 animate-spin" />
              </div>
            ) : (
              <div className="space-y-1.5">
                {videos.map((item) => {
                  const isPrimary = item.primary || item.videoId === variant.videoId
                  return (
                    <div
                      key={item.videoId}
                      className="flex items-center justify-between gap-2.5 rounded-[9px] border border-unison-border/60 bg-[#0d0d10] p-2 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={`https://i.ytimg.com/vi/${item.videoId}/default.jpg`}
                          alt=""
                          className="size-9 rounded-[6px] object-cover border border-unison-border bg-black shrink-0"
                        />
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[12px] font-semibold text-unison-text truncate">
                              {item.videoId}
                            </span>
                            {isPrimary ? (
                              <span className="rounded-full bg-emerald-500/15 text-emerald-400 text-[9.5px] font-semibold px-1.5 py-0.5 leading-none">
                                Primary
                              </span>
                            ) : (
                              <span className="rounded-full bg-white/10 text-unison-text-muted text-[9.5px] px-1.5 py-0.5 leading-none">
                                Variant
                              </span>
                            )}
                          </div>
                          <a
                            href={`https://www.youtube.com/watch?v=${item.videoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-unison-text-muted hover:text-unison-text hover:underline"
                          >
                            <span>Open on YouTube</span>
                            <IconExternalLink className="size-2.5" />
                          </a>
                        </div>
                      </div>

                      {isOwner && !isPrimary && (
                        <button
                          type="button"
                          disabled={unlinkingId === item.videoId}
                          onClick={() => handleUnlink(item.videoId)}
                          className="rounded-[6px] p-1.5 text-unison-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Unlink variant"
                        >
                          {unlinkingId === item.videoId ? (
                            <IconLoader2 className="size-3.5 animate-spin text-red-400" />
                          ) : (
                            <IconTrash className="size-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Suggested Matches */}
          {suggestions.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-unison-border/60">
              <span className="text-[11px] font-semibold text-unison-text-muted uppercase tracking-wider">
                Suggested Matches
              </span>
              <div className="space-y-1">
                {suggestions.map((sug) => (
                  <div
                    key={sug.videoId}
                    className="flex items-center justify-between gap-2 rounded-[8px] border border-unison-border/40 bg-[#0a0a0c] p-2 text-[12px]"
                  >
                    <div className="min-w-0 truncate">
                      <p className="font-medium text-unison-text truncate text-[12px]">{sug.title}</p>
                      <p className="font-mono text-[10px] text-unison-text-muted">{sug.videoId}</p>
                    </div>
                    {isOwner && !videos.some((v) => v.videoId === sug.videoId) && (
                      <button
                        type="button"
                        onClick={() => void handleLink(sug.videoId)}
                        disabled={linking}
                        className="rounded-[6px] bg-unison-surface hover:bg-unison-bg-hover px-2.5 py-1 text-[11.5px] text-unison-text transition-colors cursor-pointer shrink-0 flex items-center gap-1 border border-unison-border"
                      >
                        <IconLink className="size-3" />
                        <span>Link</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-unison-border/80 px-5 py-3 bg-[#141418]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] border border-unison-border bg-unison-surface px-3.5 py-1.5 text-[12px] font-medium text-unison-text hover:bg-unison-bg-hover transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
