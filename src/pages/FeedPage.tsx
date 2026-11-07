import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useSession } from "@/auth/useSession"
import { EmptyState } from "@/components/EmptyState"
import { FeedGrid } from "@/components/FeedGrid"
import { LeaderboardSection, SeeAllLink } from "@/components/LeaderboardSection"
import { useSongArtPreview } from "@/components/PageArt"
import { SealedShelf } from "@/components/SealedShelf"
import { COVER_GRID, SongCoverTile } from "@/components/SongCoverTile"
import { SongRow, SongRowSkeletonList } from "@/components/SongRow"
import { SongThumbnail } from "@/components/SongThumbnail"
import { SubmitterLine } from "@/components/SubmitterLine"
import { SyncTag } from "@/components/SyncTag"
import { Segmented } from "@/components/council/Segmented"
import { chipClass, chipIconClass, glassClass } from "@/components/ui"
import { useUiMode } from "@/context/UiModeContext"
import { useAsyncData } from "@/hooks/useAsyncData"
import {
  fetchFeed,
  fetchMySubmissions,
  fetchSongLeaderboard,
  lookupLyrics,
  unvoteVariant,
  voteVariant,
} from "@/lib/api"
import { cn } from "@/lib/cn"
import { formatRelativeTime } from "@/lib/format"
import { LAYOUT_TRANSITION } from "@/lib/motion-variants"
import { syncTypeFor } from "@/lib/sync-type"
import type {
  FeedFilters,
  FeedFormat,
  FeedSyncType,
  FeedTier,
  UnisonFeedEntry,
} from "@/lib/types"
import {
  IconLoader2,
  IconPlayerPlay,
  IconSearch,
  IconThumbDown,
  IconThumbUp,
} from "@tabler/icons-react"
import { motion } from "motion/react"

const DEFAULT_FILTERS: FeedFilters = {
  sort: "newest",
  sortDir: "desc",
  syncType: "all",
  tier: "all",
  format: "all",
  language: "all",
}

const MOST_WANTED_PREVIEW = 10

const TOP_VOTED = {
  sort: "top-rated",
  title: "Top Voted",
  subtitle: "The lyrics the community rates highest",
} as const

const RECENTLY_SYNCED = {
  sort: "newest",
  title: "Recently Synced",
  subtitle: "New lyrics the community upvoted",
} as const

type FeedTab = "discover" | "browse" | "wanted" | "mine"

function FeedEntryCard({
  entry,
  signedIn,
  isNew,
  onVote,
}: {
  entry: UnisonFeedEntry
  signedIn: boolean
  isNew: boolean
  onVote: (entry: UnisonFeedEntry, value: 1 | -1) => void
}) {
  const preview = useSongArtPreview(entry)
  const sync = syncTypeFor(entry.syncType, entry.format)

  return (
    <div
      className={cn(
        "group flex flex-col justify-between rounded-2xl p-4 transition-all duration-200",
        isNew
          ? cn(glassClass, "hover:bg-white/[0.08]")
          : "border border-unison-border bg-unison-bg-elevated hover:border-unison-border-strong hover:bg-unison-bg-hover",
      )}
    >
      <div>
        <div className="mb-2.5 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-unison-text-secondary">
              {entry.format}
            </span>
            <SyncTag kind={sync} className="text-xs" />
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              entry.confidence === "high"
                ? "border border-amber-500/30 bg-amber-500/20 text-amber-300"
                : entry.confidence === "medium"
                  ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                  : "bg-gray-500/20 text-gray-400",
            )}
          >
            {entry.confidence === "high" ? "Top Rated" : entry.confidence === "medium" ? "Trusted" : "Unverified"}
          </span>
        </div>

        <Link
          to={`/song/${entry.videoId}`}
          {...preview}
          className="flex items-center gap-3 transition-colors group-hover:text-red-400"
        >
          <SongThumbnail videoId={entry.videoId} song={entry.song} artist={entry.artist} className="size-12 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-1 text-base font-semibold text-unison-text">{entry.song}</h3>
            <p className="line-clamp-1 text-xs text-unison-text-secondary">{entry.artist}</p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-unison-text-muted">
              {entry.submitter ? (
                <SubmitterLine submitter={entry.submitter}>
                  {" · "}
                  {formatRelativeTime(entry.createdAt)}
                </SubmitterLine>
              ) : (
                <span>{formatRelativeTime(entry.createdAt)}</span>
              )}
            </div>
          </div>
        </Link>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onVote(entry, 1)}
            disabled={!signedIn}
            title={signedIn ? "Upvote" : "Sign in to vote"}
            className={cn(
              "flex cursor-pointer items-center gap-1 rounded p-1.5 transition-colors",
              entry.userVote === 1
                ? "bg-emerald-500/20 font-medium text-emerald-400"
                : "text-unison-text-secondary hover:bg-white/10",
            )}
          >
            <IconThumbUp className="size-3.5" />
            <span>{entry.score}</span>
          </button>
          <button
            type="button"
            onClick={() => onVote(entry, -1)}
            disabled={!signedIn}
            title={signedIn ? "Downvote" : "Sign in to vote"}
            className={cn(
              "cursor-pointer rounded p-1.5 transition-colors",
              entry.userVote === -1
                ? "bg-red-500/20 text-red-400"
                : "text-unison-text-secondary hover:bg-white/10",
            )}
          >
            <IconThumbDown className="size-3.5" />
          </button>
        </div>

        <Link
          to={`/song/${entry.videoId}`}
          className="flex items-center gap-1 text-unison-text-muted transition-colors hover:text-unison-text"
        >
          <IconPlayerPlay className="size-3.5" />
          <span>Open</span>
        </Link>
      </div>
    </div>
  )
}

