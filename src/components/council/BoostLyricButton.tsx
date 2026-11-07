import { useEffect, useState } from "react"
import { useSession } from "@/auth/useSession"
import { chipClass, chipIconClass, raisedChipClass } from "@/components/ui"
import { boostVariant, fetchBoostQuota, unboostVariant, type BoostQuota } from "@/lib/api"
import { cn } from "@/lib/cn"
import { IconFlame, IconLoader2 } from "@tabler/icons-react"

export function BoostLyricButton({ lyricsId }: { lyricsId: number }) {
  const session = useSession()
  const isCouncil = session.status === "signed-in" && Boolean(session.identity.council)
  const [quota, setQuota] = useState<BoostQuota | null>(null)
  const [boosted, setBoosted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isCouncil) return
    let cancelled = false
    fetchBoostQuota().then((q) => {
      if (!cancelled && q) setQuota(q)
    })
    return () => {
      cancelled = true
    }
  }, [isCouncil, lyricsId])

  if (!isCouncil) return null

  const handleToggleBoost = async () => {
    try {
      setLoading(true)
      setError(null)
      if (boosted) {
        await unboostVariant(lyricsId)
        setBoosted(false)
      } else {
        const res = await boostVariant(lyricsId)
        setBoosted(true)
        if (res.quota) setQuota(res.quota)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Boost failed")
    } finally {
      setLoading(false)
    }
  }

  const remaining = quota ? Math.max(0, quota.total - quota.used) : undefined

  return (
    <button
      type="button"
      disabled={loading || (!boosted && remaining === 0)}
      onClick={handleToggleBoost}
      className={cn(
        boosted ? raisedChipClass : chipClass,
        boosted && "text-amber-300 font-bold",
      )}
      title={
        boosted
          ? "Click to revoke Council Boost"
          : remaining !== undefined
            ? `Boost this lyric (${remaining} quota remaining)`
            : "Boost this lyric"
      }
    >
      {loading ? (
        <IconLoader2 className={cn(chipIconClass, "animate-spin")} />
      ) : (
        <IconFlame aria-hidden className={cn(chipIconClass, "text-amber-400")} stroke={1.75} />
      )}
      <span>{boosted ? "Boosted" : remaining !== undefined ? `Boost (${remaining})` : "Boost"}</span>
      {error ? <span className="sr-only">{error}</span> : null}
    </button>
  )
}
