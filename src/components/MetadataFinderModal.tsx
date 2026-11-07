import { useCallback, useEffect, useState } from "react"
import {
  type BiniLinkResolvedTrack,
  lookupBiniLink,
} from "@/lib/binilink"
import { chipClass, popoverSurfaceClass } from "@/components/ui"
import { useUiMode } from "@/context/UiModeContext"
import { cn } from "@/lib/cn"
import {
  IconBarcode,
  IconClock,
  IconDisc,
  IconLink,
  IconLoader2,
  IconMusic,
  IconSearch,
  IconX,
} from "@tabler/icons-react"

export interface SelectedMetadata {
  song: string
  artist: string
  album?: string
  duration?: number
  isrc?: string
  artworkUrl?: string
  youtubeId?: string
}

interface MetadataFinderModalProps {
  isOpen: boolean
  initialQuery: string
  onClose: () => void
  onSelect: (metadata: SelectedMetadata) => void
}

function formatDurationSec(seconds?: number): string {
  if (!seconds || seconds <= 0) return ""
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

type ProviderFilter = "auto" | "isrc" | "spotify" | "apple_music" | "tidal" | "youtube"

export function MetadataFinderModal({
  isOpen,
  initialQuery,
  onClose,
  onSelect,
}: MetadataFinderModalProps) {
  const { uiMode } = useUiMode()
  const isNew = uiMode === "new"
  const [query, setQuery] = useState(initialQuery)
  const [service, setService] = useState<ProviderFilter>("auto")
  const [results, setResults] = useState<BiniLinkResolvedTrack[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const performLookup = useCallback(
    async (rawTerm: string, svc: ProviderFilter = service) => {
      const term = rawTerm.trim()
      if (!term) return
      try {
        setLoading(true)
        setError(null)
        const hits = await lookupBiniLink(term, svc)
        setResults(hits)
        if (hits.length === 0) {
          setError(
            "No BiniLink record matched that input. Enter a 12-char ISRC, or a Spotify, Apple Music, Tidal, or YouTube track URL / ID.",
          )
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "BiniLink lookup failed")
      } finally {
        setLoading(false)
      }
    },
    [service],
  )

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery)
      setResults([])
      setError(null)
      if (initialQuery.trim()) {
        void performLookup(initialQuery, "auto")
      }
    } else {
      setResults([])
      setError(null)
    }
  }, [isOpen, initialQuery, performLookup])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void performLookup(query, service)
  }

  const handlePick = (item: BiniLinkResolvedTrack) => {
    onSelect({
      song: item.song,
      artist: item.artist,
      album: item.album,
      duration: item.duration,
      isrc: item.isrc,
      artworkUrl: item.artworkUrl,
      youtubeId: item.youtubeId,
    })
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Match via BiniLink"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={cn(
          "flex max-h-[82vh] w-full max-w-xl flex-col overflow-hidden rounded-[22px]",
          isNew
            ? popoverSurfaceClass
            : "border border-unison-border-strong bg-[#121117] shadow-2xl",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-2 text-sm font-bold text-unison-text">
            <IconLink className="size-4 text-unison-text-secondary" />
            <span>Match Track via BiniLink</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="grid size-7 cursor-pointer place-items-center rounded-full bg-white/[0.06] text-unison-text-secondary transition-colors hover:bg-white/[0.12] hover:text-unison-text"
          >
            <IconX className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5 border-b border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["auto", "Auto-detect"],
                ["isrc", "ISRC"],
                ["spotify", "Spotify"],
                ["apple_music", "Apple Music"],
                ["tidal", "Tidal"],
                ["youtube", "YouTube"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setService(key)}
                className={cn(
                  "cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
                  service === key
                    ? "bg-white/15 text-unison-text"
                    : "text-unison-text-muted hover:bg-white/[0.06] hover:text-unison-text",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <IconSearch className=" absolute left-3 top-2.5 size-3.5 text-unison-text-muted" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Paste ISRC (e.g. USRC17607839) or Spotify / Apple Music / Tidal / YouTube link or ID..."
                className="w-full rounded-xl border border-white/12 bg-black/40 py-2 pr-3 pl-8 font-mono text-xs text-unison-text placeholder:font-sans placeholder:text-unison-text-muted focus:border-white/30 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className={cn(
                isNew
                  ? chipClass
                  : "inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-unison-text px-3.5 py-2 text-xs font-bold text-[#121117]",
                "h-auto disabled:opacity-40",
              )}
            >
              {loading ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconSearch className="size-3.5" />}
              <span>Resolve</span>
            </button>
          </div>
        </form>

        <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
          {loading ? (
            <div className="flex h-40 flex-col items-center justify-center space-y-2 text-unison-text-muted">
              <IconLoader2 className="size-5 animate-spin text-unison-text-secondary" />
              <p className="text-xs">Resolving on link.binimum.org…</p>
            </div>
          ) : error ? (
            <div className="flex h-36 flex-col items-center justify-center p-4 text-center text-xs text-unison-text-muted">
              <p>{error}</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center space-y-1 p-4 text-center text-unison-text-muted">
              <IconMusic className="mb-1 size-6 opacity-30" />
              <p className="text-xs font-medium text-unison-text">Resolve via BiniLink</p>
              <p className="max-w-sm text-[11px]">
                Paste an ISRC or a track URL/ID from Spotify, Apple Music, Tidal, or YouTube to fetch verified metadata and cross-provider IDs.
              </p>
            </div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handlePick(item)}
                className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:border-white/25 hover:bg-white/[0.08]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40">
                    {item.artworkUrl ? (
                      <img src={item.artworkUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <IconDisc className="size-5 opacity-40" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-semibold text-unison-text">
                      {item.song || "Resolved Track"}
                    </p>
                    <p className="truncate text-xs text-unison-text-secondary">
                      {item.artist || "Unknown Artist"}
                    </p>
                    {item.album ? (
                      <p className="truncate text-[11px] text-unison-text-muted">
                        {item.album}
                        {item.releaseDate ? ` · ${item.releaseDate.slice(0, 4)}` : ""}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1 font-mono text-[10px] text-unison-text-muted">
                  {item.isrc ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-unison-text">
                      <IconBarcode className="size-3 text-unison-text-secondary" />
                      {item.isrc}
                    </span>
                  ) : null}
                  {item.duration ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5">
                      <IconClock className="size-3 text-unison-text-secondary" />
                      {formatDurationSec(item.duration)}
                    </span>
                  ) : null}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 bg-black/20 px-4 py-2.5 text-[11px] text-unison-text-muted">
          <a
            href="https://link.binimum.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-unison-text hover:underline"
          >
            Powered by BiniLink (link.binimum.org)
          </a>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg px-2.5 py-1 text-xs text-unison-text-secondary transition-colors hover:bg-white/10 hover:text-unison-text"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
