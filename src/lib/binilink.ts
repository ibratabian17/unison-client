export const BINILINK_BASE_URL = "https://link.binimum.org"

export type BiniLinkProvider = "spotify" | "apple_music" | "tidal"
export type BiniLinkMetadataService = "spotify" | "apple_music" | "tidal" | "deezer" | "youtube"

export interface BiniLinkArtist {
  id: string
  name: string | null
  role: "primary" | "featured" | "associated" | "credited" | "unknown"
  position: number
}

export interface BiniLinkAlbum {
  id: string
  title: string | null
  release_date: string | null
  artwork_url: string | null
  artists?: BiniLinkArtist[]
}

export interface BiniLinkMetadata {
  service: BiniLinkMetadataService
  id: string
  title: string | null
  artists: BiniLinkArtist[]
  duration_ms: number | null
  release_date: string | null
  advisory: number | string | null
  track_number: number | null
  disc_number: number | null
  album?: BiniLinkAlbum
  metadata_source?: "apple_music"
  apple_music_id?: string
  coverage?: "limited"
}

export interface BiniLinkMapping {
  isrc: string
  spotify?: string
  apple_music?: string
  tidal?: string
  youtube: string | null
}

export interface BiniLinkIndividualMapping extends BiniLinkMapping {
  metadata?: {
    spotify?: BiniLinkMetadata | null
    apple_music?: BiniLinkMetadata | null
    tidal?: BiniLinkMetadata | null
    youtube?: BiniLinkMetadata | null
  }
  metadata_unavailable?: Array<"spotify" | "apple_music" | "tidal" | "youtube">
}

export interface BiniLinkResolvedTrack {
  id: string
  song: string
  artist: string
  album?: string
  duration?: number
  isrc?: string
  releaseDate?: string
  artworkUrl?: string
  youtubeId?: string
  spotifyId?: string
  appleMusicId?: string
  tidalId?: string
  matchedVia: string
}

export function formatBiniLinkArtwork(url?: string | null, size = 160): string | undefined {
  if (!url) return undefined
  return url.replace("{w}", String(size)).replace("{h}", String(size))
}

function formatArtists(artists?: BiniLinkArtist[]): string {
  if (!artists || artists.length === 0) return ""
  const sorted = [...artists].sort((a, b) => a.position - b.position)
  const primary = sorted.filter((a) => a.role === "primary" && a.name).map((a) => a.name!.trim())
  if (primary.length > 0) return primary.join(", ")
  const names = sorted.map((a) => a.name?.trim()).filter((n): n is string => Boolean(n))
  return names.join(", ")
}

