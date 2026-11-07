import { CoverImage } from "@/components/AlbumArt"
import { useSongArtPreview } from "@/components/PageArt"
import { Bone, skeletonKeys } from "@/components/skeleton"
import { Tooltip } from "@/components/Tooltip"
import { formatCompact, formatExact, formatRank } from "@/lib/format"
import type { SongLeaderboardEntry } from "@/lib/types"
import { youTubeMusicUrl } from "@/lib/youtube-music"
import { IconPlus } from "@tabler/icons-react"
import { Link } from "react-router-dom"

interface SongRowProps {
  entry: SongLeaderboardEntry
}

export function SongRow({ entry }: SongRowProps) {
  const metric = entry.section === "most_wanted" ? entry.demand : entry.requestCount
  const metricLabel = entry.section === "most_wanted" ? "demand" : "reports"
  const preview = useSongArtPreview(entry)
  const submitUrl = `/submit?videoId=${encodeURIComponent(entry.videoId)}&song=${encodeURIComponent(entry.song)}&artist=${encodeURIComponent(entry.artist)}`

  return (
    <li className="group flex items-center gap-2 rounded-lg bg-white/[0.02] px-4 py-3 transition-colors hover:bg-unison-bg-hover">
      <a
        href={youTubeMusicUrl(entry.videoId)}
        target="_blank"
        rel="noopener noreferrer"
        {...preview}
        aria-label={`Open ${entry.song} by ${entry.artist} in YouTube Music`}
        className="flex min-w-0 flex-1 items-center gap-4"
      >
        <span className="shrink-0 font-mono text-xs tabular-nums text-unison-text-muted">{formatRank(entry.rank)}</span>
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-unison-bg-hover">
          <CoverImage src={entry.thumbnailUrl} song={entry.song} artist={entry.artist} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-unison-text">{entry.song}</p>
          <p className="truncate text-xs text-unison-text-secondary">{entry.artist}</p>
        </div>
        <div className="text-right">
          <p title={formatExact(metric)} className="font-mono text-sm text-unison-text">
            {formatCompact(metric)}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-unison-text-muted">{metricLabel}</p>
        </div>
      </a>
      <Tooltip label="Submit synced lyrics for this song">
        <Link
          to={submitUrl}
          aria-label={`Submit lyrics for ${entry.song}`}
          className="ml-2 hidden shrink-0 items-center gap-1 rounded-md border border-unison-border bg-unison-bg-elevated px-2.5 py-1.5 text-xs font-medium text-unison-text-secondary transition-colors hover:border-unison-border-strong hover:bg-unison-bg-hover hover:text-unison-text sm:inline-flex"
        >
          <IconPlus className="size-3.5" />
          <span>Sync</span>
        </Link>
      </Tooltip>
    </li>
  )
}

function SongRowSkeleton() {
  return (
    <li>
      <div className="flex items-center gap-4 rounded-lg bg-white/[0.02] px-4 py-3">
        <Bone className="h-4 w-4 shrink-0" />
        <Bone className="size-12 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <Bone className="h-3.5 w-2/5" />
          <Bone className="h-3 w-1/4" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Bone className="h-3.5 w-10" />
          <Bone className="h-2.5 w-12" />
        </div>
      </div>
    </li>
  )
}

export function SongRowSkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="space-y-2">
      {skeletonKeys("song-skeleton", rows).map((key) => (
        <SongRowSkeleton key={key} />
      ))}
    </ul>
  )
}
