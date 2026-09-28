import { useEffect, useRef, useState } from "react"
import {
  IconArrowBackUp,
  IconClock,
  IconGitCommit,
  IconLoader2,
  IconX,
} from "@tabler/icons-react"
import type { LyricRevision, RevisionDiff, VariantFull } from "@/lib/types"
import { fetchLyricRevisions, fetchRevisionDiff, revertLyricRevision } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import { UserAvatar } from "@/components/UserAvatar"
import { DiffView } from "@/components/council/DiffView"
import { cn } from "@/lib/cn"

interface RevisionHistoryModalProps {
  variant: VariantFull
  isOwner: boolean
  isOpen: boolean
  onClose: () => void
  onReverted: () => void
}

export function RevisionHistoryModal({
  variant,
  isOwner,
  isOpen,
  onClose,
  onReverted,
}: RevisionHistoryModalProps) {
  const [revisions, setRevisions] = useState<LyricRevision[]>([])
  const [selectedRevId, setSelectedRevId] = useState<number | null>(null)
  const [diff, setDiff] = useState<RevisionDiff | null>(null)
  const [loading, setLoading] = useState(false)
  const [diffLoading, setDiffLoading] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    if (isOpen) {
      document.addEventListener("keydown", onKey)
      closeRef.current?.focus()
    }
    return () => document.removeEventListener("keydown", onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setSelectedRevId(null)
    setDiff(null)

    fetchLyricRevisions(variant.id)
      .then((res) => {
        if (cancelled) return
        const list = res.revisions ?? []
        if (list.length === 0) {
          const initial: LyricRevision = {
            id: variant.id,
            lyricId: variant.id,
            version: 1,
            lyrics: variant.lyrics,
            format: variant.format ?? "lrc",
            language: variant.language,
            isrc: variant.isrc,
            status: "approved",
            createdAt: Math.floor(Date.now() / 1000),
            author: variant.submitter
              ? {
                  keyId: variant.submitter.keyId,
                  displayName: variant.submitter.displayName,
                  avatarUrl: variant.submitter.avatarUrl,
                }
              : undefined,
          }
          setRevisions([initial])
          setSelectedRevId(initial.id)
        } else {
          setRevisions(list)
          setSelectedRevId(list[0].id)
        }
      })
      .catch(() => {
        if (!cancelled) {
          const initial: LyricRevision = {
            id: variant.id,
            lyricId: variant.id,
            version: 1,
            lyrics: variant.lyrics,
            format: variant.format ?? "lrc",
            language: variant.language,
            isrc: variant.isrc,
            status: "approved",
            createdAt: Math.floor(Date.now() / 1000),
            author: variant.submitter
              ? {
                  keyId: variant.submitter.keyId,
                  displayName: variant.submitter.displayName,
                  avatarUrl: variant.submitter.avatarUrl,
                }
              : undefined,
          }
          setRevisions([initial])
          setSelectedRevId(initial.id)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, variant])

  useEffect(() => {
    if (!selectedRevId) {
      setDiff(null)
      return
    }
    let cancelled = false
    setDiffLoading(true)
    fetchRevisionDiff(variant.id, selectedRevId)
      .then((res) => {
        if (!cancelled) setDiff(res)
      })
      .catch(() => {
        if (!cancelled) setDiff(null)
      })
      .finally(() => {
        if (!cancelled) setDiffLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedRevId, variant.id])

  if (!isOpen) return null

  const handleRevert = async (revId: number) => {
    if (!window.confirm("Revert lyrics to this revision?")) return
    try {
      setReverting(true)
      setError(null)
      await revertLyricRevision(variant.id, revId)
      onReverted()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revert revision")
    } finally {
      setReverting(false)
    }
  }

  const selectedRev = revisions.find((r) => r.id === selectedRevId)
  const isLatest = revisions.length > 0 && selectedRevId === revisions[0].id

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Revision History"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,10,12,0.75)] p-4 backdrop-blur-[6px] animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative flex flex-col w-full max-w-4xl h-[580px] max-h-[90vh] overflow-hidden rounded-[18px] bg-[#111114] border border-unison-border-strong shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-unison-border/80 px-5 py-3.5 bg-[#141418]">
          <div className="min-w-0 pr-8">
            <h2 className="text-[15px] font-bold text-unison-text tracking-[-0.01em]">Revision History</h2>
            <div className="flex items-center gap-1.5 text-[12px] text-unison-text-muted truncate">
              <span className="text-unison-text-secondary truncate">{variant.song}</span>
              <span>·</span>
              <span className="truncate">{variant.artist}</span>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-[28px] cursor-pointer place-items-center rounded-[8px] bg-unison-surface text-unison-text-secondary transition-colors hover:bg-unison-bg-hover hover:text-unison-text"
          >
            <IconX className="size-[14px]" stroke={2} />
          </button>
        </div>

        {error && (
          <div className="m-3 rounded-[8px] bg-red-500/10 border border-red-500/20 px-3 py-2 text-[12px] text-red-400">
            {error}
          </div>
        )}

        {/* 2-Column Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: Revisions Timeline */}
          <div className="w-[260px] sm:w-[280px] border-r border-unison-border/70 flex flex-col shrink-0 bg-[#0d0d10]">
            <div className="px-3.5 py-2 border-b border-unison-border/40 text-[11px] font-semibold uppercase tracking-wider text-unison-text-muted">
              Revisions ({revisions.length})
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
              {loading ? (
                <div className="flex h-36 items-center justify-center text-unison-text-muted">
                  <IconLoader2 className="size-4 animate-spin" />
                </div>
              ) : revisions.length === 0 ? (
                <div className="flex h-36 flex-col items-center justify-center text-center p-4 text-unison-text-muted">
                  <IconGitCommit className="size-5 opacity-30 mb-1" />
                  <p className="text-[12px]">No prior revisions</p>
                </div>
              ) : (
                revisions.map((rev, idx) => {
                  const isSelected = rev.id === selectedRevId
                  const isCurrent = idx === 0
                  const revNum = rev.version ?? revisions.length - idx
                  const formatName = (rev.format || variant.format || "lrc").toUpperCase()

                  return (
                    <button
                      key={rev.id}
                      type="button"
                      onClick={() => setSelectedRevId(rev.id)}
                      className={cn(
                        "w-full text-left rounded-[9px] p-2.5 transition-colors cursor-pointer border",
                        isSelected
                          ? "bg-white/[0.08] border-unison-border-strong text-unison-text"
                          : "bg-transparent border-transparent hover:bg-white/[0.03] text-unison-text-secondary",
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-[12px] text-unison-text flex items-center gap-1.5">
                          <span>Revision #{revNum}</span>
                          {isCurrent && (
                            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-400 leading-none">
                              Current
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] text-unison-text-muted">
                          {formatRelativeTime(rev.createdAt || Math.floor(Date.now() / 1000))}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-unison-text-muted">
                        <div className="flex items-center gap-1.5 truncate min-w-0">
                          {rev.author?.avatarUrl ? (
                            <UserAvatar
                              avatarUrl={rev.author.avatarUrl}
                              keyId={rev.author.keyId}
                              className="size-3.5 rounded-full shrink-0"
                            />
                          ) : null}
                          <span className="truncate text-unison-text-secondary">
                            {rev.author?.displayName ?? "Contributor"}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-unison-text-muted shrink-0">
                          {formatName}
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right: Diff / Lyrics Inspector */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0e0e11]">
            {selectedRev ? (
              <div className="flex flex-col h-full overflow-hidden">
                {/* Inspector Header */}
                <div className="flex items-center justify-between border-b border-unison-border/70 px-4 py-2 bg-[#131317]">
                  <div className="flex items-center gap-2 text-[11.5px] text-unison-text-muted">
                    <span className="font-semibold text-unison-text">
                      {(selectedRev.format || variant.format || "lrc").toUpperCase()}
                    </span>
                    {(selectedRev.language || variant.language) && (
                      <>
                        <span>·</span>
                        <span>{(selectedRev.language || variant.language || "").toUpperCase()}</span>
                      </>
                    )}
                    {(selectedRev.album || variant.album) && (
                      <>
                        <span>·</span>
                        <span className="truncate max-w-[140px]">{selectedRev.album || variant.album}</span>
                      </>
                    )}
                    {(selectedRev.isrc || variant.isrc) && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-[10.5px]">{selectedRev.isrc || variant.isrc}</span>
                      </>
                    )}
                  </div>

                  {isOwner && !isLatest && (
                    <button
                      type="button"
                      disabled={reverting}
                      onClick={() => handleRevert(selectedRev.id)}
                      className="inline-flex items-center gap-1.5 rounded-[7px] border border-unison-border bg-unison-surface px-2.5 py-1 text-[11.5px] font-medium text-unison-text hover:bg-unison-bg-hover transition-colors cursor-pointer"
                    >
                      {reverting ? <IconLoader2 className="size-3 animate-spin" /> : <IconArrowBackUp className="size-3 text-amber-400" />}
                      <span>Revert to this</span>
                    </button>
                  )}
                </div>

                {/* Diff Lines Container */}
                <div className="flex-1 overflow-y-auto p-3 font-mono text-[11.5px] leading-[1.6]">
                  {diffLoading ? (
                    <div className="flex h-48 items-center justify-center text-unison-text-muted">
                      <IconLoader2 className="size-4 animate-spin" />
                    </div>
                  ) : diff?.rows && diff.rows.length > 0 ? (
                    <DiffView rows={diff.rows} mode="unified" />
                  ) : (
                    <div className="rounded-[8px] border border-unison-border/60 bg-black/30 p-3.5">
                      <pre className="whitespace-pre-wrap text-unison-text-secondary text-[11.5px] leading-relaxed font-mono">
                        {selectedRev.lyrics || variant.lyrics}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-unison-text-muted text-[12px]">
                Select a revision to view
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
