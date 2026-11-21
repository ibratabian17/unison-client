import { useEffect, useState } from "react"
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconCheck,
  IconX,
} from "@tabler/icons-react"
import { SongThumbnail } from "@/components/SongThumbnail"
import { UserAvatar } from "@/components/UserAvatar"
import { CouncilOverlay } from "@/components/council/CouncilOverlay"
import { type DiffMode, DiffView } from "@/components/council/DiffView"
import { Segmented } from "@/components/council/Segmented"
import { Callout, Chip } from "@/components/council/detail-parts"
import { Bone } from "@/components/skeleton"
import { buttonClass, chipClass, chipIconClass, glassClass, raisedChipClass } from "@/components/ui"
import { useUiMode } from "@/context/UiModeContext"
import {
  fetchLyricRevisions,
  fetchRevisionDetail,
  fetchRevisionDiff,
  previewLyricRevision,
  revertLyricRevision,
  withdrawPendingRevision,
} from "@/lib/api"
import { cn } from "@/lib/cn"
import { formatRelativeTime } from "@/lib/format"
import { pushToast } from "@/lib/toast"
import type {
  LyricRevision,
  PreviewResult,
  RevisionDetail,
  RevisionDiff,
  RevisionStatus,
  VariantFull,
} from "@/lib/types"

interface RevisionHistoryModalProps {
  variant: VariantFull
  isOwner: boolean
  currentKeyId?: string
  isCouncil?: boolean
  isOpen: boolean
  onClose: () => void
  onReverted: () => void
}

const STATUS_CHIP_TONE: Record<string, "good" | "warn" | "plain" | "gold"> = {
  live: "good",
  approved: "good",
  pending: "warn",
  rejected: "warn",
  past: "plain",
  superseded: "plain",
  withdrawn: "plain",
}

const STATUS_LABEL: Record<string, string> = {
  live: "Live",
  approved: "Live",
  pending: "Pending",
  rejected: "Rejected",
  past: "Past",
  superseded: "Superseded",
  withdrawn: "Withdrawn",
}

const PENDING_REASONS: Record<string, string> = {
  sealed: "Sealed lyric",
  flagged: "Flagged for review",
  large_text_drift: "Large text change",
  large_timing_drift: "Large timing change",
  suggested: "Suggested edit",
}

function getRevisionReasonLabel(rev: LyricRevision): string {
  const status = rev.status as RevisionStatus
  const revNo = rev.revNo ?? rev.version ?? 1
  if (status === "pending") {
    return (rev.pendingReason && PENDING_REASONS[rev.pendingReason]) || "Pending Council review"
  }
  if (status === "rejected") {
    const who = rev.decidedBy === "owner" ? "owner" : "Council"
    return rev.reviewNote ? `“${rev.reviewNote}”` : `Rejected by ${who}`
  }
  if (status === "withdrawn") return "Withdrawn by author"
  if (status === "superseded") return "Replaced by newer edit"
  if (rev.revertsRevNo) return `Reverted to Rev ${rev.revertsRevNo}`
  if (revNo === 1) return "Original submission"
  if (rev.reviewedAt) return rev.decidedBy === "owner" ? "Approved by owner" : "Approved by Council"
  return "Saved within drift limits"
}

