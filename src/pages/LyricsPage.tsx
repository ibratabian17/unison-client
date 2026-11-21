import { useSession } from "@/auth/useSession"
import { EditLyricModal } from "@/components/EditLyricModal"
import { EmptyState } from "@/components/EmptyState"
import { LinkedVideosModal } from "@/components/LinkedVideosModal"
import { LyricsPanel, LyricsToolsSkeleton } from "@/components/LyricsPanel"
import { LyricsContentSkeleton } from "@/components/LyricsRenderer"
import { usePageArt } from "@/components/PageArt"
import { RevisionHistoryModal } from "@/components/RevisionHistoryModal"
import { VariantList, VariantListSkeleton } from "@/components/VariantList"
import { VariantMetadata, VariantMetadataSkeleton } from "@/components/VariantMetadata"
import { VoteControls } from "@/components/VoteControls"
import { EditMetadataButton } from "@/components/council/EditMetadataButton"
import { SealLyricButton } from "@/components/council/SealLyricButton"
import { YouTubeMusicIcon } from "@/components/icons/YouTubeMusicIcon"
import { Bone } from "@/components/skeleton"
import { SongHero, SongHeroSkeleton } from "@/components/song/SongHero"
import { SongRail, SongRailSkeleton } from "@/components/song/SongRail"
import { SuggestEditButton, SuggestionWaitingLine } from "@/components/song/SuggestEditButton"
import {
  type PreviewView,
  SuggestionNotice,
  SuggestionPreviewBar,
  SuggestionRail,
  SuggestionRailFold,
} from "@/components/song/SuggestionPreview"
import { buttonClass } from "@/components/ui"
import { useUiMode } from "@/context/UiModeContext"
import { useCouncilRole } from "@/hooks/useCouncilData"
import { useFillHeight } from "@/hooks/useFillHeight"
import { useLyricsVariant, useLyricsVariants, useRevisionDetail, useRevisionDiff } from "@/hooks/useLyricsData"
import { usePageTitle } from "@/hooks/usePageTitle"
import { useActedOnSuggestion } from "@/hooks/useSuggestionMutations"
import { useSuggestionViewer } from "@/hooks/useSuggestionViewer"
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer"
import { type SongRankResponse, deleteLyrics, fetchSongRank, isNotFound, requestLyrics } from "@/lib/api"
import { songBackdrop, useArtworkCover } from "@/lib/artwork"
import { type SuggestionContent, contentOf, isOwnerless, jumpTargets, previewActions } from "@/lib/lyric-suggestion"
import { NOT_FOUND_TITLE, songTitle } from "@/lib/page-title"
import { syncTypeFor } from "@/lib/sync-type"
import { pushToast } from "@/lib/toast"
import type { VariantFull } from "@/lib/types"
import { fetchVideoMetadata } from "@/lib/video-metadata"
import { youTubeMusicUrl } from "@/lib/youtube-music"
import { IconPlus, IconTrash } from "@tabler/icons-react"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"

const PAGE =
  "grid grid-cols-[minmax(0,1fr)_340px] items-start gap-x-12 min-[1001px]:-mb-8 max-[1000px]:grid-cols-[minmax(0,1fr)] max-[1000px]:gap-y-7 max-[1000px]:pb-[88px]"
