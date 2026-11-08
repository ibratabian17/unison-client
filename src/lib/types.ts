import type {
  DiffPart,
  DiffRow,
  FieldCheck,
  PreviewResult,
  RevisionDetail,
  RevisionDiff,
  RevisionStatus,
  RevisionSummary,
} from "./revision-types"
import type { PendingReason } from "./council-types"
import type { ReportReason } from "./report-reasons"

export type Confidence = "low" | "medium" | "high"
export type LyricsFormat = "ttml" | "lrc" | "plain"
export type SyncType = "richsync" | "linesync" | "plain"
export type TierName = "legendary" | "grandmaster" | "master" | "elite" | "lyricist"
export type BadgeRarity = "common" | "uncommon" | "rare" | "epic" | "legendary"
export type BadgeCategory = "submissions" | "voting" | "community" | "special"

export interface BadgeImage {
  earned: string
  silhouette: string
  mono?: string
}

export interface BadgeTier {
  tier: number
  threshold: number
  name: string
  description: string
  rarity: BadgeRarity
  image: BadgeImage
}

export interface BadgeDef {
  key: string
  name: string
  description: string
  category: BadgeCategory
  rarity?: BadgeRarity
  secret?: boolean
  attainable?: boolean
  image: BadgeImage
  tiers?: BadgeTier[]
}

export interface BadgeCatalogue {
  badges: BadgeDef[]
}

export interface LeaderboardBadge {
  key: string
  name: string
  tier?: number
}

export interface CuratorLeaderboardEntry {
  keyId: string
  displayName: string
  reputation: number
  score: number
  submissionCount: number
  totalUpvotes: number
  rank: number
  discordLinked: boolean
  tier?: TierName | null
  level?: number
  levelProgress?: number | null
  badgeCount?: number
  topBadge?: LeaderboardBadge | null
  featured?: LeaderboardBadge[]
  avatarUrl?: string | null
  discordUsername?: string | null
  discordId?: string | null
}

export interface CuratorsLeaderboardResponse {
  entries: CuratorLeaderboardEntry[]
  totalCurators: number
  updatedAt?: number
}

export interface SongLeaderboardEntry {
  videoId: string
  song: string
  artist: string
  album?: string | null
  demand: number
  requestCount: number
  rank: number
  thumbnailUrl?: string | null
}

export interface SongsLeaderboardResponse {
  entries: SongLeaderboardEntry[]
  totalSongs: number
  updatedAt?: number
}

export interface UserStats {
  keyId: string
  displayName: string
  reputation: number
  score: number
  submissionCount: number
  totalUpvotes: number
  totalDownvotes?: number
  voteCount: number
  avgVote?: number
  createdAt: number
  discordLinked: boolean
  discordUsername?: string | null
  discordId?: string | null
  avatarUrl?: string | null
}

export interface UserRankResponse {
  ranked: boolean
  rank: number | null
  totalCurators: number
  percentile?: number | null
  score: number
  reputation: number
  submissionCount: number
  totalUpvotes: number
  tier: TierName | null
  tierRank: number | null
  handle: string
  displayName: string
  discordLinked?: boolean
  discordUsername?: string | null
  discordId?: string | null
  avatarUrl?: string | null
  showDiscord?: boolean
}

export interface UserBadge {
  key: string
  name: string
  description: string
  category: BadgeCategory
  rarity: BadgeRarity
  earned: boolean
  earnedAt?: number
  tier?: number
  maxTier?: number
  featured: boolean
  progress?: {
    current: number
    next: number
  }
  image: BadgeImage
}

export interface ExpertiseEntry {
  scope: "artist" | "language"
  name: string
  rank: number
}

export interface UserGamification {
  keyId: string
  level: number
  xp: number
  xpFloor?: number
  xpForNext: number | null
  levelProgress?: number | null
  tier: TierName | null
  tierRank: number | null
  badges: UserBadge[]
  featured: string[]
  counts: {
    earned: number
    total: number
  }
  topExpertise?: ExpertiseEntry[]
}

export interface UserSubmission {
  id: number
  videoId: string
  song: string
  artist: string
  album?: string | null
  format: LyricsFormat
  syncType: SyncType
  language?: string | null
  score: number
  effectiveScore: number
  voteCount: number
  confidence: Confidence
  createdAt: number
  marks?: Mark[]
}

export type SubmissionSort = "newest" | "oldest" | "most_votes" | "least_votes"
export type SubmissionSyncType = "richsync" | "linesync" | "plain"

export interface UserSubmissionsResponse {
  submissions: UserSubmission[]
  total: number
  nextCursor?: string
}

export interface AvatarPreset {
  id: string
  label: string
  url: string
}

export interface AvatarSongCover {
  videoId: string
  song: string
  artist: string
  url: string
}

export type AvatarChoice =
  | { type: "none" }
  | { type: "discord" }
  | { type: "preset"; ref: string }
  | { type: "song"; ref: string }

export interface AvatarCatalogue {
  current: AvatarChoice
  avatarUrl: string | null
  discordAvailable: boolean
  discordAvatarUrl: string | null
  presets: AvatarPreset[]
  songs: AvatarSongCover[]
}

export interface ProfileSettings {
  showDiscord: boolean
}

