import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"
import { useLocation, useNavigate, useParams, useSearchParams, Link } from "react-router-dom"
import { useSession } from "@/auth/useSession"
import { CopyButton } from "@/components/CopyButton"
import { DownloadButton } from "@/components/DownloadButton"
import { EmptyState } from "@/components/EmptyState"
import { LyricsContentSkeleton, LyricsRenderer } from "@/components/LyricsRenderer"
import { RawLyricsView } from "@/components/RawLyricsView"
import { ReportModal } from "@/components/ReportModal"
import { Bone } from "@/components/skeleton"
import { VariantList, VariantListSkeleton } from "@/components/VariantList"
import { VariantMetadata, VariantMetadataSkeleton } from "@/components/VariantMetadata"
import { VoteControls } from "@/components/VoteControls"
import { YouTubeMusicIcon } from "@/components/icons/YouTubeMusicIcon"
import { IconFlag, IconLanguage, IconTrash, IconPlus, IconBrandYoutube, IconEdit, IconHistory } from "@tabler/icons-react"
import { EditLyricModal } from "@/components/EditLyricModal"
import { RevisionHistoryModal } from "@/components/RevisionHistoryModal"
import { LinkedVideosModal } from "@/components/LinkedVideosModal"
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer"
import { cn } from "@/lib/cn"
import { fetchLyricsVariant, fetchLyricsVariants, deleteLyrics } from "@/lib/api"
import { downloadTextFile } from "@/lib/download"
import { lyricsFilename, MIME_BY_FORMAT } from "@/lib/lyrics-download"

type Mode = "synced" | "raw"

const HEADER_ACTION_CLASS =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-unison-border bg-unison-bg-elevated px-2 py-1 text-xs text-unison-text-secondary transition-colors hover:border-unison-border-strong hover:bg-unison-bg-hover hover:text-unison-text"

