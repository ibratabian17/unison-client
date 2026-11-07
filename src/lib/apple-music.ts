export interface AppleMusicArtwork {
  url: string
  width?: number
  height?: number
  bgColor?: string
}

export interface AppleMusicSongAttributes {
  name: string
  artistName: string
  albumName?: string
  isrc?: string
  durationInMillis?: number
  releaseDate?: string
  genreNames?: string[]
  artwork?: AppleMusicArtwork
  url?: string
}

export interface AppleMusicSong {
  id: string
  type: string
  attributes: AppleMusicSongAttributes
}

interface MintTokenResponse {
  storefront_id?: string
  token: string
  token_type?: string
  cache_ttl_seconds?: number
}

const TOKEN_ENDPOINT = "https://am-mint.binimum.org/token"
const DEFAULT_STOREFRONT = "us"

let cachedToken: string | null = null
let cachedStorefront: string | null = null
let tokenExpiresAt = 0
let tokenPromise: Promise<string | null> | null = null
let storefrontPromise: Promise<string> | null = null

function normalizeStorefront(code?: string | null): string | null {
  if (!code) return null
  const clean = code.trim().toLowerCase()
  return /^[a-z]{2}$/.test(clean) ? clean : null
}

/**
 * Resolves the 2-letter Apple Music storefront ID from the user's IP address,
 * falling back to "us" if lookup fails.
 */
export async function getAppleMusicStorefront(): Promise<string> {
  if (cachedStorefront) return cachedStorefront
  if (storefrontPromise) return storefrontPromise

  storefrontPromise = (async () => {
    // 1. Try api.country.is (fast CORS-enabled IP -> ISO country lookup)
    try {
      const res = await fetch("https://api.country.is/", {
        signal: AbortSignal.timeout(2500),
      })
      if (res.ok) {
        const data = (await res.json()) as { country?: string }
        const sf = normalizeStorefront(data?.country)
        if (sf) {
          cachedStorefront = sf
          return sf
        }
      }
    } catch {}

    // 2. Fallback IP lookup via ipwho.is
    try {
      const res = await fetch("https://ipwho.is/?fields=country_code", {
        signal: AbortSignal.timeout(2500),
      })
      if (res.ok) {
        const data = (await res.json()) as { country_code?: string }
        const sf = normalizeStorefront(data?.country_code)
        if (sf) {
          cachedStorefront = sf
          return sf
        }
      }
    } catch {}

    // 3. Fallback to storefront_id returned by am-mint token endpoint or "us"
    cachedStorefront = cachedStorefront || DEFAULT_STOREFRONT
    return cachedStorefront
  })().finally(() => {
    storefrontPromise = null
  })

  return storefrontPromise
}

export async function getAppleMusicToken(): Promise<string | null> {
  const now = Date.now()
  if (cachedToken && tokenExpiresAt > now) {
    return cachedToken
  }

  if (tokenPromise) {
    return tokenPromise
  }

  tokenPromise = (async () => {
    try {
      const res = await fetch(TOKEN_ENDPOINT)
      if (!res.ok) {
        throw new Error(`Failed to fetch Apple Music token: HTTP ${res.status}`)
      }
      const data: MintTokenResponse = await res.json()
      if (!data?.token) {
        throw new Error("Invalid token response: missing token")
      }
      const mintStorefront = normalizeStorefront(data.storefront_id)
      if (mintStorefront && !cachedStorefront) {
        cachedStorefront = mintStorefront
      }
      const tokenType = data.token_type ?? "Bearer"
      const authHeader = `${tokenType} ${data.token}`.trim()
      cachedToken = authHeader
      const ttlSec =
        typeof data.cache_ttl_seconds === "number" && data.cache_ttl_seconds > 0
          ? data.cache_ttl_seconds
          : 120
      tokenExpiresAt = Date.now() + Math.max(10, ttlSec - 10) * 1000
      return authHeader
    } catch (err) {
      console.error("Failed to retrieve Apple Music token from endpoint:", err)
      return null
    } finally {
      tokenPromise = null
    }
  })()

  return tokenPromise
}

async function fetchCatalogSongs(
  storefront: string,
  params: URLSearchParams,
  authHeader: string,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(`https://api.music.apple.com/v1/catalog/${storefront}/search?${params.toString()}`, {
    headers: {
      Authorization: authHeader,
    },
    signal,
  })
}

export async function searchAppleMusic(term: string, signal?: AbortSignal): Promise<AppleMusicSong[]> {
  const trimmed = term.trim()
  if (!trimmed) return []

  try {
    const [authHeader, detectedStorefront] = await Promise.all([
      getAppleMusicToken(),
      getAppleMusicStorefront().catch(() => DEFAULT_STOREFRONT),
    ])
    if (!authHeader) {
      return []
    }

    const storefront = normalizeStorefront(detectedStorefront) ?? DEFAULT_STOREFRONT
    const params = new URLSearchParams({
      term: trimmed,
      types: "songs",
      limit: "20",
      offset: "0",
      l: "en-US",
      with: "lyricHighlights,lyrics",
    })

    let res = await fetchCatalogSongs(storefront, params, authHeader, signal)

    // If the IP-detected storefront is unsupported by Apple Music or fails, fall back to "us"
    if (!res.ok && storefront !== DEFAULT_STOREFRONT) {
      cachedStorefront = DEFAULT_STOREFRONT
      res = await fetchCatalogSongs(DEFAULT_STOREFRONT, params, authHeader, signal)
    }

    if (!res.ok) {
      throw new Error(`Apple Music API error: HTTP ${res.status}`)
    }

    const json = await res.json()
    return json?.results?.songs?.data ?? []
  } catch (err) {
    console.error("Failed to search Apple Music:", err)
    return []
  }
}

export function formatArtworkUrl(artwork?: AppleMusicArtwork, size = 120): string {
  if (!artwork?.url) return ""
  return artwork.url.replace("{w}", String(size)).replace("{h}", String(size))
}
