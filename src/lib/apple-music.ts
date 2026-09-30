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

let cachedToken: string | null = null
let tokenExpiresAt = 0
let tokenPromise: Promise<string | null> | null = null

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
      const tokenType = data.token_type ?? "Bearer"
      const authHeader = `${tokenType} ${data.token}`.trim()
      cachedToken = authHeader
      const ttlSec =
        typeof data.cache_ttl_seconds === "number" && data.cache_ttl_seconds > 0
          ? data.cache_ttl_seconds
          : 120
      // Buffer by 10s to refresh slightly before expiry
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

export async function searchAppleMusic(term: string): Promise<AppleMusicSong[]> {
  const trimmed = term.trim()
  if (!trimmed) return []

  try {
    const authHeader = await getAppleMusicToken()
    if (!authHeader) {
      console.error("Apple Music search aborted: unable to obtain token")
      return []
    }

    const params = new URLSearchParams({
      term: trimmed,
      types: "songs",
      limit: "20",
      offset: "0",
      l: "en-US",
      with: "lyricHighlights,lyrics",
    })

    const res = await fetch(`https://api.music.apple.com/v1/catalog/us/search?${params.toString()}`, {
      headers: {
        Authorization: authHeader,
      },
    })

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
