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

const APPLE_MUSIC_TOKEN =
  "Bearer eyJraWQiOiJOWktGRzJEUzBKIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJVREsyOFNOMTBQIiwiaWF0IjoxNzkwNTAwNTgxLCJleHAiOjE3OTMwOTI1ODEsIm1pZCI6ImJPQXdvUitCNGxYaDhLdGNFaDVaQ3BESTJuMD0ifQ.wSzWEU_-rp5sBhwkS2N8ZxP0KbeMH_MwtEEmCNsn-0F4RoWTetYexMzKZFE2WhYf44zmK3tHdcJb3VCitpCZjg"

export async function searchAppleMusic(term: string): Promise<AppleMusicSong[]> {
  const trimmed = term.trim()
  if (!trimmed) return []

  try {
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
        Authorization: APPLE_MUSIC_TOKEN,
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
