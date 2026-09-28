import { useState, useEffect, useCallback } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useSession } from "@/auth/useSession"
import { fetchFeed, fetchMySubmissions, voteVariant, unvoteVariant, fetchSongLeaderboard } from "@/lib/api"
import { useAsyncData } from "@/hooks/useAsyncData"
import { EmptyState } from "@/components/EmptyState"
import { LeaderboardSection } from "@/components/LeaderboardSection"
import { SealedShelf } from "@/components/SealedShelf"
import { SongRow, SongRowSkeletonList } from "@/components/SongRow"
import {
  IconThumbUp,
  IconThumbDown,
  IconPlayerPlay,
  IconFilter,
  IconLoader2,
  IconLayersSubtract,
  IconFlame,
  IconClock,
  IconUser,
} from "@tabler/icons-react"
import type { FeedFilters, FeedSort, FeedSyncType, FeedTier, FeedFormat, UnisonFeedEntry } from "@/lib/types"

const DEFAULT_FILTERS: FeedFilters = {
  sort: "newest",
  sortDir: "desc",
  syncType: "all",
  tier: "all",
  format: "all",
  language: "all",
}

const MOST_WANTED_PREVIEW = 10

export function FeedPage() {
  const session = useSession()
  const signedIn = session.status === "signed-in"
  const [searchParams, setSearchParams] = useSearchParams()

  const tabParam = searchParams.get("tab")
  const [activeTab, setActiveTab] = useState<"feed" | "songs" | "mine">(
    tabParam === "songs" ? "songs" : tabParam === "mine" ? "mine" : "feed"
  )

  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS)
  const [entries, setEntries] = useState<UnisonFeedEntry[]>([])
  const [nextCursor, setNextCursor] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Songs Leaderboard data for "songs" tab
  const songsData = useAsyncData(fetchSongLeaderboard, "leaderboard:songs")

  const loadFeed = useCallback(async (isInitial = true, cursor?: number) => {
    if (activeTab === "songs") return
    try {
      if (isInitial) setLoading(true)
      else setLoadingMore(true)
      setError(null)

      const res = activeTab === "mine"
        ? await fetchMySubmissions(filters, cursor)
        : await fetchFeed(filters, cursor)

      if (isInitial) {
        setEntries(res.entries)
      } else {
        setEntries((prev) => [...prev, ...res.entries])
      }
      setNextCursor(res.nextCursor)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed")
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [activeTab, filters])

  useEffect(() => {
    if (activeTab !== "songs") {
      void loadFeed(true)
    }
  }, [loadFeed, activeTab])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const k = e.key.toUpperCase()
      if (k === "1")
        setFilters((f) => ({
          ...f,
          sort: "newest",
          sortDir: f.sort === "newest" ? (f.sortDir === "desc" ? "asc" : "desc") : "desc",
        }))
      else if (k === "2")
        setFilters((f) => ({
          ...f,
          sort: "top-rated",
          sortDir: f.sort === "top-rated" ? (f.sortDir === "desc" ? "asc" : "desc") : "desc",
        }))
      else if (k === "3")
        setFilters((f) => ({
          ...f,
          sort: "most-voted",
          sortDir: f.sort === "most-voted" ? (f.sortDir === "desc" ? "asc" : "desc") : "desc",
        }))
      else if (k === "Q") setFilters((f) => ({ ...f, syncType: "richsync" }))
      else if (k === "W") setFilters((f) => ({ ...f, syncType: "linesync" }))
      else if (k === "E") setFilters((f) => ({ ...f, syncType: "plain" }))
      else if (k === "D") setFilters((f) => ({ ...f, tier: "trusted-plus" }))
      else if (k === "F") setFilters((f) => ({ ...f, tier: "top-rated" }))
      else if (k === "Z") setFilters((f) => ({ ...f, format: "lrc" }))
      else if (k === "X") setFilters((f) => ({ ...f, format: "ttml" }))
      else if (k === "C") setFilters((f) => ({ ...f, format: "plain" }))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const handleVote = async (entry: UnisonFeedEntry, value: 1 | -1) => {
    if (!signedIn) return
    const prevVote = entry.userVote
    const prevScore = entry.score
    const newVote = prevVote === value ? null : value
    const delta = newVote === null ? (prevVote === 1 ? -1 : 1) : (prevVote === null ? value : value * 2)

    setEntries((list) =>
      list.map((item) =>
        item.id === entry.id
          ? { ...item, userVote: newVote, score: item.score + delta }
          : item
      )
    )

    try {
      if (newVote === null) {
        await unvoteVariant(entry.id)
      } else {
        await voteVariant(entry.id, newVote)
      }
    } catch {
      // Revert on error
      setEntries((list) =>
        list.map((item) =>
          item.id === entry.id
            ? { ...item, userVote: prevVote, score: prevScore }
            : item
        )
      )
    }
  }

  return (
    <div className="space-y-6">
      {/* Sealed by the Council shelf */}
      <SealedShelf />

      {/* Top Header & Tab Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("feed")
              setSearchParams({})
            }}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "feed"
                ? "bg-unison-bg-elevated text-unison-text shadow-sm border border-unison-border-strong"
                : "text-unison-text-secondary hover:bg-unison-bg-hover hover:text-unison-text border border-transparent"
            }`}
          >
            <IconClock className="size-4" />
            <span>Recent Feed</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("songs")
              setSearchParams({ tab: "songs" })
            }}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "songs"
                ? "bg-unison-bg-elevated text-unison-text shadow-sm border border-unison-border-strong"
                : "text-unison-text-secondary hover:bg-unison-bg-hover hover:text-unison-text border border-transparent"
            }`}
          >
            <IconFlame className="size-4" />
            <span>Top Songs & Requests</span>
          </button>

          {signedIn && (
            <button
              type="button"
              onClick={() => {
                setActiveTab("mine")
                setSearchParams({ tab: "mine" })
              }}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === "mine"
                  ? "bg-unison-bg-elevated text-unison-text shadow-sm border border-unison-border-strong"
                  : "text-unison-text-secondary hover:bg-unison-bg-hover hover:text-unison-text border border-transparent"
              }`}
            >
              <IconUser className="size-4" />
              <span>My Submissions</span>
            </button>
          )}
        </div>

        <Link
          to="/submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-red-500"
        >
          <IconLayersSubtract className="size-4" />
          Submit Lyrics
        </Link>
      </div>

      {activeTab === "songs" ? (
        songsData.status === "loading" ? (
          <div className="space-y-8">
            <LeaderboardSection title="Most Wanted">
              <SongRowSkeletonList rows={5} />
            </LeaderboardSection>
            <LeaderboardSection title="Needs Fixing">
              <SongRowSkeletonList rows={3} />
            </LeaderboardSection>
          </div>
        ) : songsData.status === "error" ? (
          <EmptyState title="Could not load leaderboard" hint={songsData.error.message} />
        ) : (
          <div className="space-y-8">
            <LeaderboardSection
              title="Most Wanted"
              subtitle="Songs missing synced lyrics, ranked by reputation-weighted demand"
              action={
                <Link
                  to="/queue"
                  className="text-sm text-unison-text-muted transition-colors hover:text-unison-text"
                  aria-label="See all most wanted songs"
                >
                  See all →
                </Link>
              }
            >
              {songsData.data.mostWanted.length === 0 ? (
                <EmptyState title="Nothing wanted right now" hint="Request a song from the extension to seed the board." />
              ) : (
                <ul className="space-y-2">
                  {songsData.data.mostWanted.slice(0, MOST_WANTED_PREVIEW).map((entry) => (
                    <SongRow key={entry.videoId} entry={entry} />
                  ))}
                </ul>
              )}
            </LeaderboardSection>

            <LeaderboardSection
              title="Needs Fixing"
              subtitle="Songs with synced lyrics but enough bad-sync reports to investigate"
            >
              {songsData.data.needsFixing.length === 0 ? (
                <EmptyState title="Nothing flagged" hint="Reports below the threshold do not show up here." />
              ) : (
                <ul className="space-y-2">
                  {songsData.data.needsFixing.map((entry) => (
                    <SongRow key={entry.videoId} entry={entry} />
                  ))}
                </ul>
              )}
            </LeaderboardSection>
          </div>
        )
      ) : (
        <>
          {/* Filter Bar with Keyboard Shortcuts */}
          <div className="rounded-xl border border-unison-border bg-unison-bg-elevated p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-unison-text-muted">
              <IconFilter className="size-4" />
              Filters & Sorting
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 text-xs">
          {/* Sort */}
          <div className="space-y-1.5">
            <span className="text-unison-text-muted">Sort By</span>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { key: "newest", desc: "Newest", asc: "Oldest", num: "1" },
                  { key: "top-rated", desc: "Top Rated", asc: "Bottom Rated", num: "2" },
                  { key: "most-voted", desc: "Most Voted", asc: "Least Voted", num: "3" },
                ] as const
              ).map(({ key, desc, asc, num }) => {
                const isActive = filters.sort === key
                const label = isActive && filters.sortDir === "asc" ? asc : desc
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setFilters((prev) => {
                        if (prev.sort === key) {
                          return { ...prev, sortDir: prev.sortDir === "desc" ? "asc" : "desc" }
                        }
                        return { ...prev, sort: key, sortDir: "desc" }
                      })
                    }}
                    className={`flex items-center gap-1 rounded px-2 py-1 transition-colors cursor-pointer ${
                      isActive
                        ? "bg-white/15 text-unison-text font-medium border border-unison-border-strong"
                        : "bg-unison-bg hover:bg-unison-bg-hover text-unison-text-secondary border border-transparent"
                    }`}
                  >
                    <span>{label}</span>
                    {isActive && (
                      <span className="text-[10px] text-unison-text-muted">
                        {filters.sortDir === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                    <kbd className="rounded bg-black/40 px-1 text-[10px] text-unison-text-muted">{num}</kbd>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sync Type */}
          <div className="space-y-1.5">
            <span className="text-unison-text-muted">Sync Type</span>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["all", "All", ""],
                  ["richsync", "Rich", "Q"],
                  ["linesync", "Line", "W"],
                  ["plain", "Plain", "E"],
                ] as const
              ).map(([st, label, shortcut]) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, syncType: st as FeedSyncType }))}
                  className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${
                    filters.syncType === st
                      ? "bg-white/15 text-unison-text font-medium"
                      : "bg-unison-bg hover:bg-unison-bg-hover text-unison-text-secondary"
                  }`}
                >
                  <span>{label}</span>
                  {shortcut && <kbd className="rounded bg-black/40 px-1 text-[10px] text-unison-text-muted">{shortcut}</kbd>}
                </button>
              ))}
            </div>
          </div>

          {/* Tier */}
          <div className="space-y-1.5">
            <span className="text-unison-text-muted">Confidence Tier</span>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["all", "All", ""],
                  ["trusted-plus", "Trusted+", "D"],
                  ["top-rated", "Top Rated", "F"],
                ] as const
              ).map(([t, label, shortcut]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, tier: t as FeedTier }))}
                  className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${
                    filters.tier === t
                      ? "bg-white/15 text-unison-text font-medium"
                      : "bg-unison-bg hover:bg-unison-bg-hover text-unison-text-secondary"
                  }`}
                >
                  <span>{label}</span>
                  {shortcut && <kbd className="rounded bg-black/40 px-1 text-[10px] text-unison-text-muted">{shortcut}</kbd>}
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div className="space-y-1.5">
            <span className="text-unison-text-muted">Format</span>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["all", "All", ""],
                  ["lrc", "LRC", "Z"],
                  ["ttml", "TTML", "X"],
                  ["plain", "Plain", "C"],
                ] as const
              ).map(([fmt, label, shortcut]) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, format: fmt as FeedFormat }))}
                  className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${
                    filters.format === fmt
                      ? "bg-white/15 text-unison-text font-medium"
                      : "bg-unison-bg hover:bg-unison-bg-hover text-unison-text-secondary"
                  }`}
                >
                  <span>{label}</span>
                  {shortcut && <kbd className="rounded bg-black/40 px-1 text-[10px] text-unison-text-muted">{shortcut}</kbd>}
                </button>
              ))}
            </div>
          </div>

          {/* Language Selector */}
          <div className="space-y-1.5">
            <span className="text-unison-text-muted">Language</span>
            <select
              value={filters.language}
              onChange={(e) => setFilters((f) => ({ ...f, language: e.target.value }))}
              aria-label="Filter by language"
              className="w-full rounded border border-unison-border bg-unison-bg px-2 py-1 text-xs text-unison-text focus:border-unison-border-strong focus:outline-none"
            >
              <option value="all">All Languages</option>
              <option value="en">English (en)</option>
              <option value="ja">Japanese (ja)</option>
              <option value="ko">Korean (ko)</option>
              <option value="zh">Chinese (zh)</option>
              <option value="es">Spanish (es)</option>
              <option value="fr">French (fr)</option>
              <option value="de">German (de)</option>
              <option value="id">Indonesian (id)</option>
              <option value="ru">Russian (ru)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Feed Cards Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <IconLoader2 className="size-8 animate-spin text-unison-text-muted" />
        </div>
      ) : error ? (
        <EmptyState title="Unable to load feed" hint={error} />
      ) : entries.length === 0 ? (
        <EmptyState
          title="No lyrics found"
          hint={activeTab === "mine" ? "You haven't submitted any lyrics yet." : "Try adjusting your filters or search query."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="group flex flex-col justify-between rounded-xl border border-unison-border bg-unison-bg-elevated p-4 transition-all duration-200 hover:border-unison-border-strong hover:bg-unison-bg-hover"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-unison-text-secondary">
                      {entry.format}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      entry.syncType === "richsync"
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : entry.syncType === "linesync"
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        : "bg-gray-500/20 text-gray-300"
                    }`}>
                      {entry.syncType}
                    </span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    entry.confidence === "high"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : entry.confidence === "medium"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-gray-500/20 text-gray-400"
                  }`}>
                    {entry.confidence === "high" ? "Top Rated" : entry.confidence === "medium" ? "Trusted" : "Unverified"}
                  </span>
                </div>

                <Link to={`/song/${entry.videoId}`} className="block group-hover:text-red-400 transition-colors">
                  <h3 className="font-semibold text-base text-unison-text line-clamp-1">{entry.song}</h3>
                  <p className="text-xs text-unison-text-secondary line-clamp-1">{entry.artist}</p>
                </Link>
              </div>

              <div className="mt-4 pt-3 border-t border-unison-border/50 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleVote(entry, 1)}
                    disabled={!signedIn}
                    title={signedIn ? "Upvote" : "Sign in to vote"}
                    className={`flex items-center gap-1 rounded p-1.5 transition-colors ${
                      entry.userVote === 1
                        ? "bg-emerald-500/20 text-emerald-400 font-medium"
                        : "hover:bg-white/10 text-unison-text-secondary"
                    }`}
                  >
                    <IconThumbUp className="size-3.5" />
                    <span>{entry.score}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVote(entry, -1)}
                    disabled={!signedIn}
                    title={signedIn ? "Downvote" : "Sign in to vote"}
                    className={`rounded p-1.5 transition-colors ${
                      entry.userVote === -1
                        ? "bg-red-500/20 text-red-400"
                        : "hover:bg-white/10 text-unison-text-secondary"
                    }`}
                  >
                    <IconThumbDown className="size-3.5" />
                  </button>
                </div>

                <Link
                  to={`/song/${entry.videoId}`}
                  className="flex items-center gap-1 text-unison-text-muted hover:text-unison-text transition-colors"
                >
                  <IconPlayerPlay className="size-3.5" />
                  <span>Preview</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Load More */}
      {nextCursor !== undefined && !loading && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={() => loadFeed(false, nextCursor)}
            disabled={loadingMore}
            className="flex items-center gap-2 rounded-lg border border-unison-border bg-unison-bg-elevated px-6 py-2.5 text-sm font-medium text-unison-text transition-colors hover:bg-unison-bg-hover disabled:opacity-50"
          >
            {loadingMore && <IconLoader2 className="size-4 animate-spin" />}
            Load More Lyrics
          </button>
        </div>
      )}
        </>
      )}
    </div>
  )
}
