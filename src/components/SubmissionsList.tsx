import { uniqueById } from "@/lib/unique-by-id"
import { IconChevronDown, IconPlus } from "@tabler/icons-react"
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query"
import { CollapsibleSection } from "@/components/CollapsibleSection"
import { EmptyState } from "@/components/EmptyState"
import { SectionHeading } from "@/components/profile/SectionHeading"
import { Bone, skeletonKeys } from "@/components/skeleton"
import { COVER_GRID, SongCoverTile, SongCoverTileSkeletons } from "@/components/SongCoverTile"
import { SongThumbnail } from "@/components/SongThumbnail"
import { SwapLabel } from "@/components/SwapLabel"
import { glassClass } from "@/components/ui"
import { useUiMode } from "@/context/UiModeContext"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { fetchUserSubmissions } from "@/lib/api"
import { cn } from "@/lib/cn"
import { COMPOSER_URL } from "@/lib/composer"
import { formatCompact, formatExact, formatRelativeTime } from "@/lib/format"
import { LAYOUT_TRANSITION } from "@/lib/motion-variants"
import type { SubmissionSort, SubmissionSyncType } from "@/lib/types"
import { motion } from "motion/react"
import { type ReactNode, useMemo, useState } from "react"
import { Link } from "react-router-dom"

interface SubmissionsListProps {
  keyId: string
  total?: number
  owner?: boolean
}

type SyncFilter = "all" | SubmissionSyncType

interface ToolbarState {
  search: string
  syncType: SyncFilter
  sort: SubmissionSort
}

const DEFAULT_TOOLBAR: ToolbarState = { search: "", syncType: "all", sort: "newest" }
const SEARCH_DEBOUNCE_MS = 300
const SEARCH_MAX_LENGTH = 100

const TITLE = "Songs synced"
const FIELD = cn(glassClass, "h-10 rounded-xl text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-white/30")

export function SubmissionsList(props: SubmissionsListProps) {
  return <CuratorSubmissions key={props.keyId} {...props} />
}

function Section({ meta, children }: { meta?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading title={TITLE} meta={meta} />
      {children}
    </section>
  )
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <span className="relative inline-flex [text-shadow:none]">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={cn(FIELD, "cursor-pointer appearance-none pr-9 pl-3.5 text-(--ink-2)")}
      >
        {children}
      </select>
      <IconChevronDown
        aria-hidden
        stroke={1.75}
        className="pointer-events-none absolute top-1/2 right-3 size-[15px] -translate-y-1/2 text-(--ink-3)"
      />
    </span>
  )
}

export function SubmissionsSkeleton() {
  return (
    <Section meta={<Bone className="h-3 w-12" />}>
      <div className="flex flex-wrap gap-2">
        <Bone className="h-10 min-w-[200px] flex-1 rounded-xl" />
        <Bone className="h-10 w-[124px] rounded-xl" />
        <Bone className="h-10 w-[113px] rounded-xl" />
      </div>
      <SongCoverTileSkeletons id="submission-skeleton" count={8} />
    </Section>
  )
}