async function fetchBiniLinkJson<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(`${BINILINK_BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal: signal ?? AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function getBiniLinkTrackMetadata(
  service: BiniLinkMetadataService,
  id: string,
  signal?: AbortSignal,
): Promise<BiniLinkMetadata | null> {
  return fetchBiniLinkJson<BiniLinkMetadata>(
    `/api/v1/metadata/${service}/${encodeURIComponent(id)}`,
    signal,
  )
}

export async function resolveBiniLinkProviderId(
  service: BiniLinkProvider,
  id: string,
  signal?: AbortSignal,
): Promise<BiniLinkMapping | null> {
  return fetchBiniLinkJson<BiniLinkMapping>(
    `/api/v1/resolve/${service}/${encodeURIComponent(id)}`,
    signal,
  )
}

export async function lookupBiniLinkIsrc(
  isrc: string,
  signal?: AbortSignal,
): Promise<BiniLinkIndividualMapping | null> {
  const clean = isrc.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
  if (!/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(clean)) return null
  return fetchBiniLinkJson<BiniLinkIndividualMapping>(
    `/api/v1/isrc/${encodeURIComponent(clean)}`,
    signal,
  )
}

function buildResolvedTrack(
  meta: BiniLinkMetadata | null,
  mapping: Partial<BiniLinkMapping> | null,
  matchedVia: string,
  fallbackId: string,
): BiniLinkResolvedTrack | null {
  const title = meta?.title?.trim() || ""
  const artist = formatArtists(meta?.artists)
  const isrc = mapping?.isrc
  if (!title && !isrc) return null

  const duration =
    typeof meta?.duration_ms === "number" && meta.duration_ms > 0
      ? Math.round(meta.duration_ms / 1000)
      : undefined

  return {
    id: isrc || meta?.id || fallbackId,
    song: title,
    artist,
    album: meta?.album?.title?.trim() || undefined,
    duration,
    isrc: isrc || undefined,
    releaseDate: meta?.release_date || meta?.album?.release_date || undefined,
    artworkUrl: formatBiniLinkArtwork(meta?.album?.artwork_url, 160),
    youtubeId: mapping?.youtube ?? (meta?.service === "youtube" ? meta.id : undefined),
    spotifyId: mapping?.spotify ?? (meta?.service === "spotify" ? meta.id : undefined),
    appleMusicId:
      mapping?.apple_music ??
      meta?.apple_music_id ??
      (meta?.service === "apple_music" ? meta.id : undefined),
    tidalId: mapping?.tidal ?? (meta?.service === "tidal" ? meta.id : undefined),
    matchedVia,
  }
}

/**
 * Auto-match a YouTube / YouTube Music 11-char videoId via BiniLink:
 * 1. GET /api/v1/metadata/youtube/{videoId}
 * 2. If apple_music_id is returned, also resolve GET /api/v1/resolve/apple_music/{apple_music_id} to obtain ISRC and cross-service IDs.
 */
export async function matchYouTubeViaBiniLink(
  videoId: string,
  signal?: AbortSignal,
): Promise<BiniLinkResolvedTrack | null> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null
  const meta = await getBiniLinkTrackMetadata("youtube", videoId, signal)
  if (!meta) return null

  let mapping: BiniLinkMapping | null = null
  if (meta.apple_music_id) {
    mapping = await resolveBiniLinkProviderId("apple_music", meta.apple_music_id, signal)
  }

  return buildResolvedTrack(
    meta,
    mapping ?? { youtube: videoId, apple_music: meta.apple_music_id },
    "BiniLink (YouTube)",
    videoId,
  )
}

export async function resolveIsrcWithMetadata(
  isrcInput: string,
  signal?: AbortSignal,
): Promise<BiniLinkResolvedTrack | null> {
  const clean = isrcInput.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
  const data = await lookupBiniLinkIsrc(clean, signal)
  if (!data) return null

  let meta: BiniLinkMetadata | null =
    data.metadata?.apple_music ??
    data.metadata?.spotify ??
    data.metadata?.tidal ??
    data.metadata?.youtube ??
    null

  if (!meta) {
    const candidates: Array<[BiniLinkMetadataService, string | undefined]> = [
      ["apple_music", data.apple_music],
      ["spotify", data.spotify],
      ["tidal", data.tidal],
      ["youtube", data.youtube ?? undefined],
    ]
    for (const [svc, id] of candidates) {
      if (!id) continue
      meta = await getBiniLinkTrackMetadata(svc, id, signal)
      if (meta?.title) break
    }
  }

  return buildResolvedTrack(meta, data, `BiniLink (ISRC ${data.isrc})`, data.isrc)
}

export async function resolveProviderWithMetadata(
  service: BiniLinkProvider,
  id: string,
  signal?: AbortSignal,
): Promise<BiniLinkResolvedTrack | null> {
  const [mapping, directMeta] = await Promise.all([
    resolveBiniLinkProviderId(service, id, signal),
    getBiniLinkTrackMetadata(service, id, signal),
  ])

  let meta = directMeta
  if (!meta?.title && mapping) {
    const fallbacks: Array<[BiniLinkMetadataService, string | undefined]> = [
      ["apple_music", mapping.apple_music],
      ["spotify", mapping.spotify],
      ["tidal", mapping.tidal],
      ["youtube", mapping.youtube ?? undefined],
    ]
    for (const [svc, fallbackId] of fallbacks) {
      if (!fallbackId || (svc === service && fallbackId === id)) continue
      meta = await getBiniLinkTrackMetadata(svc, fallbackId, signal)
      if (meta?.title) break
    }
  }

  if (!meta && !mapping) return null
  return buildResolvedTrack(
    meta,
    mapping ?? ({ [service]: id } as Partial<BiniLinkMapping>),
    `BiniLink (${service.replace("_", " ")})`,
    id,
  )
}

export type ParsedBiniLinkQuery =
  | { kind: "isrc"; isrc: string }
  | { kind: "provider"; service: BiniLinkProvider; id: string }
  | { kind: "youtube"; videoId: string }
  | { kind: "numeric"; id: string }

export function parseBiniLinkInput(raw: string): ParsedBiniLinkQuery | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // 1. Spotify URL or URI
  const spotifyUrl = trimmed.match(/(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/)
  if (spotifyUrl) return { kind: "provider", service: "spotify", id: spotifyUrl[1] }

  // 2. Apple Music URL (?i=trackId or /song/.../trackId)
  if (/music\.apple\.com/i.test(trimmed)) {
    const iParam = trimmed.match(/[?&]i=([0-9]{1,128})/)
    if (iParam) return { kind: "provider", service: "apple_music", id: iParam[1] }
    const lastDigits = trimmed.match(/\/([0-9]{5,128})(?:[/?#]|$)/)
    if (lastDigits) return { kind: "provider", service: "apple_music", id: lastDigits[1] }
  }

  // 3. Tidal URL (tidal.com/browse/track/123 or tidal.com/track/123)
  const tidalUrl = trimmed.match(/tidal\.com\/(?:browse\/)?track\/([0-9]{1,128})/i)
  if (tidalUrl) return { kind: "provider", service: "tidal", id: tidalUrl[1] }

  // 4. YouTube / YouTube Music URL
  const ytUrl = trimmed.match(/(?:v=|\/embed\/|\.be\/|\/v\/|watch\?v=|\/shorts\/)([A-Za-z0-9_-]{11})/)
  if (ytUrl) return { kind: "youtube", videoId: ytUrl[1] }

  // 5. Prefixed service:id (e.g. spotify:..., apple_music:..., tidal:..., isrc:...)
  const prefixed = trimmed.match(/^(spotify|apple_music|apple|tidal|youtube|isrc)[:\s]+(.+)$/i)
  if (prefixed) {
    const svc = prefixed[1].toLowerCase()
    const val = prefixed[2].trim()
    if (svc === "isrc") return { kind: "isrc", isrc: val.replace(/[^A-Za-z0-9]/g, "").toUpperCase() }
    if (svc === "youtube") return { kind: "youtube", videoId: val }
    if (svc === "spotify") return { kind: "provider", service: "spotify", id: val }
    if (svc === "apple_music" || svc === "apple") return { kind: "provider", service: "apple_music", id: val }
    if (svc === "tidal") return { kind: "provider", service: "tidal", id: val }
  }

  // 6. 12-char ISRC (with or without hyphens, e.g. US-RC1-76-07839 or USRC17607839)
  const cleanAlnum = trimmed.replace(/[-\s]/g, "").toUpperCase()
  if (/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(cleanAlnum)) {
    return { kind: "isrc", isrc: cleanAlnum }
  }

  // 7. 22-char Spotify track ID
  if (/^[A-Za-z0-9]{22}$/.test(trimmed)) {
    return { kind: "provider", service: "spotify", id: trimmed }
  }

  // 8. Decimal digits (Apple Music or Tidal track ID)
  if (/^[0-9]{1,128}$/.test(trimmed)) {
    return { kind: "numeric", id: trimmed }
  }

  // 9. 11-char YouTube video ID
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return { kind: "youtube", videoId: trimmed }
  }

  return null
}

export async function lookupBiniLink(
  query: string,
  preferredService: "auto" | "isrc" | "spotify" | "apple_music" | "tidal" | "youtube" = "auto",
  signal?: AbortSignal,
): Promise<BiniLinkResolvedTrack[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  if (preferredService !== "auto") {
    const parsed = parseBiniLinkInput(trimmed)
    if (preferredService === "isrc") {
      const hit = await resolveIsrcWithMetadata(parsed?.kind === "isrc" ? parsed.isrc : trimmed, signal)
      return hit ? [hit] : []
    }
    if (preferredService === "youtube") {
      const vid = parsed?.kind === "youtube" ? parsed.videoId : trimmed
      const hit = await matchYouTubeViaBiniLink(vid, signal)
      return hit ? [hit] : []
    }
    const id = parsed && "id" in parsed ? parsed.id : trimmed
    const hit = await resolveProviderWithMetadata(preferredService, id, signal)
    return hit ? [hit] : []
  }

  const parsed = parseBiniLinkInput(trimmed)
  if (!parsed) return []

  if (parsed.kind === "isrc") {
    const hit = await resolveIsrcWithMetadata(parsed.isrc, signal)
    return hit ? [hit] : []
  }
  if (parsed.kind === "youtube") {
    const hit = await matchYouTubeViaBiniLink(parsed.videoId, signal)
    return hit ? [hit] : []
  }
  if (parsed.kind === "provider") {
    const hit = await resolveProviderWithMetadata(parsed.service, parsed.id, signal)
    return hit ? [hit] : []
  }
  if (parsed.kind === "numeric") {
    const [appleHit, tidalHit] = await Promise.all([
      resolveProviderWithMetadata("apple_music", parsed.id, signal),
      resolveProviderWithMetadata("tidal", parsed.id, signal),
    ])
    const results: BiniLinkResolvedTrack[] = []
    if (appleHit) results.push(appleHit)
    if (tidalHit && (!appleHit || tidalHit.isrc !== appleHit.isrc)) results.push(tidalHit)
    return results
  }

  return []
}
