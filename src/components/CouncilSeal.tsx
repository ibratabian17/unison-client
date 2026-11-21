import { resolveAssetUrl } from "@/lib/badge-view"
import { BadgeArt } from "@/components/BadgeArt"
import { useBadgeArt } from "@/hooks/useBadgeImage"

const SEAL_KEY = "committee"
const SEAL_IMAGE = "/badges/committee/image.svg?variant=color"

export function CouncilSeal({ className }: { className?: string }) {
  const art = useBadgeArt()(SEAL_KEY)
  return <BadgeArt src={art?.src ?? resolveAssetUrl(SEAL_IMAGE)} silhouette={art?.silhouette ?? null} className={className} />
}