export function RevisionHistoryModal({
  variant,
  isOwner,
  currentKeyId,
  isCouncil = false,
  isOpen,
  onClose,
  onReverted,
}: RevisionHistoryModalProps) {
  const { uiMode } = useUiMode()
  const isNew = uiMode === "new"
  const dividerClass = isNew ? "border-white/[0.06]" : "border-unison-border"

  const [revisions, setRevisions] = useState<LyricRevision[]>([])
  const [selectedRevId, setSelectedRevId] = useState<number | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<RevisionDetail | null>(null)
  const [diff, setDiff] = useState<RevisionDiff | null>(null)
  const [diffMode, setDiffMode] = useState<DiffMode>("unified")
  const [revertPreview, setRevertPreview] = useState<PreviewResult | null>(null)
  const [confirmingRevert, setConfirmingRevert] = useState(false)
  const [loading, setLoading] = useState(false)
  const [diffLoading, setDiffLoading] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [deciding, setDeciding] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectNote, setRejectNote] = useState("")
  const [againstRevId, setAgainstRevId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadList = (cancelled = false) => {
    setLoading(true)
    setError(null)
    setSelectedRevId(null)
    setSelectedDetail(null)
    setDiff(null)
    setConfirmingRevert(false)

    fetchLyricRevisions(variant.id)
      .then((res) => {
        if (cancelled) return
        const list = res.revisions ?? []
        if (list.length === 0) {
          const initial: LyricRevision = {
            id: variant.id,
            lyricId: variant.id,
            revNo: 1,
            version: 1,
            lyrics: variant.lyrics,
            format: variant.format ?? "lrc",
            language: variant.language,
            isrc: variant.isrc,
            status: "live",
            isAnchor: true,
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
            revNo: 1,
            version: 1,
            lyrics: variant.lyrics,
            format: variant.format ?? "lrc",
            language: variant.language,
            isrc: variant.isrc,
            status: "live",
            isAnchor: true,
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
  }

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    loadList(cancelled)
    return () => {
      cancelled = true
    }
  }, [isOpen, variant.id])

  useEffect(() => {
    if (!selectedRevId) {
      setDiff(null)
      setSelectedDetail(null)
      setRevertPreview(null)
      setConfirmingRevert(false)
      return
    }
    let cancelled = false
    setDiffLoading(true)
    setConfirmingRevert(false)
    setRevertPreview(null)
    setRejectOpen(false)
    setRejectNote("")

    const selected = revisions.find((r) => r.id === selectedRevId)
    const revNo = selected?.revNo ?? selected?.version ?? 1

    Promise.all([
      revNo === 1 && againstRevId === null
        ? Promise.resolve(null)
        : fetchRevisionDiff(variant.id, selectedRevId, againstRevId ?? undefined),
      fetchRevisionDetail(variant.id, selectedRevId),
    ])
      .then(async ([diffRes, detailRes]) => {
        if (cancelled) return
        setDiff(diffRes)
        setSelectedDetail(detailRes)

        if (isOwner && selected?.status === "past" && detailRes) {
          const p = await previewLyricRevision(variant.id, {
            lyrics: detailRes.lyrics,
            format: detailRes.format,
            language: detailRes.language,
            isrc: detailRes.isrc,
            album: detailRes.album,
          })
          if (!cancelled) setRevertPreview(p)
        }
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
  }, [selectedRevId, againstRevId, variant.id, revisions, isOwner])

  if (!isOpen) return null

  const handleRevert = async (revId: number) => {
    try {
      setReverting(true)
      setError(null)
      await revertLyricRevision(variant.id, revId)
      pushToast({ kind: "success", message: "Reverted revision" })
      onReverted()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revert revision")
    } finally {
      setReverting(false)
    }
  }

  const handleWithdraw = async () => {
    try {
      setWithdrawing(true)
      setError(null)
      await withdrawPendingRevision(variant.id)
      pushToast({ kind: "info", message: "Withdrew pending revision" })
      onReverted()
      loadList(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to withdraw pending revision")
    } finally {
      setWithdrawing(false)
    }
  }

  const handleApprove = async (revId: number) => {
    try {
      setDeciding(true)
      setError(null)
      await approveLyricRevision(variant.id, revId)
      pushToast({ kind: "success", message: "Approved revision — now live" })
      onReverted()
      loadList(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve revision")
    } finally {
      setDeciding(false)
    }
  }

  const handleReject = async (revId: number) => {
    try {
      setDeciding(true)
      setError(null)
      await rejectLyricRevision(variant.id, revId, rejectNote.trim() || undefined)
      pushToast({ kind: "info", message: "Rejected revision" })
      setRejectOpen(false)
      setRejectNote("")
      onReverted()
      loadList(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject revision")
    } finally {
      setDeciding(false)
    }
  }

  const selectedRev = revisions.find((r) => r.id === selectedRevId)
  const selectedRevNo = selectedRev?.revNo ?? selectedRev?.version ?? 1
  const isRevAuthor = Boolean(
    currentKeyId &&
      selectedRev &&
      (selectedRev.authorKeyId === currentKeyId || selectedRev.author?.keyId === currentKeyId),
  )
  const canWithdraw = Boolean(
    selectedRev?.status === "pending" &&
      (isRevAuthor || (isOwner && selectedRev.pendingReason !== "suggested")),
  )
  const canDecide = Boolean(
    selectedRev?.status === "pending" &&
      !isRevAuthor &&
      (isCouncil || (isOwner && selectedRev.pendingReason === "suggested")),
  )
  const canRevert =
    isOwner &&
    (selectedRev?.status === "past" ||
      (selectedRev && selectedRev.id !== revisions[0]?.id && selectedRev.status !== "pending")) &&
    (!revertPreview || !revertPreview.noChanges)
  const comparableRevs = revisions.filter((r) => r.id !== selectedRev?.id)
  const suggestionNote =
    selectedRev?.note ??
    (selectedRev && variant.revision?.suggestion?.id === selectedRev.id ? variant.revision.suggestion.note : null)

  return (
    <CouncilOverlay
      open={isOpen}
      onOpenChange={(val) => (val ? null : onClose())}
      label="Revision history"
      className="top-1/2 flex h-[600px] max-h-[88vh] w-[min(860px,calc(100vw-32px))] -translate-y-1/2 flex-col"
    >
      <div className={cn("flex items-start justify-between gap-4 border-b px-6 py-5", dividerClass)}>
        <div className="flex min-w-0 items-center gap-3.5">
          <SongThumbnail
            videoId={variant.videoId}
            song={variant.song}
            artist={variant.artist}
            className="size-12 shrink-0 rounded-lg outline outline-1 -outline-offset-1 outline-white/10"
          />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-unison-text">Revision history</h2>
            <p className="mt-0.5 truncate text-xs text-unison-text-secondary">
              {variant.song} · {variant.artist}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className={cn(
            glassClass,
            "grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-unison-text-secondary transition-[background-color,color,scale] duration-150 ease-out hover:bg-white/[0.14] hover:text-unison-text active:scale-[0.96]",
          )}
        >
          <IconX className="size-[15px]" stroke={2} />
        </button>
      </div>

      {error ? (
        <div className="px-6 pt-4">
          <Callout tone="warn" icon={<IconAlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" stroke={1.5} />}>
            {error}
          </Callout>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className={cn("flex w-[260px] shrink-0 flex-col border-r sm:w-[290px]", dividerClass)}>
          <div className={cn("border-b px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.08em] text-unison-text-muted", dividerClass)}>
            Revisions ({revisions.length})
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {loading ? (
              <div className="space-y-2 p-2">
                <Bone className="h-16 w-full rounded-[10px]" />
                <Bone className="h-16 w-full rounded-[10px]" />
              </div>
            ) : revisions.length === 0 ? (
              <p className="p-4 text-center text-xs text-unison-text-muted">No revisions found.</p>
            ) : (
              revisions.map((rev, idx) => {
                const isSelected = rev.id === selectedRevId
                const revNum = rev.revNo ?? rev.version ?? revisions.length - idx
                const tone = STATUS_CHIP_TONE[rev.status] ?? "plain"
                const label = STATUS_LABEL[rev.status] ?? rev.status
                const hasDrift =
                  revNum > 1 && (typeof rev.textDrift === "number" || typeof rev.timingDrift === "number")

                return (
                  <button
                    key={rev.id}
                    type="button"
                    onClick={() => { setSelectedRevId(rev.id); setAgainstRevId(null) }}
                    className={cn(
                      "w-full cursor-pointer space-y-1.5 rounded-[12px] p-3 text-left transition-colors",
                      isSelected
                        ? "bg-white/[0.09] text-unison-text shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                        : "text-unison-text-secondary hover:bg-white/[0.04]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-unison-text">Rev {revNum}</span>
                        <Chip tone={tone}>{label}</Chip>
                        {rev.isAnchor && revisions.length > 1 ? <Chip tone="gold">Anchor</Chip> : null}
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-unison-text-muted">
                        {formatRelativeTime(rev.createdAt || Math.floor(Date.now() / 1000))}
                      </span>
                    </div>

                    <p className="truncate text-xs text-unison-text-muted">{getRevisionReasonLabel(rev)}</p>

                    <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] text-unison-text-muted">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {rev.author ? (
                          <UserAvatar
                            avatarUrl={rev.author.avatarUrl}
                            keyId={rev.author.keyId ?? ""}
                            className="size-4 shrink-0 rounded-full object-cover"
                          />
                        ) : null}
                        <span className="truncate text-unison-text-secondary">
                          {rev.author?.displayName ?? "Contributor"}
                        </span>
                      </div>
                      {hasDrift ? (
                        <span className="shrink-0 font-mono text-[10.5px] text-unison-text-muted">
                          Text {Math.round((rev.textDrift ?? 0) * 100)}% · Sync {Math.round((rev.timingDrift ?? 0) * 100)}%
                        </span>
                      ) : null}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {selectedRev ? (
            <div className="flex h-full flex-col overflow-hidden">
              <div className={cn("flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3", dividerClass)}>
                <div className="flex items-center gap-2 text-xs text-unison-text-muted">
                  <span className="font-semibold text-unison-text">Rev {selectedRevNo}</span>
                  {diff?.againstRevNo ? (
                    <>
                      <span>·</span>
                      <span>Compared with Rev {diff.againstRevNo}</span>
                    </>
                  ) : null}
                  {selectedDetail?.format || selectedRev.format || variant.format ? (
                    <>
                      <span>·</span>
                      <span className="font-mono uppercase">
                        {selectedDetail?.format || selectedRev.format || variant.format}
                      </span>
                    </>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {diff?.rows && diff.rows.length > 0 ? (
                    <Segmented
                      label="Diff layout"
                      value={diffMode}
                      onChange={setDiffMode}
                      options={[
                        { value: "unified", label: "Unified" },
                        { value: "split", label: "Split" },
                      ]}
                    />
                  ) : null}

                  {comparableRevs.length > 1 ? (
                    <select
                      aria-label="Compare against revision"
                      value={againstRevId ?? ""}
                      onChange={(e) => setAgainstRevId(e.target.value ? Number(e.target.value) : null)}
                      className={cn(
                        "h-[30px] rounded-[9px] px-2 text-xs text-unison-text-secondary focus:outline-none",
                        isNew
                          ? "bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                          : "border border-unison-border bg-unison-bg",
                      )}
                    >
                      <option value="">vs previous live</option>
                      {comparableRevs.map((r) => (
                        <option key={r.id} value={r.id}>
                          vs Rev {r.revNo ?? r.version ?? r.id}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {canDecide ? (
                    <>
                      <button
                        type="button"
                        disabled={deciding}
                        onClick={() => void handleApprove(selectedRev.id)}
                        className={isNew ? raisedChipClass : buttonClass("primary", "sm")}
                      >
                        <IconCheck className={chipIconClass} stroke={1.75} />
                        <span>{deciding ? "Approving…" : "Approve"}</span>
                      </button>
                      <button
                        type="button"
                        disabled={deciding}
                        onClick={() => setRejectOpen((v) => !v)}
                        className={
                          isNew
                            ? cn(chipClass, rejectOpen && "bg-red-500/20 text-[#fca5a5]")
                            : buttonClass(rejectOpen ? "danger" : "fill", "sm")
                        }
                      >
                        <span>Reject</span>
                      </button>
                    </>
                  ) : null}

                  {canWithdraw ? (
                    <button
                      type="button"
                      disabled={withdrawing}
                      onClick={handleWithdraw}
                      className={isNew ? chipClass : buttonClass("fill", "sm")}
                    >
                      {withdrawing ? "Withdrawing…" : "Withdraw"}
                    </button>
                  ) : null}

                  {canRevert && !confirmingRevert ? (
                    <button
                      type="button"
                      disabled={reverting}
                      onClick={() => setConfirmingRevert(true)}
                      className={isNew ? chipClass : buttonClass("fill", "sm")}
                    >
                      <IconArrowBackUp className={chipIconClass} stroke={1.75} />
                      <span>Revert to this</span>
                    </button>
                  ) : null}
                </div>
              </div>

              {confirmingRevert ? (
                <div className="px-5 pt-4">
                  <Callout
                    tone={revertPreview && !revertPreview.outcome.goesLive ? "warn" : "plain"}
                    icon={
                      revertPreview && !revertPreview.outcome.goesLive ? (
                        <IconAlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" stroke={1.5} />
                      ) : (
                        <IconCheck aria-hidden className="mt-0.5 size-4 shrink-0" stroke={1.75} />
                      )
                    }
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span>
                        <b>Revert to Rev {selectedRevNo}?</b>{" "}
                        {revertPreview
                          ? revertPreview.outcome.goesLive
                            ? "Within drift thresholds — goes live immediately."
                            : `Exceeds drift thresholds (${PENDING_REASONS[revertPreview.outcome.reason ?? ""] ?? "Council review"}) and will be submitted for Council review.`
                          : `Creates a new revision restoring Rev ${selectedRevNo}.`}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmingRevert(false)}
                          className={isNew ? chipClass : buttonClass("ghost", "sm")}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={reverting}
                          onClick={() => void handleRevert(selectedRev.id)}
                          className={isNew ? raisedChipClass : buttonClass("primary", "sm")}
                        >
                          {reverting ? "Reverting…" : "Confirm revert"}
                        </button>
                      </div>
                    </div>
                  </Callout>
                </div>
              ) : null}

              {rejectOpen && canDecide ? (
                <div className="px-5 pt-4">
                  <Callout tone="warn" icon={<IconAlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" stroke={1.5} />}>
                    <div className="space-y-2.5">
                      <p className="text-xs font-semibold text-unison-text">
                        Reject Rev {selectedRevNo}? Optional note for the author:
                      </p>
                      <input
                        type="text"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        maxLength={variant.revision?.suggestion?.rejectNoteMaxLength ?? 500}
                        placeholder="Optional reason for rejecting…"
                        disabled={deciding}
                        className={cn(
                          "w-full rounded-lg px-3 py-1.5 text-xs text-unison-text placeholder:text-unison-text-muted focus:outline-none",
                          isNew
                            ? "bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                            : "border border-unison-border bg-unison-bg",
                        )}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setRejectOpen(false)}
                          className={isNew ? chipClass : buttonClass("ghost", "sm")}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={deciding}
                          onClick={() => void handleReject(selectedRev.id)}
                          className={
                            isNew
                              ? cn(raisedChipClass, "bg-red-500/25 text-[#fecaca] hover:bg-red-500/35")
                              : buttonClass("danger", "sm")
                          }
                        >
                          {deciding ? "Rejecting…" : "Confirm reject"}
                        </button>
                      </div>
                    </div>
                  </Callout>
                </div>
              ) : null}

              {suggestionNote ? (
                <div className="px-5 pt-4">
                  <Callout tone="plain">
                    <b>Contributor note:</b> “{suggestionNote}”
                  </Callout>
                </div>
              ) : null}

              {selectedRev.reviewNote ? (
                <div className="px-5 pt-4">
                  <Callout tone="warn" icon={<IconAlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" stroke={1.5} />}>
                    <b>{selectedRev.decidedBy === "owner" ? "Owner note:" : "Council note:"}</b> “{selectedRev.reviewNote}”
                  </Callout>
                </div>
              ) : null}

              <div className="flex-1 overflow-y-auto p-5">
                {diffLoading ? (
                  <div className="space-y-2">
                    <Bone className="h-32 w-full rounded-[10px]" />
                  </div>
                ) : diff?.rows && diff.rows.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 text-[11px] text-unison-text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <i className="inline-block size-2 rounded-full bg-council-edit-ink" /> Added
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <i className="inline-block size-2 rounded-full bg-council-reject-ink" /> Removed
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <i className="inline-block size-2 rounded-full bg-unison-warn" /> Timing
                      </span>
                    </div>
                    <DiffView rows={diff.rows} mode={diffMode} />
                  </div>
                ) : (
                  <div className="rounded-[12px] bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-unison-text-secondary">
                      {selectedDetail?.lyrics || selectedRev.lyrics || variant.lyrics}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-unison-text-muted">
              Select a revision to inspect changes
            </div>
          )}
        </div>
      </div>
    </CouncilOverlay>
  )
}
