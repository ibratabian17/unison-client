import { useState } from "react"
import { reportVariant } from "@/lib/api"
import { IconX, IconAlertTriangle, IconLoader2, IconCheck } from "@tabler/icons-react"

interface ReportModalProps {
  variantId: number
  songTitle: string
  isOpen: boolean
  onClose: () => void
}

type ReportReason = "wrong_song" | "bad_sync" | "offensive" | "spam" | "other"

export function ReportModal({ variantId, songTitle, isOpen, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason>("bad_sync")
  const [details, setDetails] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      setError(null)
      await reportVariant(variantId, reason, details.trim() || undefined)
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-xl border border-unison-border bg-unison-bg-elevated p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-unison-border pb-3">
          <div className="flex items-center gap-2 font-semibold text-base text-unison-text">
            <IconAlertTriangle className="size-5 text-amber-400" />
            Report Lyrics
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-unison-text-muted hover:bg-unison-bg-hover hover:text-unison-text transition-colors"
          >
            <IconX className="size-5" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
            <IconCheck className="size-12 text-emerald-400" />
            <h4 className="font-semibold text-unison-text">Report Submitted</h4>
            <p className="text-xs text-unison-text-secondary">Thank you for helping keep Unison lyrics accurate.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-xs text-unison-text-secondary">
                Reporting entry for <span className="font-medium text-unison-text">{songTitle}</span> (ID: #{variantId})
              </p>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-unison-text-secondary">Reason</span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                aria-label="Report reason"
                className="w-full rounded-lg border border-unison-border bg-unison-bg px-3 py-2 text-sm text-unison-text focus:border-unison-border-strong focus:outline-none"
              >
                <option value="bad_sync">Out of sync / incorrect timing</option>
                <option value="wrong_song">Wrong song or mismatched lyrics</option>
                <option value="offensive">Inappropriate or offensive content</option>
                <option value="spam">Spam / automated junk</option>
                <option value="other">Other issue</option>
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-unison-text-secondary">Details (Optional)</span>
              <textarea
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Explain the issue or timestamps that are off..."
                className="w-full rounded-lg border border-unison-border bg-unison-bg p-2.5 text-xs text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none"
              />
            </label>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-xs font-medium text-unison-text-secondary hover:bg-unison-bg-hover hover:text-unison-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-xs font-semibold text-white shadow transition-all hover:bg-red-500 disabled:opacity-50"
              >
                {submitting && <IconLoader2 className="size-3.5 animate-spin" />}
                Submit Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
