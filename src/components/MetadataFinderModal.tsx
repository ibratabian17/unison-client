import { useCallback, useEffect, useState } from "react"
import { IconDisc, IconSearch, IconX } from "@tabler/icons-react"
import { CouncilOverlay } from "@/components/council/CouncilOverlay"
import { Segmented } from "@/components/council/Segmented"
import { Chip } from "@/components/council/detail-parts"
import { Bone } from "@/components/skeleton"
import { buttonClass, chipIconClass, glassClass, raisedChipClass } from "@/components/ui"
import { useUiMode } from "@/context/UiModeContext"
import {
  type BiniLinkResolvedTrack,
  enrichTrackViaBiniLink,
  lookupBiniLink,
  searchSongsViaBiniLink,
} from "@/lib/binilink"
import { cn } from "@/lib/cn"

export interface SelectedMetadata {
  song: string
  artist: string
  album?: string
  duration?: number
  isrc?: string
  artworkUrl?: string
  youtubeId?: string
  source?: string
}

interface MetadataFinderModalProps {
  isOpen: boolean
  initialQuery: string
  onClose: () => void
  onSelect: (metadata: SelectedMetadata) => void
}

type LookupMode = "search" | "isrc" | "spotify" | "apple_music" | "tidal" | "youtube"

const glassFieldClass =
  "w-full rounded-[10px] bg-white/[0.04] px-3 py-2 text-sm text-unison-text placeholder:text-unison-text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_0_1px_rgba(255,255,255,0.08)] focus:bg-white/[0.07] focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_0_0_1px_rgba(255,255,255,0.2)] focus:outline-none disabled:opacity-60"
const solidFieldClass =
  "w-full rounded-md border border-unison-border bg-unison-bg px-3 py-2 text-sm text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none disabled:opacity-60"