function CuratorSubmissions({ keyId, total, owner = false }: SubmissionsListProps) {
  const { uiMode } = useUiMode()
  const isClassic = uiMode === "classic"
  const [toolbar, setToolbar] = useState<ToolbarState>(DEFAULT_TOOLBAR)

  const typedSearch = toolbar.search.trim()
  const debouncedSearch = useDebouncedValue(typedSearch, typedSearch.length === 0 ? 0 : SEARCH_DEBOUNCE_MS)
  const search = typedSearch.length === 0 ? "" : debouncedSearch
  const syncType = toolbar.syncType === "all" ? undefined : toolbar.syncType
  const { sort } = toolbar
  const filtered = search.length > 0 || syncType !== undefined
  const toolbarChanged = filtered || sort !== DEFAULT_TOOLBAR.sort

  const {
    data,
    status,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    isPlaceholderData,
  } = useInfiniteQuery({
    queryKey: ["user", keyId, "submissions", { search, syncType, sort }],
    queryFn: ({ pageParam }) => fetchUserSubmissions(keyId, { search, syncType, sort, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const visible = useMemo(() => {
    return uniqueById(data?.pages.flatMap((page) => page.submissions) ?? [])
  }, [data])

  const listError = status === "error" && !isFetchNextPageError ? error.message : null
  const loadMoreError = isFetchNextPageError ? (error?.message ?? "Could not load more") : null

  if (isClassic) {
    if (status === "pending") {
      return (
        <CollapsibleSection title="Submissions">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Bone className="h-9 min-w-0 flex-1" />
              <Bone className="h-9 w-32" />
              <Bone className="h-9 w-32" />
            </div>
            <ul className="border-b border-unison-border">
              {skeletonKeys("submission-skeleton", 4).map((key) => (
                <li key={key} className="flex items-center gap-3 border-t border-unison-border px-2 py-3.5">
                  <Bone className="size-11 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Bone className="h-3.5 w-1/2" />
                    <Bone className="h-3 w-2/3" />
                  </div>
                  <Bone className="h-3 w-14 shrink-0" />
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleSection>
      )
    }

    if (listError !== null && !toolbarChanged) {
      return <EmptyState title="Could not load submissions" hint={listError} />
    }

    if (visible.length === 0 && !filtered && !isPlaceholderData && listError === null) {
      return <EmptyState title="No submissions yet" />
    }

    const inputClass =
      "rounded-md border border-unison-border bg-unison-bg-elevated px-3 py-1.5 text-sm text-unison-text transition-colors hover:bg-unison-bg-hover focus:border-unison-border-strong focus:outline-none"

    return (
      <CollapsibleSection title="Submissions">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={toolbar.search}
              onChange={(e) => setToolbar((t) => ({ ...t, search: e.target.value }))}
              maxLength={SEARCH_MAX_LENGTH}
              placeholder="Search song or artist"
              aria-label="Search submissions"
              className={`${inputClass} min-w-0 flex-1 placeholder:text-unison-text-muted`}
            />
            <select
              value={toolbar.syncType}
              onChange={(e) => setToolbar((t) => ({ ...t, syncType: e.target.value as SyncFilter }))}
              aria-label="Filter by sync type"
              className={`${inputClass} cursor-pointer`}
            >
              <option value="all">All sync types</option>
              <option value="richsync">Richsync</option>
              <option value="linesync">Linesync</option>
              <option value="plain">Plain</option>
            </select>
            <select
              value={toolbar.sort}
              onChange={(e) => setToolbar((t) => ({ ...t, sort: e.target.value as SubmissionSort }))}
              aria-label="Sort submissions"
              className={`${inputClass} cursor-pointer`}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="most_votes">Most votes</option>
              <option value="least_votes">Least votes</option>
            </select>
          </div>
          {listError !== null ? (
            <p role="alert" className="text-xs text-unison-text-muted">
              Could not load submissions. {listError}
            </p>
          ) : visible.length === 0 ? (
            <p className="text-xs text-unison-text-muted">No submissions match these filters.</p>
          ) : (
            <ul className="border-b border-unison-border">
              {visible.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/song/${s.videoId}`}
                    className="flex items-center gap-3 border-t border-unison-border px-2 py-3.5 transition-colors hover:bg-unison-bg-hover"
                  >
                    <SongThumbnail videoId={s.videoId} song={s.song} artist={s.artist} className="size-11" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-unison-text">
                        <span className="truncate">{s.song}</span>
                        {s.hidden ? (
                          <span className="shrink-0 rounded bg-unison-bg-hover px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-unison-text-secondary">
                            hidden
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-unison-text-muted">
                        {s.artist} · {s.syncType} · {formatRelativeTime(s.createdAt)}
                      </p>
                    </div>
                    <p
                      title={`${formatExact(s.voteCount)} votes`}
                      className="shrink-0 font-mono text-xs text-unison-text-muted"
                    >
                      {formatCompact(s.voteCount)} votes
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {hasNextPage && !isPlaceholderData ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
                className="cursor-pointer rounded-md border border-unison-border bg-unison-bg-elevated px-3 py-1.5 text-xs text-unison-text-secondary transition-colors hover:bg-unison-bg-hover hover:text-unison-text disabled:opacity-50"
              >
                {isFetchingNextPage ? "Loading..." : loadMoreError ? "Retry" : "Load more"}
              </button>
              {loadMoreError ? (
                <p role="alert" className="text-xs text-unison-text-muted">
                  {loadMoreError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </CollapsibleSection>
    )
  }

  if (status === "pending") return <SubmissionsSkeleton />
  if (listError !== null && !toolbarChanged) {
    return (
      <Section>
        <EmptyState title="Could not load submissions" hint={listError} />
      </Section>
    )
  }

  if (visible.length === 0 && !filtered && !isPlaceholderData && listError === null) {
    return (
      <Section>
        <EmptyState title="No songs synced yet" hint="Synced songs show up here, with their covers.">
          {owner ? (
            <a
              href={COMPOSER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-unison-text pr-[18px] pl-4 text-sm font-bold text-[#121116] transition-[background-color,scale] duration-150 ease-out active:scale-[0.96] hover:bg-white"
            >
              <IconPlus className="size-[17px]" stroke={2} />
              Sync a song
            </a>
          ) : null}
        </EmptyState>
      </Section>
    )
  }

  return (
    <Section meta={total ? `${formatExact(total)} total` : undefined}>
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={toolbar.search}
          onChange={(e) => setToolbar((t) => ({ ...t, search: e.target.value }))}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="Search song or artist"
          aria-label="Search submissions"
          className={cn(FIELD, "min-w-[200px] flex-1 px-3.5 text-sm text-unison-text placeholder:text-(--ink-3)")}
        />
        <SelectField
          label="Filter by sync type"
          value={toolbar.syncType}
          onChange={(value) => setToolbar((t) => ({ ...t, syncType: value as SyncFilter }))}
        >
          <option value="all">All sync types</option>
          <option value="richsync">Richsync</option>
          <option value="linesync">Linesync</option>
          <option value="plain">Plain</option>
        </SelectField>
        <SelectField
          label="Sort submissions"
          value={toolbar.sort}
          onChange={(value) => setToolbar((t) => ({ ...t, sort: value as SubmissionSort }))}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="most_votes">Most votes</option>
          <option value="least_votes">Least votes</option>
        </SelectField>
      </div>
      {listError !== null ? (
        <p role="alert" className="text-[13px] text-(--ink-3)">
          Could not load submissions. {listError}
        </p>
      ) : visible.length === 0 ? (
        <p className="text-[13px] text-(--ink-3)">No submissions match these filters.</p>
      ) : (
        <ul className={cn(COVER_GRID, "t-reveal", isPlaceholderData && "opacity-60")}>
          {visible.map((s) => (
            <SongCoverTile key={s.id} song={s} />
          ))}
        </ul>
      )}
      {hasNextPage && !isPlaceholderData ? (
        <div className="flex flex-col items-start gap-2">
          <motion.button
            layout
            transition={{ layout: LAYOUT_TRANSITION }}
            style={{ borderRadius: 9999 }}
            type="button"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className={cn(
              glassClass,
              "h-10 cursor-pointer rounded-full px-4 text-[13px] font-medium transition-[background-color,scale] duration-150 ease-out active:not-disabled:scale-[0.96] disabled:opacity-50 [text-shadow:none] hover:bg-white/[0.14]",
            )}
          >
            <SwapLabel text={isFetchingNextPage ? "Loading…" : loadMoreError ? "Retry" : "Load more"} />
          </motion.button>
          {loadMoreError ? (
            <p role="alert" className="text-xs text-(--ink-3)">
              {loadMoreError}
            </p>
          ) : null}
        </div>
      ) : null}
    </Section>
  )
}
