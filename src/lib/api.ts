import { resolveApiPath } from "./api-url"
import { hasSigningKeyFor, signPayload } from "./browser-identity"
import { normalizeLanguage, toLyricsTranslateLang } from "./languages"
import { normalizeIsrc } from "./lyrics-parser"
import type {
  FeedFilters,
  FeedResponse,
  LinkedVideo,
  LyricRevision,
  LyricsFormat,
  VideoSuggestion,
} from "./types"
import { loadStoredSession } from "./auth"
import { AUTHED_FETCH_ERRORS, authedFetch } from "./authedFetch"
import type { ReportReason } from "./report-reasons"
import type {
  PreviewResult,
  RevisionDetail,
  RevisionDiff,
  RevisionInput,
  RevisionSummary,
  SuggestionInboxItem,
} from "./revision-types"
import { IS_SPA_EXPANSION_SEED } from "./seed-flag"
import type {
  ApiEnvelope,
  AvatarCatalogue,
  AvatarChoice,
  BadgeCatalogue,
  CuratorsLeaderboardResponse,
  DumpManifest,
  FeedEntry,
  LyricsSearchHit,
  NotificationList,
  NotificationSettings,
  Page,
  ProfileSettings,
  QueueEntry,
  SealedSort,
  SealedSyncFilter,
  SongsLeaderboardResponse,
  SubmissionSort,
  SubmissionSyncType,
  SuggestionDecider,
  UserGamification,
  UserRankResponse,
  UserSubmissionsResponse,
  VariantFull,
  VariantSummary,
} from "./types"

export function isNotFound(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("HTTP 404 ")
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(resolveApiPath(path))
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`)
  const envelope = (await res.json()) as ApiEnvelope<T>
  if (!envelope.success) throw new Error(envelope.error)
  return envelope.data
}

export async function fetchSongLeaderboard(): Promise<SongsLeaderboardResponse> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed-spa-expansion")).seedSongs()
  return getJson<SongsLeaderboardResponse>("/leaderboard/songs")
}

export async function fetchCuratorLeaderboard(): Promise<CuratorsLeaderboardResponse> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed")).seedCurators()
  return getJson<CuratorsLeaderboardResponse>("/leaderboard/users")
}

export async function fetchUserRank(keyId: string): Promise<UserRankResponse> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed")).seedUserRank(keyId)
  return getJson<UserRankResponse>(`/leaderboard/users/${encodeURIComponent(keyId)}`)
}

export async function fetchUserByHandle(handle: string): Promise<{ keyId: string }> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed")).seedUserByHandle(handle)
  return getJson<{ keyId: string }>(`/users/by-handle/${encodeURIComponent(handle)}`)
}

export interface UserSubmissionsQuery {
  search?: string
  syncType?: SubmissionSyncType
  sort?: SubmissionSort
  cursor?: string
}

export async function fetchUserSubmissions(
  keyId: string,
  query: UserSubmissionsQuery = {},
): Promise<UserSubmissionsResponse> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed")).seedUserSubmissions(keyId)
  const params = new URLSearchParams()
  const search = query.search?.trim()
  if (search) params.set("q", search)
  if (query.syncType) params.set("syncType", query.syncType)
  if (query.sort && query.sort !== "newest") params.set("sort", query.sort)
  if (query.cursor !== undefined) params.set("cursor", query.cursor)
  const qs = params.toString()
  return getJson<UserSubmissionsResponse>(`/users/${encodeURIComponent(keyId)}/submissions${qs ? `?${qs}` : ""}`)
}

export async function fetchBadgeCatalogue(): Promise<BadgeCatalogue> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed")).seedBadgeCatalogue()
  return getJson<BadgeCatalogue>("/badges")
}

export async function fetchAvatarCatalogue(): Promise<AvatarCatalogue> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed")).seedAvatarCatalogue()
  return getJson<AvatarCatalogue>("/avatars")
}

export async function putAvatar(choice: AvatarChoice): Promise<{ avatarUrl: string | null }> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed")).seedSetAvatar(choice)
  return authedFetch<{ avatarUrl: string | null }>("/avatars/me", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(choice),
  })
}

export async function putProfileSettings(change: Partial<ProfileSettings>): Promise<ProfileSettings> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed")).seedSetProfileSettings(change)
  return authedFetch<ProfileSettings>("/users/me/profile", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(change),
  })
}

export async function fetchUserBadges(keyId: string): Promise<UserGamification> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed")).seedUserBadges(keyId)
  return getJson<UserGamification>(`/users/${encodeURIComponent(keyId)}/badges`)
}

export async function putFeaturedBadges(keyId: string, featured: string[]): Promise<UserGamification> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed")).seedSetFeatured(keyId, featured)
  return authedFetch<UserGamification>("/users/me/featured-badges", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ featured }),
  })
}

interface SearchLyricsParams {
  q?: string
  song?: string
  artist?: string
  signal?: AbortSignal
}

function buildSearchPath(params: SearchLyricsParams): string {
  const search = new URLSearchParams()
  if (params.q) search.set("q", params.q)
  if (params.song) search.set("song", params.song)
  if (params.artist) search.set("artist", params.artist)
  const qs = search.toString()
  return qs.length > 0 ? `/lyrics/search?${qs}` : "/lyrics/search"
}

export async function getJsonWithSignal<T>(path: string, signal?: AbortSignal): Promise<T> {
  const session = loadStoredSession()
  const init: RequestInit = {}
  if (signal) init.signal = signal
  if (session) init.headers = { authorization: `Bearer ${session.sessionToken}` }
  const res = await fetch(resolveApiPath(path), init)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`)
  const envelope = (await res.json()) as ApiEnvelope<T>
  if (!envelope.success) throw new Error(envelope.error)
  return envelope.data
}

