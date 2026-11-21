// Ported from Composer (src/utils/unison-suggest-copy.ts).
import type { SuggestionDecider } from "@/lib/revision-types"
import { formatRelativeTime, plural } from "@/lib/format"

const DAY_SEC = 86_400

export const SEND_SUGGESTION_LABEL = "Send suggestion"
export const WITHDRAW_SUGGESTION_LABEL = "Withdraw suggestion"
export const NOTE_PLACEHOLDER = "For example: line 3 had a typo"
export const NEEDS_OWN_LYRIC = "You need one live lyric of your own before you can suggest edits."
export const ONE_ALREADY_WAITING = "A change to this lyric is already waiting. Try again once it is decided."
export const NOTHING_TO_SEND = "Nothing to send yet. Your edits match the live version."
export const WAITING_TITLE = "Your suggestion is waiting"
export const YOUR_NOTE_LABEL = "Your note"
export const COUNCIL_DECIDES = "The council decides this one."

export function ownerLyric(owner: string | null): string {
  return owner ? `${owner}'s lyric` : "this lyric"
}

export function suggestTitle(owner: string | null): string {
  return `Suggest an edit to ${ownerLyric(owner)}`
}

export function liveLine(revNo: number): string {
  return `Rev ${revNo} is live on Unison.`
}

export function withdrawnLine(liveRevNo: number): string {
  return `You withdrew your suggestion. Rev ${liveRevNo} stays live.`
}

export function noteLabel(owner: string | null, decider: SuggestionDecider | undefined): string {
  if (decider === "council") return "Note for the council (optional)"
  return owner ? `Note for ${owner} (optional)` : "Note (optional)"
}

export function ownerWindowText(owner: string, ownerDecisionSec: number): string {
  const days = Math.max(1, Math.ceil(ownerDecisionSec / DAY_SEC))
  return `${owner} has ${plural(days, "day")} to decide.`
}

export function whoDecidesText(
  decider: SuggestionDecider | undefined,
  owner: string | null,
  ownerDecisionSec: number | null,
): string | null {
  if (decider === "council") return COUNCIL_DECIDES
  if (decider !== "owner" || !owner || ownerDecisionSec === null) return null
  return `${ownerWindowText(owner, ownerDecisionSec)} After that, the council can too.`
}

export function sentDetail(
  decider: SuggestionDecider | undefined,
  owner: string | null,
  ownerDecisionSec: number | null,
): string | undefined {
  if (decider === "council") return COUNCIL_DECIDES
  if (decider !== "owner" || !owner || ownerDecisionSec === null) return undefined
  return ownerWindowText(owner, ownerDecisionSec)
}

export function waitingMeta(revNo: number, createdAtSec: number): string {
  return `Rev ${revNo}, sent ${formatRelativeTime(createdAtSec)}`
}

export function decidedByName(decidedBy: SuggestionDecider, owner: string | null): string {
  return decidedBy === "owner" && owner ? owner : "The council"
}

export function approvedTitle(decidedBy: SuggestionDecider, owner: string | null): string {
  return `${decidedByName(decidedBy, owner)} approved your suggestion`
}

export function approvedLine(revNo: number): string {
  return `Rev ${revNo} is live, with your name on the song page.`
}

export function rejectedTitle(decidedBy: SuggestionDecider, owner: string | null): string {
  return `${decidedByName(decidedBy, owner)} rejected your suggestion`
}

export function staysLiveLine(liveRevNo: number): string {
  return `Rev ${liveRevNo} stays live.`
}

export function rejectNoteLabel(decidedBy: SuggestionDecider, owner: string | null): string {
  return decidedBy === "owner" && owner ? `Note from ${owner}` : "Note from the council"
}
