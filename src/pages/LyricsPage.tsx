import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useSession } from "@/auth/useSession"
import { EditLyricModal } from "@/components/EditLyricModal"
import { EmptyState } from "@/components/EmptyState"
import { LinkedVideosModal } from "@/components/LinkedVideosModal"
import { LyricsPanel } from "@/components/LyricsPanel"
import { LyricsContentSkeleton } from "@/components/LyricsRenderer"
import { usePageArt } from "@/components/PageArt"
import { RevisionHistoryModal } from "@/components/RevisionHistoryModal"
import { VariantList, VariantListSkeleton } from "@/components/VariantList"
import { VariantMetadata, VariantMetadataSkeleton } from "@/components/VariantMetadata"
import { VoteControls } from "@/components/VoteControls"
import { BoostLyricButton } from "@/components/council/BoostLyricButton"
import { EditMetadataButton } from "@/components/council/EditMetadataButton"
import { SealLyricButton } from "@/components/council/SealLyricButton"
import { YouTubeMusicIcon } from "@/components/icons/YouTubeMusicIcon"
import { Bone } from "@/components/skeleton"
import { SongHero, SongHeroSkeleton } from "@/components/song/SongHero"
import { SongRail, SongRailSkeleton } from "@/components/song/SongRail"
import { buttonClass } from "@/components/ui"
import { useUiMode } from "@/context/UiModeContext"
import { useFillHeight } from "@/hooks/useFillHeight"
import { useLyricsVariant, useLyricsVariants } from "@/hooks/useLyricsData"
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer"
import { deleteLyrics, fetchSongRank, type SongRankResponse } from "@/lib/api"
import { songBackdrop, useArtwork } from "@/lib/artwork"
import { pushToast } from "@/lib/toast"
import { youTubeMusicUrl } from "@/lib/youtube-music"
import { IconPlus, IconTrash } from "@tabler/icons-react"

const NEW_PAGE =
  "grid grid-cols-[minmax(0,1fr)_340px] items-start gap-x-12 min-[1001px]:-mb-8 max-[1000px]:grid-cols-[minmax(0,1fr)] max-[1000px]:gap-y-7 max-[1000px]:pb-[88px]"
const LYRICS_FILL = "lyrics-fill"
const LYRICS_SIZE = `${LYRICS_FILL} h-[max(var(--fill-height,560px),240px)] max-w-none max-[1000px]:h-[70dvh]`