export function FeedPage() {
  const { uiMode } = useUiMode()
  const isNew = uiMode === "new"
  const session = useSession()
  const signedIn = session.status === "signed-in"
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const tabParam = searchParams.get("tab")
  const initialTab: FeedTab =
    tabParam === "browse"
      ? "browse"
      : tabParam === "wanted" || tabParam === "songs"
        ? "wanted"
        : tabParam === "mine"
          ? "mine"
          : isNew
            ? "discover"
            : "browse"

  const [activeTab, setActiveTab] = useState<FeedTab>(initialTab)
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS)
  const [entries, setEntries] = useState<UnisonFeedEntry[]>([])
  const [nextCursor, setNextCursor] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track ID / ISRC quick lookup
  const [lookupType, setLookupType] = useState<"isrc" | "spotify" | "apple_music" | "tidal">("isrc")
  const [lookupInput, setLookupInput] = useState("")
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const songsData = useAsyncData(fetchSongLeaderboard, "leaderboard:songs")

  const switchTab = (tab: FeedTab) => {
    setActiveTab(tab)
    if (tab === "discover") setSearchParams({})
    else setSearchParams({ tab })
  }

  const loadFeed = useCallback(
    async (isInitial = true, cursor?: number) => {
      if (activeTab === "discover" || activeTab === "wanted") return
      try {
        if (isInitial) setLoading(true)
        else setLoadingMore(true)
        setError(null)

        const res =
          activeTab === "mine"
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
    },
    [activeTab, filters],
  )

  useEffect(() => {
    if (activeTab === "browse" || activeTab === "mine") {
      void loadFeed(true)
    }
  }, [loadFeed, activeTab])

  const handleVote = async (entry: UnisonFeedEntry, value: 1 | -1) => {
    if (!signedIn) return
    const prevVote = entry.userVote
    const prevScore = entry.score
    const newVote = prevVote === value ? null : value
    const delta = newVote === null ? (prevVote === 1 ? -1 : 1) : prevVote === null ? value : value * 2

    setEntries((list) =>
      list.map((item) => (item.id === entry.id ? { ...item, userVote: newVote, score: item.score + delta } : item)),
    )

    try {
      if (newVote === null) {
        await unvoteVariant(entry.id)
      } else {
        await voteVariant(entry.id, newVote)
      }
    } catch {
      setEntries((list) =>
        list.map((item) => (item.id === entry.id ? { ...item, userVote: prevVote, score: prevScore } : item)),
      )
    }
  }

  const handleProviderLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = lookupInput.trim()
    if (!val) return
    try {
      setLookupLoading(true)
      setLookupError(null)
      const hit = await lookupLyrics({ [lookupType]: val })
      navigate(`/song/${hit.videoId}?variantId=${hit.id}`)
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "No lyrics matched that ID.")
    } finally {
      setLookupLoading(false)
    }
  }

  const tabs: { id: FeedTab; label: string }[] = [
    { id: "discover", label: "Highlights" },
    { id: "browse", label: "All Submissions" },
    { id: "wanted", label: "Most Wanted" },
    ...(signedIn ? ([{ id: "mine", label: "My Submissions" }] as const) : []),
  ]

  const mostWantedSection = (
    <LeaderboardSection
      title="Most Wanted"
      subtitle="Songs missing synced lyrics, ranked by reputation-weighted demand"
      action={<SeeAllLink to="/queue" label="See all most wanted songs" />}
    >
      {songsData.status === "loading" ? (
        <SongRowSkeletonList rows={MOST_WANTED_PREVIEW} />
      ) : songsData.status === "error" ? (
        <EmptyState title="Could not load requests" hint={songsData.error.message} />
      ) : songsData.data.mostWanted.length === 0 ? (
        <EmptyState
          title="Nothing requested right now"
          hint="Click Request Song above to add a track to the community board."
        />
      ) : (
        <ul className="space-y-2">
          {songsData.data.mostWanted.slice(0, MOST_WANTED_PREVIEW).map((entry) => (
            <SongRow key={entry.videoId} entry={entry} />
          ))}
        </ul>
      )}
    </LeaderboardSection>
  )

  return (
    <div className="space-y-8">
      {/* Top Feed Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isNew ? (
          <div className={cn(glassClass, "inline-flex flex-wrap items-center gap-0.5 rounded-xl p-[3px]")}>
            {tabs.map((t) => {
              const active = activeTab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => switchTab(t.id)}
                  className={cn(
                    "relative inline-flex h-[30px] cursor-pointer items-center rounded-[9px] px-3 text-xs font-medium transition-colors duration-150",
                    active ? "text-unison-text" : "text-(--ink-2) hover:text-unison-text",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="feed-tab-pill"
                      transition={LAYOUT_TRANSITION}
                      style={{ borderRadius: 9 }}
                      className="absolute inset-0 bg-white/[0.12]"
                    />
                  ) : null}
                  <span className="relative">{t.label}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <Segmented
            label="Feed view"
            size="md"
            value={activeTab}
            options={tabs.map((t) => ({ value: t.id, label: t.label }))}
            onChange={switchTab}
          />
        )}
      </div>

      {activeTab === "discover" ? (
        <div className="space-y-16 max-sm:space-y-12">
          <SealedShelf />
          <FeedGrid {...TOP_VOTED} />
          <FeedGrid {...RECENTLY_SYNCED} />
          {mostWantedSection}
        </div>
      ) : activeTab === "wanted" ? (
        <div className="space-y-10">
          {mostWantedSection}
          {songsData.status === "success" ? (
            <LeaderboardSection
              title="Needs Fixing"
              subtitle="Songs with synced lyrics that received community sync or text reports"
            >
              {songsData.data.needsFixing.length === 0 ? (
                <EmptyState title="Nothing flagged" hint="Songs with enough reports to review will appear here." />
              ) : (
                <ul className="space-y-2">
                  {songsData.data.needsFixing.map((entry) => (
                    <SongRow key={entry.videoId} entry={entry} />
                  ))}
                </ul>
              )}
            </LeaderboardSection>
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div
            className={cn(
              "space-y-4 rounded-2xl p-4",
              isNew ? glassClass : "border border-unison-border bg-unison-bg-elevated",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  label="Sort by"
                  value={filters.sort}
                  options={[
                    { value: "newest", label: "Newest" },
                    { value: "top-rated", label: "Top Rated" },
                    { value: "most-voted", label: "Most Voted" },
                  ]}
                  onChange={(sort) => setFilters((f) => ({ ...f, sort }))}
                />
                <Segmented
                  label="Sync type"
                  value={filters.syncType}
                  options={[
                    { value: "all", label: "All Sync" },
                    { value: "richsync", label: "Word / Syllable" },
                    { value: "linesync", label: "Line" },
                    { value: "plain", label: "Plain" },
                  ]}
                  onChange={(syncType) => setFilters((f) => ({ ...f, syncType: syncType as FeedSyncType }))}
                />
                <Segmented
                  label="Confidence tier"
                  value={filters.tier}
                  options={[
                    { value: "all", label: "All Tiers" },
                    { value: "trusted-plus", label: "Trusted+" },
                    { value: "top-rated", label: "Top Rated" },
                  ]}
                  onChange={(tier) => setFilters((f) => ({ ...f, tier: tier as FeedTier }))}
                />
                <Segmented
                  label="Format"
                  value={filters.format}
                  options={[
                    { value: "all", label: "All Formats" },
                    { value: "ttml", label: "TTML" },
                    { value: "lrc", label: "LRC" },
                    { value: "plain", label: "Plain" },
                  ]}
                  onChange={(format) => setFilters((f) => ({ ...f, format: format as FeedFormat }))}
                />
                <select
                  value={filters.language}
                  onChange={(e) => setFilters((f) => ({ ...f, language: e.target.value }))}
                  aria-label="Filter by language"
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs text-unison-text focus:outline-none",
                    isNew
                      ? "border border-white/10 bg-white/[0.04]"
                      : "border border-unison-border bg-unison-bg",
                  )}
                >
                  <option value="all">All Languages</option>
                  <option value="en">English</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                  <option value="zh">Chinese</option>
                  <option value="es">Spanish</option>
                  <option value="id">Indonesian</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="pt">Portuguese</option>
                  <option value="ru">Russian</option>
                  <option value="vi">Vietnamese</option>
                  <option value="th">Thai</option>
                </select>
              </div>

              {/* Catalog / ISRC Lookup */}
              <form onSubmit={handleProviderLookup} className="flex items-center gap-1.5 text-xs">
                <select
                  value={lookupType}
                  onChange={(e) => setLookupType(e.target.value as typeof lookupType)}
                  aria-label="Lookup provider"
                  className={cn(
                    "rounded-lg px-2 py-1 text-xs text-unison-text focus:outline-none",
                    isNew
                      ? "border border-white/10 bg-white/[0.04]"
                      : "border border-unison-border bg-unison-bg",
                  )}
                >
                  <option value="isrc">ISRC</option>
                  <option value="spotify">Spotify ID</option>
                  <option value="apple_music">Apple Music ID</option>
                  <option value="tidal">Tidal ID</option>
                </select>
                <input
                  type="text"
                  value={lookupInput}
                  onChange={(e) => setLookupInput(e.target.value)}
                  placeholder={`Lookup ${lookupType.replace("_", " ")}…`}
                  className={cn(
                    "w-36 rounded-lg px-2.5 py-1 font-mono text-xs text-unison-text placeholder:text-unison-text-muted focus:outline-none",
                    isNew
                      ? "border border-white/10 bg-white/[0.04]"
                      : "border border-unison-border bg-unison-bg",
                  )}
                />
                <button
                  type="submit"
                  disabled={lookupLoading || !lookupInput.trim()}
                  className={cn(
                    isNew
                      ? chipClass
                      : "inline-flex cursor-pointer items-center gap-1 rounded-lg border border-unison-border bg-white/[0.08] px-2.5 py-1 text-xs font-medium text-unison-text hover:bg-white/[0.14]",
                    "disabled:opacity-40",
                  )}
                >
                  {lookupLoading ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconSearch className="size-3.5" />}
                  <span>Find</span>
                </button>
              </form>
            </div>
            {lookupError ? <p className="text-xs text-red-400">{lookupError}</p> : null}
          </div>

          {/* Entries */}
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <IconLoader2 className="size-7 animate-spin text-unison-text-muted" />
            </div>
          ) : error ? (
            <EmptyState title="Unable to load feed" hint={error} />
          ) : entries.length === 0 ? (
            <EmptyState
              title="No lyrics found"
              hint={
                activeTab === "mine"
                  ? "You haven't submitted any lyrics yet."
                  : "Try adjusting your filters."
              }
            />
          ) : isNew ? (
            <ul className={cn(COVER_GRID, "t-reveal")}>
              {entries.map((entry) => (
                <SongCoverTile key={entry.id} song={entry} />
              ))}
            </ul>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((entry) => (
                <FeedEntryCard
                  key={entry.id}
                  entry={entry}
                  signedIn={signedIn}
                  isNew={isNew}
                  onVote={handleVote}
                />
              ))}
            </div>
          )}

          {nextCursor !== undefined && !loading ? (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={() => loadFeed(false, nextCursor)}
                disabled={loadingMore}
                className={
                  isNew
                    ? chipClass
                    : "flex cursor-pointer items-center gap-2 rounded-lg border border-unison-border bg-unison-bg-elevated px-5 py-2 text-xs font-medium text-unison-text hover:bg-unison-bg-hover disabled:opacity-50"
                }
              >
                {loadingMore ? <IconLoader2 className="size-3.5 animate-spin" /> : null}
                <span>Load More</span>
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