export async function searchLyrics(params: SearchLyricsParams): Promise<{ results: LyricsSearchHit[] }> {
  if (IS_SPA_EXPANSION_SEED) {
    return (await import("./dev-seed-spa-expansion")).seedSearch({
      q: params.q,
      song: params.song,
      artist: params.artist,
    })
  }
  const hits = await getJsonWithSignal<LyricsSearchHit[]>(buildSearchPath(params), params.signal)
  return { results: hits }
}

export async function fetchLyricsVariants(
  videoId: string,
  opts: { signal?: AbortSignal } = {},
): Promise<{ variants: VariantSummary[] }> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed-spa-expansion")).seedLyricsVariants(videoId)
  const variants = await getJsonWithSignal<VariantSummary[]>(
    `/lyrics/variants/${encodeURIComponent(videoId)}`,
    opts.signal,
  )
  return { variants }
}

export async function fetchLyricsVariant(
  id: number,
  opts: { signal?: AbortSignal } = {},
): Promise<{ variant: VariantFull }> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed-spa-expansion")).seedLyricsVariant(id)
  const variant = await getJsonWithSignal<VariantFull>(`/lyrics/${id}`, opts.signal)
  return { variant }
}

export function fetchRevisionDiff(
  lyricsId: number,
  revisionId: number,
  againstOrSignal?: number | AbortSignal,
  signal?: AbortSignal,
): Promise<RevisionDiff> {
  const isSignal = againstOrSignal instanceof AbortSignal
  const against = isSignal ? undefined : againstOrSignal
  const sig = isSignal ? againstOrSignal : signal
  const query = against !== undefined ? `?against=${encodeURIComponent(String(against))}` : ""
  return getJsonWithSignal<RevisionDiff>(`/lyrics/${lyricsId}/revisions/${revisionId}/diff${query}`, sig)
}

export function fetchRevisionDetail(
  lyricsId: number,
  revisionId: number,
  signal?: AbortSignal,
): Promise<RevisionDetail> {
  return getJsonWithSignal(`/lyrics/${lyricsId}/revisions/${revisionId}`, signal)
}

export async function fetchRevisions(lyricsId: number, signal?: AbortSignal): Promise<RevisionSummary[]> {
  const { revisions } = await getJsonWithSignal<{ revisions: RevisionSummary[] }>(
    `/lyrics/${lyricsId}/revisions`,
    signal,
  )
  return revisions
}

const JSON_HEADERS = { "content-type": "application/json" }