export function LyricsPage() {
  const { uiMode } = useUiMode()
  const isNew = uiMode === "new"
  const { videoId } = useParams<{ videoId: string }>()
  const [params, setParams] = useSearchParams()
  const [playerActive, setPlayerActive] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [videosOpen, setVideosOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmingClassicDelete, setConfirmingClassicDelete] = useState(false)
  const [songRank, setSongRank] = useState<SongRankResponse | null>(null)
  const session = useSession()
  const queryClient = useQueryClient()
  const variantIdParam = params.get("variantId")
  const navigate = useNavigate()
  const location = useLocation()
  const lyricsRef = useFillHeight(`.${LYRICS_FILL}`)

  const handleBack = useCallback(() => {
    if (location.key === "default") navigate("/")
    else navigate(-1)
  }, [location.key, navigate])

  const safeVideoId = videoId ?? ""
  const { ref, getCurrentTime, getPlaying, playing, ready, failed, seekTo, play, pause } = useYouTubePlayer(
    safeVideoId.length > 0 ? safeVideoId : null,
    {
      playerVars: isNew
        ? { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, rel: 0, playsinline: 1 }
        : { autoplay: 1 },
    },
  )

  const [playerVideoId, setPlayerVideoId] = useState(safeVideoId)
  if (safeVideoId !== playerVideoId) {
    setPlayerVideoId(safeVideoId)
    setPlayerActive(false)
  }

  const activatePlayer = useCallback(() => setPlayerActive(true), [])
  const togglePlay = useCallback(() => {
    if (!playerActive) setPlayerActive(true)
    else if (getPlaying()) pause()
    else play()
  }, [playerActive, getPlaying, pause, play])

  const variantsQuery = useLyricsVariants(safeVideoId)

  const variants = useMemo(() => variantsQuery.data?.variants ?? [], [variantsQuery.data])

  useEffect(() => {
    if (variantsQuery.isSuccess && variants.length === 0 && safeVideoId) {
      let cancelled = false
      fetchSongRank(safeVideoId).then((res) => {
        if (!cancelled && res.ranked) setSongRank(res)
      })
      return () => {
        cancelled = true
      }
    }
  }, [variantsQuery.isSuccess, variants.length, safeVideoId])

  useEffect(() => {
    if (!confirmingClassicDelete) return
    const timer = window.setTimeout(() => setConfirmingClassicDelete(false), 4000)
    return () => window.clearTimeout(timer)
  }, [confirmingClassicDelete])

  const requestedId = variantIdParam !== null ? Number(variantIdParam) : null
  const selectedId = useMemo(() => {
    if (requestedId !== null && variants.some((v) => v.id === requestedId)) return requestedId
    return variants[0]?.id
  }, [requestedId, variants])

  const variantQuery = useLyricsVariant(selectedId)

  const { data: art, isPending: artPending } = useArtwork(safeVideoId)
  const lead = variants[0]
  const backdrop = useMemo(
    () => (artPending || !lead ? null : songBackdrop(safeVideoId, Boolean(art), lead.song, lead.artist)),
    [artPending, lead, art, safeVideoId],
  )
  usePageArt(backdrop, playing)

  const handleSelect = useCallback(
    (id: number) => {
      const next = new URLSearchParams(params)
      next.set("variantId", String(id))
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const handleLineClick = useCallback(
    (seconds: number) => {
      setPlayerActive(true)
      seekTo(seconds)
      play()
    },
    [seekTo, play],
  )

  const handleDelete = async () => {
    const v = variantQuery.data?.variant
    if (!v) return
    try {
      setDeleting(true)
      await deleteLyrics(v.id)
      await queryClient.invalidateQueries({ queryKey: ["lyrics", "variants", safeVideoId] })
      pushToast({ kind: "success", message: "Deleted lyric submission" })
      navigate("/feed")
    } catch (err) {
      pushToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to delete submission",
      })
    } finally {
      setDeleting(false)
    }
  }

  if (!videoId) return <EmptyState title="No video specified" />

  if (variantsQuery.isLoading) {
    return isNew ? <NewLyricsPageSkeleton lyricsRef={lyricsRef} /> : <ClassicLyricsPageSkeleton />
  }
  if (variantsQuery.isError) {
    const message = variantsQuery.error instanceof Error ? variantsQuery.error.message : "Unknown error"
    return <EmptyState title="Could not load lyrics" hint={message} />
  }
  if (variants.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center space-y-4 py-16 text-center">
        <EmptyState
          title="No lyrics yet"
          hint={
            songRank?.ranked
              ? `This song is ranked #${songRank.rank} on the Most Wanted board with ${songRank.requestCount} requests (${songRank.demand?.toFixed(1)} demand). Be the first to submit lyrics!`
              : "Be the first to submit synchronized lyrics for this song!"
          }
        />
        <Link to={`/submit?videoId=${encodeURIComponent(safeVideoId)}`} className={buttonClass("primary", "md")}>
          <IconPlus className="size-4" />
          <span>Submit lyrics</span>
        </Link>
      </div>
    )
  }

  const loaded = variantQuery.data?.variant
  const variant = loaded && variants.some((v) => v.id === loaded.id) ? loaded : undefined
  const isOwner = Boolean(
    session.status === "signed-in" && variant?.submitter?.keyId && session.identity.keyId === variant.submitter.keyId,
  )

  const modals = variant ? (
    <div key={variant.id}>
      <EditLyricModal
        key={`edit-${variant.id}`}
        variant={variant}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(newVariantId) => {
          if (newVariantId !== undefined && newVariantId > 0) {
            handleSelect(newVariantId)
          }
          void queryClient.invalidateQueries({ queryKey: ["lyrics", "variants", safeVideoId] })
          void queryClient.invalidateQueries({ queryKey: ["lyrics", "variant", newVariantId ?? selectedId] })
        }}
      />
      <RevisionHistoryModal
        variant={variant}
        isOwner={isOwner}
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onReverted={() => {
          void queryClient.invalidateQueries({ queryKey: ["lyrics", "variants", safeVideoId] })
          void queryClient.invalidateQueries({ queryKey: ["lyrics", "variant", selectedId] })
        }}
      />
      <LinkedVideosModal
        variant={variant}
        isOwner={isOwner}
        isOpen={videosOpen}
        onClose={() => setVideosOpen(false)}
        onUpdated={() => {
          void queryClient.invalidateQueries({ queryKey: ["lyrics", "variants", safeVideoId] })
        }}
      />
    </div>
  ) : null

  if (!isNew) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="cursor-pointer text-xs text-unison-text-muted transition-colors hover:text-unison-text"
          >
            ‹ back
          </button>
          {variant && selectedId !== undefined ? (
            <div className="flex items-center gap-3">
              <EditMetadataButton
                videoId={safeVideoId}
                lyricsId={variant.id}
                current={{ song: variant.song, artist: variant.artist, album: variant.album ?? null }}
              />
              <SealLyricButton videoId={safeVideoId} lyricsId={variant.id} />
              <BoostLyricButton lyricsId={variant.id} />
              <VoteControls
                variantId={variant.id}
                videoId={safeVideoId}
                variant={{ score: variant.score, userVote: variant.userVote ?? null }}
              />
            </div>
          ) : (
            <Bone className="h-9 w-28 rounded-lg" />
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-[minmax(0,384px)_minmax(0,1fr)]">
          <div className="space-y-4">
            {variant ? (
              <VariantMetadata
                variant={variant}
                playerRef={ref}
                playerActive={playerActive}
                onActivatePlayer={activatePlayer}
                onOpenHistory={() => setHistoryOpen(true)}
                onOpenVideos={() => setVideosOpen(true)}
                onOpenEdit={isOwner ? () => setEditOpen(true) : undefined}
                isOwner={isOwner}
              />
            ) : (
              <VariantMetadataSkeleton />
            )}

            <div className="flex flex-col gap-2">
              <a
                href={youTubeMusicUrl(safeVideoId)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-[10px] bg-white/[0.08] px-4 py-3 text-[13px] font-semibold text-unison-text shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.07)] transition-colors hover:bg-white/[0.12] active:translate-y-px"
              >
                <YouTubeMusicIcon className="size-[18px]" />
                Open on YouTube Music
              </a>

              {variant && isOwner ? (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => {
                      if (!confirmingClassicDelete) {
                        setConfirmingClassicDelete(true)
                        return
                      }
                      setConfirmingClassicDelete(false)
                      void handleDelete()
                    }}
                    className={buttonClass("danger", "sm")}
                  >
                    <IconTrash className="size-3.5" />
                    <span>{deleting ? "Deleting…" : confirmingClassicDelete ? "Confirm delete" : "Delete"}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <LyricsPanel
              variant={variantQuery.isLoading ? undefined : variant}
              getCurrentTime={getCurrentTime}
              getPlaying={getPlaying}
              playing={playing}
              onLineClick={handleLineClick}
            />
            <VariantList variants={variants} selectedId={selectedId ?? -1} onSelect={handleSelect} />
          </div>
        </div>
        {modals}
      </div>
    )
  }

  return (
    <div className={NEW_PAGE}>
      <div className="min-w-0">
        {variant ? (
          <SongHero
            variant={variant}
            versions={variants.length}
            art={art}
            player={{ ref, active: playerActive, playing, ready, failed, onToggle: togglePlay }}
            onDelete={isOwner ? handleDelete : undefined}
            deleting={deleting}
          />
        ) : (
          <SongHeroSkeleton />
        )}
        <div ref={lyricsRef} className="lyrics-view">
          <LyricsPanel
            variant={variantQuery.isLoading ? undefined : variant}
            getCurrentTime={getCurrentTime}
            getPlaying={getPlaying}
            playing={playing}
            onLineClick={handleLineClick}
            lyricsClassName={LYRICS_SIZE}
          />
        </div>
      </div>
      <SongRail
        variant={variant}
        variants={variants}
        selectedId={selectedId ?? -1}
        onSelect={handleSelect}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenVideos={() => setVideosOpen(true)}
        onOpenEdit={isOwner ? () => setEditOpen(true) : undefined}
        isOwner={isOwner}
      />
      {modals}
    </div>
  )
}

function NewLyricsPageSkeleton({ lyricsRef }: { lyricsRef: (node: HTMLElement | null) => void }) {
  return (
    <div className={NEW_PAGE}>
      <div className="min-w-0">
        <SongHeroSkeleton />
        <div ref={lyricsRef} className="lyrics-view">
          <LyricsContentSkeleton className={LYRICS_SIZE} />
        </div>
      </div>
      <SongRailSkeleton />
    </div>
  )
}

function ClassicLyricsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Bone className="h-4 w-12" />
        <Bone className="h-9 w-28 rounded-lg" />
      </div>
      <div className="grid gap-6 sm:grid-cols-[minmax(0,384px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <VariantMetadataSkeleton />
          <Bone className="h-11 w-full rounded-[10px]" />
        </div>
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-unison-border bg-unison-bg-elevated">
            <div className="flex items-center justify-between border-b border-unison-border/60 px-3 py-2">
              <Bone className="h-8 w-32 rounded-md" />
              <Bone className="h-7 w-36 rounded-md" />
            </div>
            <div className="p-4">
              <LyricsContentSkeleton />
            </div>
          </div>
          <VariantListSkeleton rows={4} />
        </div>
      </div>
    </div>
  )
}