function formatDurationSec(seconds?: number): string {
  if (!seconds || seconds <= 0) return ""
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function MetadataFinderModal({
  isOpen,
  initialQuery,
  onClose,
  onSelect,
}: MetadataFinderModalProps) {
  const { uiMode } = useUiMode()
  const isNew = uiMode === "new"
  const fieldClass = isNew ? glassFieldClass : solidFieldClass
  const dividerClass = isNew ? "border-white/[0.06]" : "border-unison-border"

  const [query, setQuery] = useState(initialQuery)
  const [mode, setMode] = useState<LookupMode>("search")
  const [results, setResults] = useState<BiniLinkResolvedTrack[]>([])
  const [loading, setLoading] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const performLookup = useCallback(
    async (rawTerm: string, activeMode: LookupMode = mode) => {
      const term = rawTerm.trim()
      if (!term) return
      try {
        setLoading(true)
        setError(null)
        let hits: BiniLinkResolvedTrack[] = []
        if (activeMode === "search") {
          hits = await lookupBiniLink(term, "auto")
          if (hits.length === 0) {
            hits = await searchSongsViaBiniLink(term)
          }
        } else {
          hits = await lookupBiniLink(term, activeMode)
        }
        setResults(hits)
        if (hits.length === 0) {
          setError(
            activeMode === "search"
              ? "No tracks found. Try searching by song title and artist, or paste an ISRC or track link."
              : `No BiniLink record matched that ${activeMode.replace("_", " ")} input.`,
          )
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Track search failed")
      } finally {
        setLoading(false)
      }
    },
    [mode],
  )

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery)
      setResults([])
      setError(null)
      if (initialQuery.trim()) {
        void performLookup(initialQuery, "search")
      }
    } else {
      setResults([])
      setError(null)
      setResolvingId(null)
    }
  }, [isOpen, initialQuery, performLookup])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void performLookup(query, mode)
  }

  const handlePick = async (item: BiniLinkResolvedTrack) => {
    try {
      setResolvingId(item.id)
      const enriched = await enrichTrackViaBiniLink(item)
      onSelect({
        song: enriched.song,
        artist: enriched.artist,
        album: enriched.album,
        duration: enriched.duration,
        isrc: enriched.isrc,
        artworkUrl: enriched.artworkUrl,
        youtubeId: enriched.youtubeId,
        source: enriched.matchedVia || (enriched.appleMusicId ? "Apple Music" : "BiniLink"),
      })
      onClose()
    } finally {
      setResolvingId(null)
    }
  }

  return (
    <CouncilOverlay
      open={isOpen}
      onOpenChange={(val) => (val ? null : onClose())}
      label="Find song"
      className="top-1/2 flex max-h-[84vh] w-[min(600px,calc(100vw-32px))] -translate-y-1/2 flex-col"
    >
      <div className={cn("flex items-center justify-between gap-4 border-b px-6 py-4", dividerClass)}>
        <div>
          <h2 className="text-base font-semibold text-unison-text">Find song</h2>
          <p className="mt-0.5 text-xs text-unison-text-muted">
            Search the Apple Music catalog or match via BiniLink
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={cn(
            glassClass,
            "grid size-8 cursor-pointer place-items-center rounded-full text-unison-text-secondary transition-[background-color,color,scale] duration-150 ease-out hover:bg-white/[0.14] hover:text-unison-text active:scale-[0.96]",
          )}
        >
          <IconX className="size-[15px]" stroke={2} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className={cn("space-y-3 border-b px-6 py-4", dividerClass)}>
        <div className="overflow-x-auto">
          <Segmented
            label="Lookup mode"
            value={mode}
            onChange={(next) => {
              setMode(next)
              if (query.trim()) void performLookup(query, next)
            }}
            options={[
              { value: "search", label: "Catalog" },
              { value: "isrc", label: "ISRC" },
              { value: "spotify", label: "Spotify" },
              { value: "apple_music", label: "Apple Music" },
              { value: "tidal", label: "Tidal" },
              { value: "youtube", label: "YouTube" },
            ]}
          />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === "search"
                ? "Song title, artist, album, or paste an ISRC or track link…"
                : `Paste ${mode.replace("_", " ")} ID or URL…`
            }
            spellCheck={false}
            autoComplete="off"
            className={fieldClass}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className={
              isNew
                ? cn(raisedChipClass, "h-[38px] px-3.5 disabled:cursor-not-allowed disabled:opacity-45")
                : buttonClass("primary", "sm")
            }
          >
            <IconSearch className={chipIconClass} stroke={1.75} />
            <span>{mode === "search" ? "Search" : "Resolve"}</span>
          </button>
        </div>
      </form>

      <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="space-y-2">
            <Bone className="h-16 w-full rounded-[10px]" />
            <Bone className="h-16 w-full rounded-[10px]" />
            <Bone className="h-16 w-full rounded-[10px]" />
          </div>
        ) : error ? (
          <p className="py-10 text-center text-[13px] text-unison-text-muted">{error}</p>
        ) : results.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-unison-text-muted">
            Search by title and artist, or paste an ISRC or streaming link to fill song details.
          </p>
        ) : (
          results.map((item) => {
            const isResolvingThis = resolvingId === item.id
            return (
              <button
                key={item.id}
                type="button"
                disabled={Boolean(resolvingId)}
                onClick={() => void handlePick(item)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-3 p-3 text-left transition-colors disabled:opacity-50",
                  isNew
                    ? "rounded-[12px] bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.06)] hover:bg-white/[0.08]"
                    : "rounded-[10px] bg-white/[0.02] shadow-[inset_0_0_0_1px_var(--color-unison-border)] hover:bg-unison-bg-hover",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-unison-surface outline outline-1 -outline-offset-1 outline-white/10">
                    {item.artworkUrl ? (
                      <img src={item.artworkUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center text-unison-text-muted">
                        <IconDisc className="size-4" stroke={1.5} />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-unison-text">
                      {item.song || "Resolved track"}
                    </p>
                    <p className="truncate text-xs text-unison-text-secondary">
                      {item.artist || "Unknown artist"}
                      {item.album ? ` · ${item.album}` : ""}
                      {item.releaseDate ? ` (${item.releaseDate.slice(0, 4)})` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {isResolvingThis ? <Chip>Matching…</Chip> : null}
                  {item.isrc ? (
                    <Chip>
                      <span className="font-mono">{item.isrc}</span>
                    </Chip>
                  ) : null}
                  {item.duration ? (
                    <Chip>
                      <span className="font-mono">{formatDurationSec(item.duration)}</span>
                    </Chip>
                  ) : null}
                </div>
              </button>
            )
          })
        )}
      </div>
    </CouncilOverlay>
  )
}
