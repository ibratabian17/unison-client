import type { BadgeCatalogue, BadgeDef, BadgeImage } from "./types"

const IMAGE_VARIANTS: (keyof BadgeImage)[] = ["color", "mono", "silhouette"]

export function resolveAssetUrl(url: string | undefined): string {
  if (!url) return ""
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:") || url.startsWith("blob:")) {
    return url
  }
  if (url.startsWith("/badge-art/")) {
    const base = import.meta.env.BASE_URL || "./"
    const cleanBase = base.endsWith("/") ? base : `${base}/`
    return `${cleanBase}${url.slice(1)}`
  }
  if (url.startsWith("/badges/") || url.startsWith("/avatars/") || url.startsWith("/artwork")) {
    return `https://unison.betterlyrics.org${url}`
  }
  if (url.startsWith("/")) {
    const base = import.meta.env.BASE_URL || "./"
    const cleanBase = base.endsWith("/") ? base : `${base}/`
    return `${cleanBase}${url.slice(1)}`
  }
  return url
}

export function collectBadgeAssetUrls(
  catalogue: BadgeCatalogue,
  variants: (keyof BadgeImage)[] = IMAGE_VARIANTS,
): string[] {
  const urls = new Set<string>()
  for (const badge of catalogue.badges) {
    for (const variant of variants) {
      if (badge.image[variant]) urls.add(resolveAssetUrl(badge.image[variant]))
    }
    for (const tier of badge.tiers ?? []) {
      if (!tier.image) continue
      for (const variant of variants) {
        if (tier.image[variant]) urls.add(resolveAssetUrl(tier.image[variant]))
      }
    }
  }
  return [...urls]
}

export interface BadgeGroup {
  category: string
  badges: BadgeDef[]
}

export function groupBadgesByCategory(badges: BadgeDef[], categoryOrder: string[]): BadgeGroup[] {
  const byCategory = new Map<string, BadgeDef[]>()
  for (const badge of badges) {
    const list = byCategory.get(badge.category)
    if (list) list.push(badge)
    else byCategory.set(badge.category, [badge])
  }

  const groups: BadgeGroup[] = []
  const placed = new Set<string>()
  for (const category of categoryOrder) {
    const list = byCategory.get(category)
    if (list && list.length > 0 && !placed.has(category)) {
      groups.push({ category, badges: list })
      placed.add(category)
    }
  }
  for (const [category, list] of byCategory) {
    if (!placed.has(category)) groups.push({ category, badges: list })
  }
  return groups
}

export function isRareBadge(badge: BadgeDef, rarityThreshold: number): boolean {
  return badge.rarity !== undefined && badge.rarity < rarityThreshold
}

export function transparentBadgeUrl(url: string): string {
  const resolved = resolveAssetUrl(url)
  return resolved.includes("?") ? `${resolved}&bg=none` : `${resolved}?bg=none`
}

export function resolveBadgeImage(badge: BadgeDef, tier: number | undefined, variant: keyof BadgeImage): string {
  if (tier !== undefined && badge.tiers && badge.tiers.length > 0) {
    const tierImage = badge.tiers[tier - 1]?.image
    if (tierImage && tierImage[variant]) return resolveAssetUrl(tierImage[variant])
  }
  return resolveAssetUrl(badge.image[variant])
}