const STACKED_ONLY = "min-[1001px]:hidden"
const SIDE_BY_SIDE_ONLY = "max-[1000px]:hidden"
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
  const [requesting, setRequesting] = useState(false)
  const [requested, setRequested] = useState(false)
  const [songRank, setSongRank] = useState<SongRankResponse | null>(null)
  const session = useSession()
  const councilRole = useCouncilRole()
  const currentKeyId = session.status === "signed-in" ? session.identity.keyId : undefined
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const variantIdParam = params.get("variantId")
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

  const [toolsOverride, setToolsOverride] = useState<boolean | null>(null)
  const [toolsPlaying, setToolsPlaying] = useState(playing)
  if (toolsPlaying !== playing) {
    setToolsPlaying(playing)
    setToolsOverride(null)
  }
  const toolsOpen = toolsOverride ?? !playing
  const toggleTools = useCallback(() => setToolsOverride(!toolsOpen), [toolsOpen])

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

  const { data: art, isPending: artPending } = useArtworkCover(safeVideoId)
  const lead = variants[0]
  usePageTitle(lead ? songTitle(lead.song, lead.artist) : isNotFound(variantsQuery.error) ? NOT_FOUND_TITLE : null)
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

  const loaded = variantQuery.data?.variant
  const variant = loaded && variants.some((v) => v.id === loaded.id) ? loaded : undefined
  const settled = variant !== undefined && variant.id === selectedId && !variantQuery.isPlaceholderData
  const isOwner = Boolean(
    session.status === "signed-in" && variant?.submitter?.keyId && session.identity.keyId === variant.submitter.keyId,
  )

  const viewer = useSuggestionViewer()
  const suggestionParam = params.get("suggestion")
  const waiting = variant?.revision?.suggestion
  const previewing = settled && waiting && suggestionParam === String(waiting.id) ? waiting : undefined
  const detail = useRevisionDetail(variant?.id ?? 0, previewing?.id ?? 0, previewing !== undefined)
  const diff = useRevisionDiff(variant?.id ?? 0, previewing?.id ?? 0, previewing !== undefined)
  const [liveFor, setLiveFor] = useState<number | null>(null)
  const jumps = useMemo(() => (diff.data ? jumpTargets(diff.data.rows) : undefined), [diff.data])
  const jumpsFailed = diff.isError && !diff.isFetching
  const { refetch: refetchDiff } = diff

  const setSuggestionParam = useCallback(
    (id: number | null) => {
      const next = new URLSearchParams(params)
      if (id === null) next.delete("suggestion")
      else next.set("suggestion", String(id))
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const [checkedSince, setCheckedSince] = useState({ param: suggestionParam, at: Date.now() })
  if (checkedSince.param !== suggestionParam) setCheckedSince({ param: suggestionParam, at: Date.now() })
  const checkedFresh = variantQuery.dataUpdatedAt >= checkedSince.at
  const checkFailed = variantQuery.errorUpdatedAt >= checkedSince.at
  const { isFetching: variantFetching, refetch: refetchVariant } = variantQuery
  const recheck = suggestionParam !== null && settled && !previewing && !checkedFresh && !checkFailed
  useEffect(() => {
    if (recheck && !variantFetching) refetchVariant()
  }, [recheck, variantFetching, refetchVariant])

  const lost = suggestionParam !== null && settled && !previewing && checkedFresh
  const actedHere = useActedOnSuggestion(suggestionParam === null ? undefined : Number(suggestionParam))
  useEffect(() => {
    if (!lost) return
    if (!actedHere) {
      pushToast({ kind: "info", message: "That suggestion is no longer waiting", detail: "Showing the live version." })
    }
    setSuggestionParam(null)
  }, [lost, actedHere, setSuggestionParam])

  const content = contentOf(detail)
  const loadFailed = previewing !== undefined && content === "failed"
  const view: PreviewView = previewing && liveFor !== previewing.id && !loadFailed ? "suggestion" : "live"
  useEffect(() => {
    if (!loadFailed) return
    pushToast({
      kind: "error",
      message: "Could not load that suggestion",
      detail: "Check your connection and try again.",
    })
  }, [loadFailed])

  const shown = useMemo((): VariantFull | undefined => {
    if (!variant || !previewing || view === "live") return variant
    return detail.data ? { ...variant, lyrics: detail.data.lyrics, format: detail.data.format } : undefined
  }, [variant, previewing, view, detail.data])

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
    return isNew ? <LyricsPageSkeleton lyricsRef={lyricsRef} /> : <ClassicLyricsPageSkeleton />
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
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Link to={`/submit?videoId=${encodeURIComponent(safeVideoId)}`} className={buttonClass("primary", "md")}>
            <IconPlus className="size-4" />
            <span>Submit lyrics</span>
          </Link>
          {session.status === "signed-in" ? (
            <button
              type="button"
              disabled={requesting || requested}
              onClick={async () => {
                try {
                  setRequesting(true)
                  const meta = await fetchVideoMetadata(safeVideoId).catch(() => null)
                  const res = await requestLyrics({
                    videoId: safeVideoId,
                    song: meta?.song || safeVideoId,
                    artist: meta?.artist || "Unknown Artist",
                    thumbnailUrl: meta?.thumbnailUrl || `https://i.ytimg.com/vi/${safeVideoId}/hqdefault.jpg`,
                  })
                  setRequested(true)
                  pushToast({
                    kind: "success",
                    message:
                      res.status === "already_requested"
                        ? `Already requested (${res.requestCount ?? 1} requests)`
                        : "Lyrics requested — added to Most Wanted",
                  })
                } catch (err) {
                  pushToast({
                    kind: "error",
                    message: err instanceof Error ? err.message : "Could not request lyrics",
                  })
                } finally {
                  setRequesting(false)
                }
              }}
              className={buttonClass("fill", "md")}
            >
              <span>{requested ? "Requested" : requesting ? "Requesting…" : "Request lyrics"}</span>
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  const now = Math.floor(Date.now() / 1000)
  const lyric = variant && {
    lyricsId: variant.id,
    videoId: variant.videoId,
    song: variant.song,
    artist: variant.artist,
  }
  const actionsFor = (suggestion: NonNullable<typeof waiting>, shownContent: SuggestionContent) =>
    previewActions(viewer, { submitterKeyId: variant?.submitter?.keyId ?? null, suggestion, content: shownContent })
  const unsynced = variant !== undefined && syncTypeFor(variant.syncType, variant.format) === "unsynced"
  const ownerSees = waiting && viewer && viewer.keyId === variant?.submitter?.keyId ? waiting : undefined

  const modals = variant ? (
    <div key={variant.id}>
      <EditLyricModal
        key={`edit-${variant.id}-${editOpen ? "open" : "closed"}`}
        variant={variant}
        mode="owner"
        currentKeyId={currentKeyId}
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
        currentKeyId={currentKeyId}
        isCouncil={councilRole !== null}
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
        {previewing && lyric && variant ? (
          <div className="t-reveal">
            <SuggestionPreviewBar
              item={{ ...lyric, suggestion: previewing }}
              liveRevNo={variant.revision?.revNo ?? 1}
              actionsFor={(shownContent) => actionsFor(previewing, shownContent)}
              content={content}
              ownerless={isOwnerless(variant.submitter?.keyId)}
              view={view}
              onView={(next) => setLiveFor(next === "live" ? previewing.id : null)}
              onDone={() => setSuggestionParam(null)}
              now={now}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="cursor-pointer text-xs text-unison-text-muted transition-colors hover:text-unison-text"
          >
            ‹ back
          </button>
          {variant && selectedId !== undefined ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <SuggestEditButton variant={variant} />
              <EditMetadataButton
                videoId={safeVideoId}
                lyricsId={variant.id}
                current={{ song: variant.song, artist: variant.artist, album: variant.album ?? null }}
              />
              <SealLyricButton videoId={safeVideoId} lyricsId={variant.id} />
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

        {variant ? <SuggestionWaitingLine variant={variant} /> : null}

        <div className="grid gap-6 sm:grid-cols-[minmax(0,384px)_minmax(0,1fr)]">
          <div className="space-y-4">
            {ownerSees && settled && !previewing ? (
              <SuggestionNotice
                suggestion={ownerSees}
                actions={actionsFor(ownerSees, "loaded")}
                now={now}
                onPreview={() => setSuggestionParam(ownerSees.id)}
              />
            ) : null}
            {variant ? (
              <VariantMetadata
                variant={variant}
                playerRef={ref}
                playerActive={playerActive}
                onActivatePlayer={activatePlayer}
                onOpenHistory={() => setHistoryOpen(true)}
                onOpenVideos={() => setVideosOpen(true)}
                onOpenEdit={isOwner ? () => setEditOpen(true) : undefined}
                currentKeyId={currentKeyId}
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
              variant={variantQuery.isLoading ? undefined : shown}
              contentKey={previewing ? view : undefined}
              fileTools={view === "live" || !previewing}
              getCurrentTime={getCurrentTime}
              getPlaying={getPlaying}
              onLineClick={handleLineClick}
            />
            <VariantList variants={variants} selectedId={selectedId ?? -1} onSelect={handleSelect} />
          </div>
        </div>
        {modals}
      </div>
    )
  }

  let railTop = null
  if (previewing) {
    railTop = (
      <SuggestionRail
        suggestion={previewing}
        jumps={jumps}
        jumpsFailed={jumpsFailed}
        onRetryJumps={() => refetchDiff()}
        onJump={(jump) => handleLineClick(jump.seekSeconds)}
        unsynced={unsynced}
        className={SIDE_BY_SIDE_ONLY}
      />
    )
  } else if (ownerSees && settled) {
    railTop = (
      <SuggestionNotice
        suggestion={ownerSees}
        actions={actionsFor(ownerSees, "loaded")}
        now={now}
        onPreview={() => setSuggestionParam(ownerSees.id)}
      />
    )
  }

  return (
    <div className={PAGE}>
      {previewing && lyric && variant ? (
        <div className="t-reveal col-span-full mb-6">
          <SuggestionPreviewBar
            item={{ ...lyric, suggestion: previewing }}
            liveRevNo={variant.revision?.revNo ?? 1}
            actionsFor={(shownContent) => actionsFor(previewing, shownContent)}
            content={content}
            ownerless={isOwnerless(variant.submitter?.keyId)}
            view={view}
            onView={(next) => setLiveFor(next === "live" ? previewing.id : null)}
            onDone={() => setSuggestionParam(null)}
            now={now}
          />
          <SuggestionRailFold
            suggestion={previewing}
            jumps={jumps}
            jumpsFailed={jumpsFailed}
            onRetryJumps={() => refetchDiff()}
            onJump={(jump) => handleLineClick(jump.seekSeconds)}
            unsynced={unsynced}
            className={STACKED_ONLY}
          />
        </div>
      ) : null}
      <div className="min-w-0">
        {variant ? (
          <SongHero
            variant={variant}
            versions={variants.length}
            art={art}
            player={{ ref, active: playerActive, playing, ready, failed, onToggle: togglePlay }}
            lyricsTools={{ open: toolsOpen, onToggle: toggleTools }}
            onDelete={isOwner ? handleDelete : undefined}
            deleting={deleting}
          />
        ) : (
          <SongHeroSkeleton title={lead?.song} />
        )}
        <div ref={lyricsRef} className="lyrics-view">
          <LyricsPanel
            variant={variantQuery.isLoading ? undefined : shown}
            contentKey={previewing ? view : undefined}
            fileTools={view === "live" || !previewing}
            getCurrentTime={getCurrentTime}
            getPlaying={getPlaying}
            toolsOpen={toolsOpen}
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
        top={railTop}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenVideos={() => setVideosOpen(true)}
        onOpenEdit={isOwner ? () => setEditOpen(true) : undefined}
        isOwner={isOwner}
      />
      {modals}
    </div>
  )
}

function LyricsPageSkeleton({ lyricsRef }: { lyricsRef: (node: HTMLElement | null) => void }) {
  return (
    <div className={PAGE}>
      <div className="min-w-0">
        <SongHeroSkeleton />
        <div ref={lyricsRef} className="lyrics-view">
          <LyricsToolsSkeleton />
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
        <VariantMetadataSkeleton />
        <div className="space-y-4">
          <LyricsContentSkeleton className="h-[520px]" />
          <VariantListSkeleton />
        </div>
      </div>
    </div>
  )
}
