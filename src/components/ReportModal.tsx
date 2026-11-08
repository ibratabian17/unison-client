import { useState } from "react"
import { CouncilOverlay } from "@/components/council/CouncilOverlay"
import { buttonClass } from "@/components/ui"
import { reportVariant } from "@/lib/api"
import { REPORT_REASONS, REPORT_REASON_LABEL, type ReportReason } from "@/lib/report-reasons"
import { pushToast } from "@/lib/toast"

interface ReportModalProps {
  variantId: number
  songTitle: string
  isOpen: boolean
  onClose: () => void
}

const inputClass =
  "w-full rounded-md border border-unison-border bg-unison-bg px-3 py-2 text-sm text-unison-text focus:border-unison-border-strong focus:outline-none disabled:opacity-60"
const labelClass = "text-[10px] uppercase tracking-wider text-unison-text-muted"

export function ReportModal({ variantId, songTitle, isOpen, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason>("bad_sync")
  const [details, setDetails] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      await reportVariant(variantId, reason, details.trim() || undefined)
      pushToast({ kind: "success", message: "Report submitted" })
      onClose()
    } catch (err) {
      pushToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to submit report",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CouncilOverlay
      open={isOpen}
      onOpenChange={(val) => (val ? null : onClose())}
      label="Report lyrics"
      className="top-1/2 w-[min(440px,calc(100vw-32px))] -translate-y-1/2 px-[22px] py-5"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-unison-text">Report lyrics</h2>
          <p className="mt-0.5 text-xs text-unison-text-muted">
            {songTitle} · #{variantId}
          </p>
        </div>

        <div className="space-y-1">
          <label className={labelClass}>Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as ReportReason)}
            aria-label="Report reason"
            disabled={submitting}
            className={inputClass}
          >
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {REPORT_REASON_LABEL[r]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className={labelClass}>Details (optional)</label>
          <textarea
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            disabled={submitting}
            placeholder="Describe what is wrong with these lyrics…"
            className={inputClass}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonClass("ghost", "sm")}>
            Cancel
          </button>
          <button type="submit" disabled={submitting} className={buttonClass("primary", "sm")}>
            {submitting ? "Submitting…" : "Submit report"}
          </button>
        </div>
      </form>
    </CouncilOverlay>
  )
}