export function LyricsPage() {
  const { videoId } = useParams<{ videoId: string }>()
  const [params, setParams] = useSearchParams()
  const [mode, setMode] = useState<Mode>("synced")
  const [playerActive, setPlayerActive] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [videosOpen, setVideosOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const session = useSession()
  const queryClient = useQueryClient()
  const variantIdParam = params.get("variantId")
  const navigate = useNavigate()
  const location = useLocation()

  const handleBack = useCallback(() => {
    if (location.key === "default") navigate("/")
    else navigate(-1)
  }, [location.key, navigate])

  const safeVideoId = videoId ?? ""
  const { ref, getCurrentTime, getPlaying, seekTo, play } = useYouTubePlayer(
    safeVideoId.length > 0 ? safeVideoId : null,
    { playerVars: { autoplay: 1 } },
  )

  const [playerVideoId, setPlayerVideoId] = useState(safeVideoId)
  if (safeVideoId !== playerVideoId) {
    setPlayerVideoId(safeVideoId)
    setPlayerActive(false)
  }

  const activatePlayer = useCallback(() => setPlayerActive(true), [])

  const variantsQuery = useQuery({
    queryKey: ["lyrics", "variants", safeVideoId],
    queryFn: ({ signal }) => fetchLyricsVariants(safeVideoId, { signal }),
    enabled: safeVideoId.length > 0,
    staleTime: 30_000,
  })

  const variants = useMemo(() => variantsQuery.data?.variants ?? [], [variantsQuery.data])
  const requestedId = variantIdParam !== null ? Number(variantIdParam) : null
  const selectedId = useMemo(() => {
    if (requestedId !== null && variants.some((v) => v.id === requestedId)) return requestedId
    return variants[0]?.id
  }, [requestedId, variants])

  const variantQuery = useQuery({
    queryKey: ["lyrics", "variant", selectedId],
    queryFn: ({ signal }) => {
      if (selectedId === undefined) throw new Error("no variant selected")
      return fetchLyricsVariant(selectedId, { signal })
    },
    enabled: selectedId !== undefined,
    staleTime: 30_000,
  })

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

  const handleDownload = useCallback(() => {
    const v = variantQuery.data?.variant
    if (!v) return
    downloadTextFile(lyricsFilename(v), v.lyrics, MIME_BY_FORMAT[v.format])
  }, [variantQuery.data])

  const handleDelete = async () => {
    const v = variantQuery.data?.variant
    if (!v) return
    if (!window.confirm(`Are you sure you want to delete this lyrics entry for "${v.song}"?`)) return
    try {
      setDeleting(true)
      await deleteLyrics(v.id)
      await queryClient.invalidateQueries({ queryKey: ["lyrics", "variants", safeVideoId] })
      navigate("/feed")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete submission")
    } finally {
      setDeleting(false)
    }
  }

  if (!videoId) return <EmptyState title="No video specified" />

  if (variantsQuery.isLoading) return <LyricsPageSkeleton />
  if (variantsQuery.isError) {
    const message = variantsQuery.error instanceof Error ? variantsQuery.error.message : "Unknown error"
    return <EmptyState title="Could not load lyrics" hint={message} />
  }
  if (variants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <EmptyState title="No lyrics yet" hint="Be the first to submit synchronized lyrics for this song!" />
        <Link
          to={`/submit?videoId=${encodeURIComponent(safeVideoId)}`}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-red-500 transition-colors"
        >
          <IconPlus className="size-4" />
          <span>Submit Lyrics</span>
        </Link>
      </div>
    )
  }

  const variant = variantQuery.data?.variant
  const isOwner =
    session.status === "signed-in" &&
    variant?.submitter?.keyId &&
    session.identity.keyId === variant.submitter.keyId

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
          <VoteControls
            variantId={variant.id}
            videoId={safeVideoId}
            variant={{ score: variant.score, userVote: variant.userVote ?? null }}
          />
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
              isOwner={Boolean(isOwner)}
            />
          ) : (
            <VariantMetadataSkeleton />
          )}
          <a
            href={`https://music.youtube.com/watch?v=${safeVideoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-[10px] bg-white/[0.08] px-4 py-3 text-[13px] font-semibold text-unison-text shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.07)] transition-colors hover:bg-white/[0.12] active:translate-y-px"
          >
            <YouTubeMusicIcon className="size-[18px]" />
            Open on YouTube Music
          </a>
        </div>
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-unison-border bg-unison-bg-elevated">
            <div className="flex items-center justify-between border-b border-unison-border/60 px-3 py-2">
              <fieldset className="inline-flex rounded-md border border-unison-border bg-unison-bg p-0.5">
                <legend className="sr-only">Lyrics display mode</legend>
                <button
                  type="button"
                  onClick={() => setMode("synced")}
                  className={cn(
                    "cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors",
                    mode === "synced"
                      ? "bg-unison-bg-hover text-unison-text"
                      : "text-unison-text-muted hover:text-unison-text",
                  )}
                >
                  Synced
                </button>
                <button
                  type="button"
                  onClick={() => setMode("raw")}
                  className={cn(
                    "cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors",
                    mode === "raw"
                      ? "bg-unison-bg-hover text-unison-text"
                      : "text-unison-text-muted hover:text-unison-text",
                  )}
                >
                  Raw
                </button>
              </fieldset>
              {variant ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/translate?lyrics=${encodeURIComponent(variant.lyrics)}`, {
                        state: { lyrics: variant.lyrics },
                      })
                    }
                    className={HEADER_ACTION_CLASS}
                    title="Translate in Unison Translator"
                  >
                    <IconLanguage className="size-3.5 text-unison-text-secondary" />
                    <span>Translate</span>
                  </button>
                  <DownloadButton
                    onClick={handleDownload}
                    className={HEADER_ACTION_CLASS}
                    iconClassName="size-3.5"
                    withText
                  />
                  <CopyButton text={variant.lyrics} className={HEADER_ACTION_CLASS} iconClassName="size-3.5" withText />
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    className={HEADER_ACTION_CLASS}
                    title="Report wrong lyrics or bad sync"
                  >
                    <IconFlag className="size-3.5 text-unison-text-secondary" />
                    <span>Report</span>
                  </button>
                  {isOwner && (
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={handleDelete}
                      className={cn(
                        HEADER_ACTION_CLASS,
                        "hover:text-red-400 hover:border-red-500/40 text-red-400/80 cursor-pointer",
                      )}
                      title="Delete your submission"
                    >
                      <IconTrash className="size-3.5" />
                      <span>{deleting ? "Deleting..." : "Delete"}</span>
                    </button>
                  )}
                </div>
              ) : null}
            </div>
            <div className="p-4">
              {variantQuery.isLoading || !variant ? (
                <LyricsContentSkeleton />
              ) : mode === "synced" ? (
                <LyricsRenderer
                  variant={variant}
                  getCurrentTime={getCurrentTime}
                  getPlaying={getPlaying}
                  onLineClick={handleLineClick}
                />
              ) : (
                <RawLyricsView body={variant.lyrics} format={variant.format} />
              )}
            </div>
          </div>
          <VariantList variants={variants} selectedId={selectedId ?? -1} onSelect={handleSelect} />
        </div>
      </div>

      {variant && (
        <>
          <EditLyricModal
            variant={variant}
            isOpen={editOpen}
            onClose={() => setEditOpen(false)}
            onSaved={() => {
              void queryClient.invalidateQueries({ queryKey: ["lyrics", "variants", safeVideoId] })
              void queryClient.invalidateQueries({ queryKey: ["lyrics", "variant", selectedId] })
            }}
          />
          <RevisionHistoryModal
            variant={variant}
            isOwner={Boolean(isOwner)}
            isOpen={historyOpen}
            onClose={() => setHistoryOpen(false)}
            onReverted={() => {
              void queryClient.invalidateQueries({ queryKey: ["lyrics", "variants", safeVideoId] })
              void queryClient.invalidateQueries({ queryKey: ["lyrics", "variant", selectedId] })
            }}
          />
          <LinkedVideosModal
            variant={variant}
            isOwner={Boolean(isOwner)}
            isOpen={videosOpen}
            onClose={() => setVideosOpen(false)}
            onUpdated={() => {
              void queryClient.invalidateQueries({ queryKey: ["lyrics", "variants", safeVideoId] })
            }}
          />
          <ReportModal
            variantId={variant.id}
            songTitle={variant.song}
            isOpen={reportOpen}
            onClose={() => setReportOpen(false)}
          />
        </>
      )}
    </div>
  )
}

function LyricsPageSkeleton() {
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