export interface MarkActor {
  keyId: string
  displayName: string
  tier?: TierName | null
  level?: number
  levelProgress?: number | null
  badgeCount?: number
  topBadge?: LeaderboardBadge | null
  featured?: LeaderboardBadge[]
  avatarUrl?: string | null
  reputation?: number
}

export interface Mark {
  type: "seal"
  label: string
  icon: string
  by?: MarkActor
  at?: number
}

export interface VariantSubmitter {
  keyId: string
  displayName: string
  reputation: number
  tier: TierName | null
  level: number
  levelProgress?: number | null
  badgeCount: number
  topBadge: LeaderboardBadge | null
  featured: LeaderboardBadge[]
  avatarUrl?: string | null
}

export interface VariantSummary {
  id: number
  videoId: string
  song: string
  artist: string
  album?: string
  isrc?: string
  duration?: number
  format: LyricsFormat
  syncType: SyncType
  language?: string
  score: number
  effectiveScore: number
  voteCount: number
  confidence: Confidence
  hidden: boolean
  createdAt?: number
  submitter?: VariantSubmitter
  userVote?: 1 | -1 | null
  marks?: Mark[]
}

export interface RevisionBar {
  revNo: number
  count: number
  pending: {
    revNo: number
    pendingReason: PendingReason
    textDrift: number
    timingDrift: number
  } | null
  lastRejected: {
    revNo: number
    reviewNote: string | null
  } | null
  updatedAt: number
}

export interface VariantFull extends VariantSummary {
  lyrics: string
  fulfilled?: {
    demand: number
    requestCount: number
    fulfilledAt: number
  }
  revision?: RevisionBar
}

export interface LyricsSearchHit extends VariantSummary {
  matchScore?: number
  tier?: number
}

export interface QueueEntry {
  videoId: string
  song: string
  artist: string
  album?: string | null
  demand: number
  requestCount: number
  rank: number
}

export type SealedSort = "newest" | "top-rated"
export type SealedSyncFilter = "richsync" | "linesync" | "plain"

export interface FeedEntry {
  id: number
  videoId: string
  song: string
  artist: string
  album?: string | null
  format: LyricsFormat
  syncType: SyncType
  language?: string | null
  score: number
  effectiveScore: number
  voteCount: number
  confidence: Confidence
  createdAt: number
  submitter?: VariantSubmitter
  marks?: Mark[]
  userVote?: 1 | -1 | null
}

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export interface DumpManifest {
  generatedAt: string
  sha256: string
  sizeBytes: number
  counts: {
    lyrics: number
    requestedSongs: number
    lyricsRequests: number
  }
}

export type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; hint?: string }

export type { ReportReason }

export type FeedSort = "default" | "newest" | "top-rated" | "most-voted"
export type FeedSortDir = "desc" | "asc"
export type FeedSyncType = "all" | "richsync" | "linesync" | "plain"
export type FeedTier = "all" | "trusted-plus" | "top-rated"
export type FeedFormat = "all" | "lrc" | "ttml" | "plain"

export interface FeedFilters {
  sort: FeedSort
  sortDir: FeedSortDir
  syncType: FeedSyncType
  tier: FeedTier
  format: FeedFormat
  language: string
}

export interface UnisonFulfillment {
  demand: number
  requestCount: number
  fulfilledAt: number
}

export interface UnisonFeedEntry {
  id: number
  videoId: string
  song: string
  artist: string
  album?: string
  isrc?: string
  duration: number
  format: LyricsFormat
  language?: string
  syncType: SyncType
  score: number
  effectiveScore: number
  voteCount: number
  confidence: Confidence
  createdAt: number
  marks?: Mark[]
  submitter?: MarkActor
  fulfilled?: UnisonFulfillment
  userVote?: 1 | -1 | null
}

export interface UnisonSubmission {
  videoId: string
  song: string
  artist: string
  duration: number
  lyrics: string
  format: LyricsFormat | "auto"
  album?: string
  isrc?: string
  language?: string
}

export interface LyricRevision {
  id: number
  lyricId?: number
  version?: number
  revNo?: number
  lyrics?: string
  format?: LyricsFormat
  language?: string | null
  album?: string | null
  isrc?: string | null
  status: RevisionStatus | string
  pendingReason?: PendingReason | null
  isAnchor?: boolean
  textDrift?: number
  timingDrift?: number
  revertsRevNo?: number | null
  reviewNote?: string | null
  createdAt: number
  reviewedAt?: number | null
  author?: {
    keyId?: string
    displayName: string
    avatarUrl?: string | null
  } | null
}

export interface LinkedVideo {
  videoId: string
  primary?: boolean
  isPrimary?: boolean
  createdAt?: number
}

export type SuggestedVideoMatchLevel = "same" | "related" | "different"

export interface VideoSuggestion {
  videoId: string
  title: string
  artist?: string
  album?: string
  author?: string
  videoType?: "song" | "video"
  duration?: number
  durationSeconds?: number
  matchScore?: number
  match?: { level: SuggestedVideoMatchLevel; score: number } | null
  thumbnailUrl?: string
  artworkUrl?: string | null
}

export type {
  RevisionDiff,
  RevisionSummary,
  RevisionDetail,
  RevisionStatus,
  FieldCheck,
  PreviewResult,
  DiffRow,
  DiffPart,
}
