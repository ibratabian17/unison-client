import { thumbs } from "@dicebear/collection"
import { createAvatar } from "@dicebear/core"

const cache = new Map<string, string>()

export function dicebearThumbsDataUri(seed: string): string {
  const cached = cache.get(seed)
  if (cached) return cached
  const svg = createAvatar(thumbs, { seed, radius: 50 }).toString()
  const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  cache.set(seed, uri)
  return uri
}

export function resolveAvatar({ avatarUrl, keyId }: { avatarUrl?: string | null; keyId: string }): string {
  if (avatarUrl) {
    if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://") || avatarUrl.startsWith("data:")) {
      return avatarUrl
    }
    if (avatarUrl.startsWith("/avatars/") || avatarUrl.startsWith("/badges/")) {
      return `https://unison.betterlyrics.org${avatarUrl}`
    }
    if (avatarUrl.startsWith("/")) {
      const base = import.meta.env.BASE_URL || "./"
      const cleanBase = base.endsWith("/") ? base : `${base}/`
      return `${cleanBase}${avatarUrl.slice(1)}`
    }
    return avatarUrl
  }
  return dicebearThumbsDataUri(keyId)
}
