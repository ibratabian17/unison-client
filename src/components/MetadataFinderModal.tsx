import { useState, useEffect, useCallback } from "react"
import { searchAppleMusic, formatArtworkUrl, type AppleMusicSong } from "@/lib/apple-music"
import {
  IconSearch,
  IconX,
  IconLoader2,
  IconMusic,
  IconDisc,
  IconClock,
  IconBarcode,
} from "@tabler/icons-react"

export interface SelectedMetadata {
  song: string
  artist: string
  album?: string
  duration?: number
  isrc?: string
  artworkUrl?: string
}

interface MetadataFinderModalProps {
  isOpen: boolean
  initialQuery: string
  onClose: () => void
  onSelect: (metadata: SelectedMetadata) => void
}

function formatDuration(ms?: number): string {
  if (!ms) return "0:00"
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export function MetadataFinderModal({
  isOpen,
  initialQuery,
  onClose,
  onSelect,
}: MetadataFinderModalProps) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<AppleMusicSong[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const performSearch = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) return
    try {
      setLoading(true)
      setError(null)
      const data = await searchAppleMusic(searchTerm)
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery)
      if (initialQuery.trim()) {
        void performSearch(initialQuery)
      }
    } else {
      setResults([])
      setError(null)
    }
  }, [isOpen, initialQuery, performSearch])

  if (!isOpen) return null

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void performSearch(query)
  }

  const handlePick = (item: AppleMusicSong) => {
    const attr = item.attributes
    onSelect({
      song: attr.name,
      artist: attr.artistName,
      album: attr.albumName,
      duration: attr.durationInMillis ? Math.round(attr.durationInMillis / 1000) : undefined,
      isrc: attr.isrc,
      artworkUrl: formatArtworkUrl(attr.artwork, 300),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="flex flex-col w-full max-w-xl max-h-[80vh] rounded-xl border border-unison-border bg-unison-bg-elevated shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-unison-border px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-sm text-unison-text">
            <IconMusic className="size-4 text-unison-text-secondary" />
            <span>Select Track</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded p-1 text-unison-text-muted hover:bg-unison-bg-hover hover:text-unison-text transition-colors"
          >
            <IconX className="size-4" />
          </button>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="p-3 border-b border-unison-border bg-unison-bg/30">
          <div className="relative">
            <IconSearch className="absolute left-2.5 top-2.5 size-3.5 text-unison-text-muted" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, artist, or album..."
              className="w-full rounded-lg border border-unison-border bg-unison-bg px-8 py-1.5 text-xs text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none"
            />
            {loading && (
              <div className="absolute right-2.5 top-2.5">
                <IconLoader2 className="size-3.5 animate-spin text-unison-text-muted" />
              </div>
            )}
          </div>
        </form>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex h-40 flex-col items-center justify-center text-unison-text-muted space-y-2">
              <IconLoader2 className="size-5 animate-spin text-unison-text-secondary" />
              <p className="text-xs">Searching catalog...</p>
            </div>
          ) : error ? (
            <div className="flex h-32 flex-col items-center justify-center text-red-400 text-center p-4">
              <p className="text-xs">{error}</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-unison-text-muted text-center space-y-1">
              <IconMusic className="size-6 opacity-30 mb-1" />
              <p className="text-xs font-medium text-unison-text">No tracks found</p>
              <p className="text-[11px]">Try adjusting your search terms.</p>
            </div>
          ) : (
            results.map((item) => {
              const attr = item.attributes
              const artworkUrl = formatArtworkUrl(attr.artwork, 80)

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePick(item)}
                  className="group flex w-full items-center justify-between gap-3 rounded-lg border border-transparent p-2 text-left transition-colors hover:border-unison-border hover:bg-unison-bg-hover cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Artwork */}
                    <div className="size-10 rounded bg-black/40 border border-unison-border overflow-hidden shrink-0">
                      {artworkUrl ? (
                        <img src={artworkUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <IconDisc className="size-4 opacity-40" />
                        </div>
                      )}
                    </div>

                    {/* Metadata text */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-medium text-xs text-unison-text group-hover:text-white transition-colors truncate">
                        {attr.name}
                      </p>
                      <p className="text-[11px] text-unison-text-secondary truncate">{attr.artistName}</p>
                      {attr.albumName && (
                        <p className="text-[10px] text-unison-text-muted truncate">
                          {attr.albumName}
                          {attr.releaseDate ? ` · ${attr.releaseDate.slice(0, 4)}` : ""}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Pills */}
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-unison-text-muted shrink-0">
                    {attr.isrc && (
                      <span className="rounded bg-white/5 px-1.5 py-0.5 border border-unison-border/40 flex items-center gap-1">
                        <IconBarcode className="size-3 text-unison-text-secondary" />
                        {attr.isrc}
                      </span>
                    )}
                    {attr.durationInMillis && (
                      <span className="rounded bg-white/5 px-1.5 py-0.5 border border-unison-border/40 flex items-center gap-1">
                        <IconClock className="size-3 text-unison-text-secondary" />
                        {formatDuration(attr.durationInMillis)}
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-unison-border px-4 py-2 text-[11px] text-unison-text-muted bg-unison-bg/20">
          <span>Apple Music Catalog</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2.5 py-1 text-xs text-unison-text-secondary hover:bg-unison-bg-hover hover:text-unison-text transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