export function previewRevision(lyricsId: number, input: RevisionInput): Promise<PreviewResult> {
  return authedFetch<PreviewResult>(`/lyrics/${lyricsId}/revisions/preview`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
}

export function submitRevision(
  lyricsId: number,
  input: RevisionInput & { note?: string },
): Promise<{ revision: RevisionSummary; decider?: SuggestionDecider }> {
  return authedFetch<{ revision: RevisionSummary; decider?: SuggestionDecider }>(`/lyrics/${lyricsId}/revisions`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
}

export function withdrawPendingRevision(lyricsId: number): Promise<{ revision: RevisionSummary }> {
  return authedFetch<{ revision: RevisionSummary }>(`/lyrics/${lyricsId}/revisions/pending`, { method: "DELETE" })
}

export function fetchMySuggestions(signal?: AbortSignal): Promise<SuggestionInboxItem[]> {
  return authedFetch<SuggestionInboxItem[]>("/lyrics/mine/suggestions", { signal })
}

export interface ArtworkCover {
  url: string
  fallbackUrl: string | null
}

export async function fetchArtwork(videoId: string, size?: number): Promise<ArtworkCover | null> {
  if (IS_SPA_EXPANSION_SEED) return null
  const sized = size !== undefined ? `&size=${size}` : ""
  const { artworkUrl, fallbackUrl } = await getJson<{ artworkUrl: string | null; fallbackUrl?: string }>(
    `/artwork?v=${encodeURIComponent(videoId)}${sized}`,
  )
  return artworkUrl ? { url: artworkUrl, fallbackUrl: fallbackUrl ?? null } : null
}

async function unwrapMutationError(res: Response): Promise<never> {
  if (res.status === 401) throw new Error(AUTHED_FETCH_ERRORS.AUTH_REQUIRED)
  if (res.status === 429) throw new Error(AUTHED_FETCH_ERRORS.RATE_LIMITED)
  let body: { error?: unknown } | null = null
  try {
    body = (await res.json()) as { error?: unknown }
  } catch {
    body = null
  }
  const message = typeof body?.error === "string" && body.error.length > 0 ? body.error : null
  throw new Error(message ?? AUTHED_FETCH_ERRORS.REQUEST_FAILED)
}

export async function voteVariant(id: number, value: 1 | -1): Promise<void> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed-spa-expansion")).seedVote(id, value)
  await authedFetch<unknown>(`/lyrics/${id}/vote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ vote: value }),
  })
}

export async function unvoteVariant(id: number): Promise<void> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed-spa-expansion")).seedUnvote(id)
  await authedFetch<unknown>(`/lyrics/${id}/vote`, { method: "DELETE" })
}

export async function reportVariant(id: number, reason: ReportReason, details?: string): Promise<void> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed-spa-expansion")).seedReport(id, reason, details)
  const body = details !== undefined ? { reason, details } : { reason }
  await authedFetch<unknown>(`/lyrics/${id}/report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const QUEUE_PAGE_LIMIT = 50

export async function fetchQueue(opts: { cursor?: string; signal?: AbortSignal } = {}): Promise<Page<QueueEntry>> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed-spa-expansion")).seedQueue({ cursor: opts.cursor })
  const search = new URLSearchParams()
  search.set("cursor", opts.cursor ?? "")
  search.set("limit", String(QUEUE_PAGE_LIMIT))
  return getPage<QueueEntry>(`/leaderboard/songs?${search.toString()}`, opts.signal)
}

export async function fetchSealed(opts: {
  sort: SealedSort
  limit: number
  syncType?: SealedSyncFilter
  cursor?: string
  signal?: AbortSignal
}): Promise<Page<FeedEntry>> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed-spa-expansion")).seedSealed(opts)
  const search = new URLSearchParams({ sealed: "1", sort: opts.sort, limit: String(opts.limit) })
  if (opts.syncType) search.set("syncType", opts.syncType)
  if (opts.cursor) search.set("cursor", opts.cursor)
  return getPage<FeedEntry>(`/feed?${search.toString()}`, opts.signal)
}

export type FeedGridSort = "newest" | "top-rated"

export async function fetchFeedGrid(opts: {
  sort: FeedGridSort
  limit: number
  signal?: AbortSignal
}): Promise<Page<FeedEntry>> {
  const search = new URLSearchParams({ sort: opts.sort, limit: String(opts.limit) })
  return getPage<FeedEntry>(`/feed?${search.toString()}`, opts.signal)
}

async function getPage<T>(path: string, signal?: AbortSignal): Promise<Page<T>> {
  const res = await fetch(resolveApiPath(path), signal ? { signal } : undefined)
  if (!res.ok) await unwrapMutationError(res)
  const body = (await res.json()) as ApiEnvelope<T[]> & { nextCursor?: string | number | null }
  if (!body.success) throw new Error(body.error)
  return { items: body.data, nextCursor: body.nextCursor == null ? null : String(body.nextCursor) }
}

const DUMP_MANIFEST_URL = "https://unison-dumps.boidu.dev/dumps/manifest.json"

export async function fetchDumpManifest(): Promise<DumpManifest> {
  const res = await fetch(DUMP_MANIFEST_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching dump manifest`)
  try {
    return (await res.json()) as DumpManifest
  } catch {
    throw new Error("manifest is malformed")
  }
}

export function fetchUnreadNotifications(signal?: AbortSignal): Promise<{ unread: number }> {
  return authedFetch<{ unread: number }>("/notifications/unread", { signal })
}

export function fetchNotifications(signal?: AbortSignal): Promise<NotificationList> {
  return authedFetch<NotificationList>("/notifications", { signal })
}

export async function markNotificationsSeen(): Promise<void> {
  await authedFetch<unknown>("/notifications/seen", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  })
}

export function fetchNotificationSettings(signal?: AbortSignal): Promise<NotificationSettings> {
  return authedFetch<NotificationSettings>("/notifications/settings", { signal })
}

export async function putNotificationSettings(settings: NotificationSettings): Promise<void> {
  await authedFetch<unknown>("/notifications/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(settings),
  })
}


// =============================================================================
// Composer, Better-Lyrics & Standalone Client Write/Utility API Extensions
// =============================================================================


export async function fetchFeed(
  filters?: Partial<import("./types").FeedFilters>,
  cursor?: number,
): Promise<{ entries: import("./types").UnisonFeedEntry[]; nextCursor?: number }> {
  const params = new URLSearchParams()
  if (cursor !== undefined) params.set("cursor", String(cursor))
  params.set("limit", "20")
  if (filters?.sort && filters.sort !== "newest") params.set("sort", filters.sort)
  if (filters?.sortDir && filters.sortDir !== "desc") params.set("sortDir", filters.sortDir)
  if (filters?.syncType && filters.syncType !== "all") params.set("syncType", filters.syncType)
  if (filters?.tier && filters.tier !== "all") params.set("tier", filters.tier)
  if (filters?.format && filters.format !== "all") params.set("format", filters.format)
  if (filters?.language && filters.language !== "all") params.set("language", filters.language)

  const session = loadStoredSession()
  const headers: Record<string, string> = {}
  if (session) {
    headers["Authorization"] = `Bearer ${session.sessionToken}`
    headers["X-Key-ID"] = session.keyId
  }

  const res = await fetch(resolveApiPath(`/feed?${params.toString()}`), { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return { entries: json.data ?? [], nextCursor: json.nextCursor }
}

export async function fetchMySubmissions(
  filters?: Partial<import("./types").FeedFilters>,
  cursor?: number,
): Promise<{ entries: import("./types").UnisonFeedEntry[]; nextCursor?: number }> {
  const params = new URLSearchParams()
  if (cursor !== undefined) params.set("cursor", String(cursor))
  params.set("limit", "20")
  if (filters?.sort && filters.sort !== "default" && filters.sort !== "newest") params.set("sort", filters.sort)
  if (filters?.sortDir && filters.sortDir !== "desc") params.set("sortDir", filters.sortDir)
  if (filters?.syncType && filters.syncType !== "all") params.set("syncType", filters.syncType)
  if (filters?.tier && filters.tier !== "all") params.set("tier", filters.tier)
  if (filters?.format && filters.format !== "all") params.set("format", filters.format)
  if (filters?.language && filters.language !== "all") params.set("language", filters.language)

  const session = loadStoredSession()
  if (!session) throw new Error("AUTH_REQUIRED")
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.sessionToken}`,
    "X-Key-ID": session.keyId,
  }

  const res = await fetch(resolveApiPath(`/lyrics/mine?${params.toString()}`), { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return { entries: json.data ?? [], nextCursor: json.nextCursor }
}

export async function submitLyrics(
  submission: import("./types").UnisonSubmission,
): Promise<{ id: number; created: boolean }> {
  const session = loadStoredSession()
  const normalizedSubmission: Record<string, unknown> = {
    ...submission,
  }
  if (typeof submission.isrc === "string" && submission.isrc.trim()) {
    normalizedSubmission.isrc = normalizeIsrc(submission.isrc) ?? submission.isrc.trim()
  }
  if (typeof submission.language === "string" && submission.language.trim()) {
    normalizedSubmission.language = normalizeLanguage(submission.language) ?? submission.language.trim()
  }

  if (session?.sessionToken) {
    const bearerRes = await fetch(resolveApiPath("/lyrics/submit"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
        "X-Key-ID": session.keyId,
      },
      body: JSON.stringify(normalizedSubmission),
    })

    if (bearerRes.ok) {
      const json = await bearerRes.json()
      return json.data ?? { id: json.id, created: true }
    }

    const errJson = await bearerRes.json().catch(() => null)
    if (errJson?.code === "INVALID_SIGNED_BODY" && hasSigningKeyFor(session.keyId)) {
      const signed = await signPayload(normalizedSubmission)
      const signedRes = await fetch(resolveApiPath("/lyrics/submit"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.sessionToken}`,
          "X-Key-ID": session.keyId,
        },
        body: JSON.stringify(signed),
      })
      if (!signedRes.ok) {
        const sErr = await signedRes.json().catch(() => null)
        throw new Error(sErr?.hint ?? sErr?.error ?? `HTTP ${signedRes.status}`)
      }
      const sJson = await signedRes.json()
      return sJson.data ?? { id: sJson.id, created: true }
    }

    throw new Error(errJson?.hint ?? errJson?.error ?? `HTTP ${bearerRes.status}`)
  }

  const signed = await signPayload(normalizedSubmission)
  const res = await fetch(resolveApiPath("/lyrics/submit"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signed),
  })
  if (!res.ok) {
    const errJson = await res.json().catch(() => null)
    throw new Error(errJson?.hint ?? errJson?.error ?? `HTTP ${res.status}`)
  }
  const json = await res.json()
  return json.data ?? { id: json.id, created: true }
}

export async function deleteLyrics(id: number): Promise<void> {
  const session = loadStoredSession()

  if (session?.sessionToken) {
    const bearerRes = await fetch(resolveApiPath(`/lyrics/${id}`), {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.sessionToken}`,
        "X-Key-ID": session.keyId,
      },
    })
    if (bearerRes.ok) return

    const errJson = await bearerRes.json().catch(() => null)
    if (errJson?.code === "INVALID_SIGNED_BODY" && hasSigningKeyFor(session.keyId)) {
      const signed = await signPayload()
      const signedRes = await fetch(resolveApiPath(`/lyrics/${id}`), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.sessionToken}`,
          "X-Key-ID": session.keyId,
        },
        body: JSON.stringify(signed),
      })
      if (!signedRes.ok) {
        const sErr = await signedRes.json().catch(() => null)
        throw new Error(sErr?.hint ?? sErr?.error ?? `HTTP ${signedRes.status}`)
      }
      return
    }

    throw new Error(errJson?.hint ?? errJson?.error ?? `HTTP ${bearerRes.status}`)
  }

  const signed = await signPayload()
  const res = await fetch(resolveApiPath(`/lyrics/${id}`), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signed),
  })
  if (!res.ok) {
    const errJson = await res.json().catch(() => null)
    throw new Error(errJson?.hint ?? errJson?.error ?? `HTTP ${res.status}`)
  }
}

export interface TranslateResult {
  lines: Array<{
    translation: string | null
    romanization: string | null
    needsTranslation: boolean
  }>
  detectedLang: string
  provider: string
  cached: boolean
  translated: string[]
  romanized?: string[]
}

export async function translateLyrics(
  lines: string[],
  targetLang: string,
  sourceLang?: string,
  videoId?: string,
): Promise<TranslateResult> {
  if (lines.length === 0) {
    return {
      lines: [],
      detectedLang: sourceLang ?? "",
      provider: "google-lyrics-translate",
      cached: false,
      translated: [],
    }
  }

  // Backend maxLines limit is 200 per request
  const CHUNK_SIZE = 200
  if (lines.length > CHUNK_SIZE) {
    const chunks: string[][] = []
    for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
      chunks.push(lines.slice(i, i + CHUNK_SIZE))
    }
    const chunkResults = await Promise.all(
      chunks.map((c) => translateLyrics(c, targetLang, sourceLang, videoId)),
    )
    const combinedLines = chunkResults.flatMap((r) => r.lines)
    const combinedTranslated = chunkResults.flatMap((r) => r.translated)
    const hasRom = chunkResults.some((r) => Boolean(r.romanized))
    const combinedRomanized = hasRom
      ? chunkResults.flatMap((r) => r.romanized ?? r.lines.map(() => ""))
      : undefined

    return {
      lines: combinedLines,
      detectedLang: chunkResults[0]?.detectedLang ?? "",
      provider: chunkResults[0]?.provider ?? "google-lyrics-translate",
      cached: chunkResults.every((r) => r.cached),
      translated: combinedTranslated,
      romanized: combinedRomanized,
    }
  }

  const payload: Record<string, unknown> = {
    lines,
    to: toLyricsTranslateLang(targetLang),
  }
  if (sourceLang && sourceLang !== "auto") {
    payload.from = toLyricsTranslateLang(sourceLang)
  }
  if (videoId) payload.videoId = videoId

  const res = await fetch(resolveApiPath("/translate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errJson = await res.json().catch(() => null)
    throw new Error(errJson?.hint ?? errJson?.error ?? `HTTP ${res.status}`)
  }

  const json = await res.json()
  const resLines = (json.lines ?? []) as Array<{
    translation: string | null
    romanization: string | null
    needsTranslation: boolean
  }>

  const translated = resLines.map((l, i) => l.translation || lines[i] || "")
  const romanized = resLines.some((l) => Boolean(l.romanization))
    ? resLines.map((l) => l.romanization || "")
    : undefined

  return {
    lines: resLines,
    detectedLang: json.detectedLang ?? "",
    provider: json.provider ?? "google-lyrics-translate",
    cached: Boolean(json.cached),
    translated,
    romanized,
  }
}

export async function fetchLyricRevisions(lyricId: number): Promise<{ revisions: LyricRevision[] }> {
  try {
    const res = await fetch(resolveApiPath(`/lyrics/${lyricId}/revisions`))
    if (!res.ok) return { revisions: [] }
    const json = await res.json()
    return { revisions: json.data?.revisions ?? [] }
  } catch {
    return { revisions: [] }
  }
}

export async function saveLyricRevision(
  lyricId: number,
  input: {
    lyrics: string
    format: LyricsFormat | "auto"
    videoId?: string
    duration?: number
    song?: string
    artist?: string
    album?: string
    isrc?: string
    language?: string
    note?: string
  },
): Promise<{ revision: LyricRevision; decider?: import("./revision-types").SuggestionDecider }> {
  const session = loadStoredSession()

  const payload: Record<string, unknown> = {
    lyrics: input.lyrics,
    format: input.format === "auto" ? "plain" : input.format,
  }
  if (input.language !== undefined) {
    const rawLang = input.language?.trim()
    payload.language = rawLang ? (normalizeLanguage(rawLang) ?? rawLang) : null
  }
  if (input.isrc !== undefined) {
    const rawIsrc = input.isrc?.trim()
    payload.isrc = rawIsrc ? (normalizeIsrc(rawIsrc) ?? rawIsrc) : null
  }
  if (input.album !== undefined) payload.album = input.album?.trim() || null
  if (input.note?.trim()) payload.note = input.note.trim()

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  let bodyStr: string

  if (session?.sessionToken) {
    headers["Authorization"] = `Bearer ${session.sessionToken}`
    headers["X-Key-ID"] = session.keyId
    bodyStr = JSON.stringify(payload)
  } else {
    const signed = await signPayload(payload)
    bodyStr = JSON.stringify(signed)
  }

  const res = await fetch(resolveApiPath(`/lyrics/${lyricId}/revisions`), {
    method: "POST",
    headers,
    body: bodyStr,
  })

  if (!res.ok) {
    const errJson = await res.json().catch(() => null)
    throw new Error(errJson?.hint ?? errJson?.error ?? `HTTP ${res.status}`)
  }

  const json = await res.json()
  return json.data ?? { revision: json.revision }
}

export async function revertLyricRevision(lyricId: number, revId: number): Promise<void> {
  const session = loadStoredSession()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  let bodyStr: string

  if (session?.sessionToken) {
    headers["Authorization"] = `Bearer ${session.sessionToken}`
    headers["X-Key-ID"] = session.keyId
    bodyStr = JSON.stringify({})
  } else {
    const signed = await signPayload({})
    bodyStr = JSON.stringify(signed)
  }

  const res = await fetch(resolveApiPath(`/lyrics/${lyricId}/revisions/${revId}/revert`), {
    method: "POST",
    headers,
    body: bodyStr,
  })

  if (!res.ok) {
    const errJson = await res.json().catch(() => null)
    throw new Error(errJson?.hint ?? errJson?.error ?? `HTTP ${res.status}`)
  }
}

export async function fetchLinkedVideos(lyricId: number): Promise<{ videos: LinkedVideo[] }> {
  try {
    const res = await fetch(resolveApiPath(`/lyrics/${lyricId}/videos`))
    if (!res.ok) return { videos: [] }
    const json = await res.json()
    return { videos: json.data?.videos ?? [] }
  } catch {
    return { videos: [] }
  }
}

export async function linkVideoToLyric(lyricId: number, videoId: string): Promise<{ videos: LinkedVideo[] }> {
  const session = loadStoredSession()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  let bodyStr: string

  if (session?.sessionToken) {
    headers["Authorization"] = `Bearer ${session.sessionToken}`
    headers["X-Key-ID"] = session.keyId
    bodyStr = JSON.stringify({ videoId })
  } else {
    const signed = await signPayload({ videoId })
    bodyStr = JSON.stringify(signed)
  }

  const res = await fetch(resolveApiPath(`/lyrics/${lyricId}/videos`), {
    method: "POST",
    headers,
    body: bodyStr,
  })

  if (!res.ok) {
    const errJson = await res.json().catch(() => null)
    throw new Error(errJson?.hint ?? errJson?.error ?? `HTTP ${res.status}`)
  }

  const json = await res.json()
  return { videos: json.data?.videos ?? [] }
}

export async function unlinkVideoFromLyric(lyricId: number, videoId: string): Promise<{ videos: LinkedVideo[] }> {
  const session = loadStoredSession()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  let bodyStr: string

  if (session?.sessionToken) {
    headers["Authorization"] = `Bearer ${session.sessionToken}`
    headers["X-Key-ID"] = session.keyId
    bodyStr = JSON.stringify({})
  } else {
    const signed = await signPayload({})
    bodyStr = JSON.stringify(signed)
  }

  const res = await fetch(resolveApiPath(`/lyrics/${lyricId}/videos/${encodeURIComponent(videoId)}`), {
    method: "DELETE",
    headers,
    body: bodyStr,
  })

  if (!res.ok) {
    const errJson = await res.json().catch(() => null)
    throw new Error(errJson?.hint ?? errJson?.error ?? `HTTP ${res.status}`)
  }

  const json = await res.json()
  return { videos: json.data?.videos ?? [] }
}

export async function fetchSuggestedVideos(
  lyricId: number,
): Promise<{ suggestions: VideoSuggestion[]; linked: VideoSuggestion[] }> {
  try {
    const session = loadStoredSession()
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    let bodyStr: string

    if (session?.sessionToken) {
      headers["Authorization"] = `Bearer ${session.sessionToken}`
      headers["X-Key-ID"] = session.keyId
      bodyStr = JSON.stringify({})
    } else {
      const signed = await signPayload({})
      bodyStr = JSON.stringify(signed)
    }

    const res = await fetch(resolveApiPath(`/lyrics/${lyricId}/suggested-videos`), {
      method: "POST",
      headers,
      body: bodyStr,
    })
    if (!res.ok) return { suggestions: [], linked: [] }
    const json = await res.json()
    return {
      suggestions: json.data?.suggestions ?? [],
      linked: json.data?.linked ?? [],
    }
  } catch {
    return { suggestions: [], linked: [] }
  }
}

export interface LyricsLookupParams {
  v?: string
  song?: string
  artist?: string
  album?: string
  duration?: number
  isrc?: string
  spotify?: string
  apple_music?: string
  tidal?: string
  signal?: AbortSignal
}

export async function lookupLyrics(params: LyricsLookupParams): Promise<VariantFull & { matchedBy?: string }> {
  const search = new URLSearchParams()
  if (params.v) search.set("v", params.v)
  if (params.song) search.set("song", params.song)
  if (params.artist) search.set("artist", params.artist)
  if (params.album) search.set("album", params.album)
  if (params.duration !== undefined) search.set("duration", String(Math.round(params.duration)))
  if (params.isrc) search.set("isrc", params.isrc)
  if (params.spotify) search.set("spotify", params.spotify)
  if (params.apple_music) search.set("apple_music", params.apple_music)
  if (params.tidal) search.set("tidal", params.tidal)
  return getJsonWithSignal<VariantFull & { matchedBy?: string }>(`/lyrics?${search.toString()}`, params.signal)
}

export async function requestLyrics(input: {
  videoId: string
  song: string
  artist: string
  thumbnailUrl?: string
  album?: string
  duration?: number
}): Promise<{ status?: string; requestCount?: number; demand?: number }> {
  const signed = await signPayload(input as unknown as Record<string, unknown>)
  const res = await fetch(resolveApiPath("/requests"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signed),
  })
  if (!res.ok) {
    const errJson = await res.json().catch(() => null)
    throw new Error(errJson?.hint ?? errJson?.error ?? `HTTP ${res.status}`)
  }
  const json = await res.json()
  return json.data ?? { requestCount: 1, demand: 1 }
}

export type RevisionPreviewData = import("./revision-types").PreviewResult

export interface RevisionPreviewResponse {
  data: RevisionPreviewData | null
  errorCode?: string
  errorMessage?: string
}

export async function previewLyricRevisionDetailed(
  lyricId: number,
  input: {
    lyrics: string
    format: LyricsFormat | "auto"
    videoId?: string
    duration?: number
    song?: string
    artist?: string
    album?: string | null
    isrc?: string | null
    language?: string | null
  },
): Promise<RevisionPreviewResponse> {
  const session = loadStoredSession()
  const payload: Record<string, unknown> = {
    lyrics: input.lyrics,
    format: input.format === "auto" ? "plain" : input.format,
  }
  if (input.language !== undefined) {
    const rawLang = input.language?.trim()
    payload.language = rawLang ? (normalizeLanguage(rawLang) ?? rawLang) : null
  }
  if (input.isrc !== undefined) {
    const rawIsrc = input.isrc?.trim()
    payload.isrc = rawIsrc ? (normalizeIsrc(rawIsrc) ?? rawIsrc) : null
  }
  if (input.album !== undefined) payload.album = input.album?.trim() || null

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  let bodyStr: string

  if (session?.sessionToken) {
    headers["Authorization"] = `Bearer ${session.sessionToken}`
    headers["X-Key-ID"] = session.keyId
    bodyStr = JSON.stringify(payload)
  } else {
    const signed = await signPayload(payload)
    bodyStr = JSON.stringify(signed)
  }

  const res = await fetch(resolveApiPath(`/lyrics/${lyricId}/revisions/preview`), {
    method: "POST",
    headers,
    body: bodyStr,
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    return {
      data: null,
      errorCode: typeof json?.code === "string" ? json.code : undefined,
      errorMessage: typeof json?.hint === "string" ? json.hint : typeof json?.error === "string" ? json.error : `HTTP ${res.status}`,
    }
  }
  return { data: json?.data ?? null }
}

export async function previewLyricRevision(
  lyricId: number,
  input: {
    lyrics: string
    format: LyricsFormat | "auto"
    videoId?: string
    duration?: number
    song?: string
    artist?: string
    album?: string | null
    isrc?: string | null
    language?: string | null
  },
): Promise<RevisionPreviewData | null> {
  const res = await previewLyricRevisionDetailed(lyricId, input)
  return res.data
}

export async function compareLyricWithLive(
  lyricId: number,
  input: {
    lyrics: string
    format: LyricsFormat | "auto"
    album?: string | null
    isrc?: string | null
    language?: string | null
  },
): Promise<boolean> {
  const session = loadStoredSession()
  const payload: Record<string, unknown> = {
    lyrics: input.lyrics,
    format: input.format === "auto" ? "plain" : input.format,
  }
  if (input.language !== undefined) {
    const rawLang = input.language?.trim()
    payload.language = rawLang ? (normalizeLanguage(rawLang) ?? rawLang) : null
  }
  if (input.isrc !== undefined) {
    const rawIsrc = input.isrc?.trim()
    payload.isrc = rawIsrc ? (normalizeIsrc(rawIsrc) ?? rawIsrc) : null
  }
  if (input.album !== undefined) payload.album = input.album?.trim() || null

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  let bodyStr: string

  if (session?.sessionToken) {
    headers["Authorization"] = `Bearer ${session.sessionToken}`
    headers["X-Key-ID"] = session.keyId
    bodyStr = JSON.stringify(payload)
  } else {
    const signed = await signPayload(payload)
    bodyStr = JSON.stringify(signed)
  }

  const res = await fetch(resolveApiPath(`/lyrics/${lyricId}/revisions/compare`), {
    method: "POST",
    headers,
    body: bodyStr,
  })
  if (!res.ok) return false
  const json = await res.json().catch(() => null)
  return Boolean(json?.data?.same)
}

export async function approveLyricRevision(lyricId: number, revId: number): Promise<LyricRevision | null> {
  const session = loadStoredSession()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  let bodyStr: string

  if (session?.sessionToken) {
    headers["Authorization"] = `Bearer ${session.sessionToken}`
    headers["X-Key-ID"] = session.keyId
    bodyStr = JSON.stringify({})
  } else {
    const signed = await signPayload({})
    bodyStr = JSON.stringify(signed)
  }

  const res = await fetch(resolveApiPath(`/lyrics/${lyricId}/revisions/${revId}/approve`), {
    method: "POST",
    headers,
    body: bodyStr,
  })

  if (!res.ok) {
    const errJson = await res.json().catch(() => null)
    throw new Error(errJson?.hint ?? errJson?.error ?? `HTTP ${res.status}`)
  }
  const json = await res.json().catch(() => null)
  return json?.data?.revision ?? null
}

export async function rejectLyricRevision(
  lyricId: number,
  revId: number,
  note?: string,
): Promise<LyricRevision | null> {
  const session = loadStoredSession()
  const payload: Record<string, unknown> = note?.trim() ? { note: note.trim() } : {}
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  let bodyStr: string

  if (session?.sessionToken) {
    headers["Authorization"] = `Bearer ${session.sessionToken}`
    headers["X-Key-ID"] = session.keyId
    bodyStr = JSON.stringify(payload)
  } else {
    const signed = await signPayload(payload)
    bodyStr = JSON.stringify(signed)
  }

  const res = await fetch(resolveApiPath(`/lyrics/${lyricId}/revisions/${revId}/reject`), {
    method: "POST",
    headers,
    body: bodyStr,
  })

  if (!res.ok) {
    const errJson = await res.json().catch(() => null)
    throw new Error(errJson?.hint ?? errJson?.error ?? `HTTP ${res.status}`)
  }
  const json = await res.json().catch(() => null)
  return json?.data?.revision ?? null
}

export async function fetchSuggestedVideosForSong(input: {
  song: string
  artist: string
  album?: string
  duration?: number
  videoId?: string
}): Promise<{ suggestions: VideoSuggestion[] }> {
  try {
    const session = loadStoredSession()
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    let bodyStr: string
    const payload: Record<string, unknown> = {
      song: input.song,
      artist: input.artist,
      album: input.album ?? null,
      duration: input.duration ?? 180,
    }
    if (input.videoId) payload.videoId = input.videoId

    if (session?.sessionToken) {
      headers["Authorization"] = `Bearer ${session.sessionToken}`
      headers["X-Key-ID"] = session.keyId
      bodyStr = JSON.stringify(payload)
    } else {
      const signed = await signPayload(payload)
      bodyStr = JSON.stringify(signed)
    }

    const res = await fetch(resolveApiPath("/lyrics/suggested-videos"), {
      method: "POST",
      headers,
      body: bodyStr,
    })
    if (!res.ok) return { suggestions: [] }
    const json = await res.json()
    return { suggestions: json.data?.suggestions ?? [] }
  } catch {
    return { suggestions: [] }
  }
}

export interface BoostQuota {
  used: number
  total: number
  resetsAt: number
}

export async function fetchBoostQuota(): Promise<BoostQuota | null> {
  try {
    const session = loadStoredSession()
    if (!session?.sessionToken) return null
    const res = await fetch(resolveApiPath("/lyrics/boost/quota"), {
      headers: {
        Authorization: `Bearer ${session.sessionToken}`,
        "X-Key-ID": session.keyId,
      },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.quota ?? null
  } catch {
    return null
  }
}

export async function boostVariant(id: number): Promise<{ quota?: BoostQuota }> {
  const session = loadStoredSession()
  if (!session?.sessionToken) throw new Error("AUTH_REQUIRED")
  const res = await fetch(resolveApiPath(`/lyrics/${id}/boost`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.sessionToken}`,
      "X-Key-ID": session.keyId,
    },
  })
  if (!res.ok) {
    const errJson = await res.json().catch(() => null)
    throw new Error(errJson?.hint ?? errJson?.error ?? `HTTP ${res.status}`)
  }
  const json = await res.json()
  return { quota: json.quota }
}

