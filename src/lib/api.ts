import { resolveApiPath } from "./api-url"
import { loadStoredSession } from "./auth"
import { signPayload } from "./browser-identity"
import { AUTHED_FETCH_ERRORS, authedFetch } from "./authedFetch"
import { IS_SPA_EXPANSION_SEED } from "./seed-flag"
import type {
  ApiEnvelope,
  AvatarCatalogue,
  AvatarChoice,
  BadgeCatalogue,
  CuratorsLeaderboardResponse,
  DumpManifest,
  LinkedVideo,
  LyricRevision,
  LyricsFormat,
  LyricsSearchHit,
  QueueEntry,
  RevisionDiff,
  RevisionSummary,
  SongsLeaderboardResponse,
  UserGamification,
  UserRankResponse,
  UserSubmissionsResponse,
  VariantFull,
  VariantSummary,
  VideoSuggestion,
} from "./types"

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

export async function fetchUserSubmissions(keyId: string, cursor?: string): Promise<UserSubmissionsResponse> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed")).seedUserSubmissions(keyId)
  const params = cursor !== undefined ? `?cursor=${encodeURIComponent(cursor)}` : ""
  return getJson<UserSubmissionsResponse>(`/users/${encodeURIComponent(keyId)}/submissions${params}`)
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

export async function fetchArtwork(videoId: string, size?: number): Promise<string | null> {
  if (IS_SPA_EXPANSION_SEED) return null
  const sized = size !== undefined ? `&size=${size}` : ""
  const { artworkUrl } = await getJson<{ artworkUrl: string | null }>(
    `/artwork?v=${encodeURIComponent(videoId)}${sized}`,
  )
  return artworkUrl
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

export async function reportVariant(
  id: number,
  reason: "wrong_song" | "bad_sync" | "offensive" | "spam" | "other",
  details?: string,
): Promise<void> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed-spa-expansion")).seedReport(id, reason, details)
  const data: Record<string, unknown> = { reason }
  if (details) data.details = details
  const signed = await signPayload(data)
  const res = await fetch(resolveApiPath(`/lyrics/${id}/report`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signed),
  })
  if (!res.ok) {
    const errJson = await res.json().catch(() => null)
    throw new Error(errJson?.error ?? `HTTP ${res.status}`)
  }
}

const QUEUE_PAGE_LIMIT = 50

export async function fetchQueue(
  opts: { cursor?: string; signal?: AbortSignal } = {},
): Promise<{ items: QueueEntry[]; nextCursor: string | null }> {
  if (IS_SPA_EXPANSION_SEED) return (await import("./dev-seed-spa-expansion")).seedQueue({ cursor: opts.cursor })
  const search = new URLSearchParams()
  search.set("cursor", opts.cursor ?? "")
  search.set("limit", String(QUEUE_PAGE_LIMIT))
  const path = `/leaderboard/songs?${search.toString()}`
  const res = await fetch(resolveApiPath(path), opts.signal ? { signal: opts.signal } : undefined)
  if (!res.ok) {
    await unwrapMutationError(res)
  }
  const body = (await res.json()) as ApiEnvelope<QueueEntry[]> & { nextCursor?: string | null }
  if (!body.success) throw new Error(body.error)
  return { items: body.data, nextCursor: body.nextCursor ?? null }
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
  if (filters?.sort && filters.sort !== "newest") params.set("sort", filters.sort)

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
  const signed = await signPayload(submission as unknown as Record<string, unknown>)
  const res = await fetch(resolveApiPath("/lyrics/submit"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signed),
  })
  if (!res.ok) {
    const errJson = await res.json().catch(() => null)
    throw new Error(errJson?.error ?? `HTTP ${res.status}`)
  }
  const json = await res.json()
  return json.data ?? { id: json.id, created: true }
}

export async function deleteLyrics(id: number): Promise<void> {
  const signed = await signPayload()
  const res = await fetch(resolveApiPath(`/lyrics/${id}`), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signed),
  })
  if (!res.ok) {
    const errJson = await res.json().catch(() => null)
    throw new Error(errJson?.error ?? `HTTP ${res.status}`)
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
  const payload: Record<string, unknown> = {
    lines,
    to: targetLang,
  }
  if (sourceLang && sourceLang !== "auto") payload.from = sourceLang
  if (videoId) payload.videoId = videoId

  const res = await fetch(resolveApiPath("/translate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errJson = await res.json().catch(() => null)
    throw new Error(errJson?.error ?? `HTTP ${res.status}`)
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

export function isNotFound(err: unknown): boolean {
  if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) return true
  if (err instanceof Error) return /404|not found/i.test(err.message)
  return false
}

export async function fetchRevisions(lyricsId: number, signal?: AbortSignal): Promise<RevisionSummary[]> {
  try {
    const { revisions } = await getJsonWithSignal<{ revisions: RevisionSummary[] }>(
      `/lyrics/${lyricsId}/revisions`,
      signal,
    )
    return revisions ?? []
  } catch {
    return []
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

export async function fetchRevisionDiff(
  lyricId: number,
  revId: number,
  againstOrSignal?: number | AbortSignal,
  signal?: AbortSignal,
): Promise<RevisionDiff | null> {
  try {
    const against = typeof againstOrSignal === "number" ? againstOrSignal : undefined
    const sig = againstOrSignal instanceof AbortSignal ? againstOrSignal : signal
    const query = against !== undefined ? `?against=${against}` : ""
    const res = await fetch(resolveApiPath(`/lyrics/${lyricId}/revisions/${revId}/diff${query}`), { signal: sig })
    if (!res.ok) return null
    const json = await res.json()
    return json.data ?? null
  } catch {
    return null
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
  },
): Promise<{ revision: LyricRevision }> {
  const session = loadStoredSession()

  const payload: Record<string, unknown> = {
    lyrics: input.lyrics,
    format: input.format === "auto" ? "plain" : input.format,
  }
  if (input.language) payload.language = input.language
  if (input.isrc) payload.isrc = input.isrc
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

export async function fetchSuggestedVideos(lyricId: number): Promise<{ suggestions: VideoSuggestion[] }> {
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
    if (!res.ok) return { suggestions: [] }
    const json = await res.json()
    return { suggestions: json.data?.suggestions ?? [] }
  } catch {
    return { suggestions: [] }
  }
}


