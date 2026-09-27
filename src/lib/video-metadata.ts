export interface VideoMetadata {
  title: string
  artist: string
  song: string
  authorName: string
  thumbnailUrl: string
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*[\(\[](?:Official\s+)?(?:Music\s+)?(?:Video|Audio|Lyric\s+Video|Visualizer|Clip|HD|4K|HQ|4K\s+Remaster)[\)\]]/gi, "")
    .replace(/\s*[\(\[](?:Lyrics|Lyric|Official)[\)\]]/gi, "")
    .replace(/\s*ft\.?\s+.*$/i, "")
    .replace(/\s*feat\.?\s+.*$/i, "")
    .trim()
}

function cleanArtist(raw: string): string {
  return raw
    .replace(/VEVO$/i, "")
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/\s*Official$/i, "")
    .trim()
}

export async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null

  try {
    const url = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    if (!json || !json.title) return null

    const rawTitle = json.title as string
    const authorName = cleanArtist((json.author_name as string) || "")
    const cleaned = cleanTitle(rawTitle)

    let artist = authorName
    let song = cleaned

    // Look for "Artist - Song" pattern
    const dashMatch = cleaned.match(/^(.+?)\s*[-–—:]\s*(.+)$/)
    if (dashMatch) {
      artist = dashMatch[1].trim()
      song = dashMatch[2].trim()
    }

    return {
      title: rawTitle,
      artist: artist || authorName,
      song: song || cleaned,
      authorName,
      thumbnailUrl: (json.thumbnail_url as string) || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    }
  } catch {
    return null
  }
}