export async function unboostVariant(id: number): Promise<void> {
  const session = loadStoredSession()
  if (!session?.sessionToken) throw new Error("AUTH_REQUIRED")
  const res = await fetch(resolveApiPath(`/lyrics/${id}/boost`), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${session.sessionToken}`,
      "X-Key-ID": session.keyId,
    },
  })
  if (!res.ok) {
    const errJson = await res.json().catch(() => null)
    throw new Error(errJson?.hint ?? errJson?.error ?? `HTTP ${res.status}`)
  }
}

export interface UserFulfillmentStats {
  requestsFulfilled: number
  totalDemandFulfilled: number
}

export async function fetchUserFulfillmentStats(keyId: string): Promise<UserFulfillmentStats | null> {
  try {
    const res = await fetch(resolveApiPath(`/users/${encodeURIComponent(keyId)}/stats`))
    if (!res.ok) return null
    const json = await res.json()
    return json.data ?? null
  } catch {
    return null
  }
}

export interface SongRankResponse {
  ranked: boolean
  rank?: number
  demand?: number
  requestCount?: number
}

export async function fetchSongRank(videoId: string): Promise<SongRankResponse> {
  try {
    const res = await fetch(resolveApiPath(`/leaderboard/songs/${encodeURIComponent(videoId)}`))
    if (!res.ok) return { ranked: false }
    const json = await res.json()
    return json.data ?? { ranked: false }
  } catch {
    return { ranked: false }
  }
}

export const fetchSearchResults = searchLyrics
