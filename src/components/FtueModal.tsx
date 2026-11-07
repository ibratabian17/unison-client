import { useState } from "react"
import { IconCheck, IconLayoutBoard, IconSparkles } from "@tabler/icons-react"
import { BetterLyricsLogo } from "@/components/BetterLyricsLogo"
import { type UiMode, useUiMode } from "@/context/UiModeContext"
import { cn } from "@/lib/cn"

export function FtueModal() {
  const { ftueSeen, uiMode, completeFtue } = useUiMode()
  const [selected, setSelected] = useState<UiMode>(uiMode)

  if (ftueSeen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose your look"
      data-testid="ftue-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-[24px] border border-unison-border-strong bg-[#121117] shadow-[0_32px_80px_rgba(0,0,0,0.65)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-3/4 -translate-x-1/2 rounded-full bg-red-500/15 blur-3xl"
        />

        <div className="relative px-6 pt-7 pb-3 text-center sm:px-8">
          <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold text-unison-text">
            <BetterLyricsLogo size={16} />
            <span>Welcome to Unison</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-unison-text">Pick your look</h2>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-unison-text-secondary sm:text-sm">
            Every feature works in both styles, and you can switch anytime in Settings.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3.5 px-6 py-3 sm:grid-cols-2 sm:px-8">
          <button
            type="button"
            onClick={() => setSelected("new")}
            data-testid="ftue-pick-new"
            aria-pressed={selected === "new"}
            className={cn(
              "group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-150",
              selected === "new"
                ? "border-white/40 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_32px_rgba(0,0,0,0.35)]"
                : "border-unison-border bg-white/[0.02] hover:border-unison-border-strong hover:bg-white/[0.05]",
            )}
          >
            <div>
              <div className="relative mb-3.5 h-24 w-full overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_25%_25%,rgba(235,24,46,0.45),transparent_60%),radial-gradient(circle_at_80%_75%,rgba(99,102,241,0.35),transparent_60%),#0b0a0f] p-3">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 rounded-lg bg-white/10 px-2 py-1 backdrop-blur-md">
                    <span className="h-1.5 w-5 rounded-full bg-white/80" />
                    <span className="h-1.5 w-4 rounded-full bg-white/30" />
                    <span className="h-1.5 w-4 rounded-full bg-white/30" />
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <div className="size-10 shrink-0 rounded-xl bg-gradient-to-br from-rose-500 to-indigo-600 shadow-lg ring-1 ring-white/20" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-3/4 rounded bg-white/90" />
                    <div className="h-2 w-1/2 rounded bg-white/45" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconSparkles className="size-4 text-amber-300" />
                  <span className="text-sm font-bold text-unison-text">New UI</span>
                </div>
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full border transition-colors",
                    selected === "new"
                      ? "border-white bg-white text-[#121117]"
                      : "border-white/25 bg-transparent text-transparent",
                  )}
                >
                  <IconCheck className="size-3.5" stroke={2.5} />
                </span>
              </div>

              <p className="mt-1.5 text-xs leading-relaxed text-unison-text-secondary">
                Translucent glass panels, album-colored backgrounds, and cover art grids.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelected("classic")}
            data-testid="ftue-pick-classic"
            aria-pressed={selected === "classic"}
            className={cn(
              "group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-150",
              selected === "classic"
                ? "border-white/40 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_32px_rgba(0,0,0,0.35)]"
                : "border-unison-border bg-white/[0.02] hover:border-unison-border-strong hover:bg-white/[0.05]",
            )}
          >
            <div>
              <div className="relative mb-3.5 h-24 w-full overflow-hidden rounded-xl border border-unison-border bg-[#0f0e13] p-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <div className="flex gap-1.5">
                    <span className="h-1.5 w-5 rounded bg-white/70" />
                    <span className="h-1.5 w-5 rounded bg-white/30" />
                    <span className="h-1.5 w-5 rounded bg-white/30" />
                  </div>
                </div>
                <div className="mt-2.5 grid grid-cols-[38px_1fr] gap-2">
                  <div className="aspect-square w-full rounded-md border border-white/10 bg-[#141316]" />
                  <div className="space-y-1.5 rounded-md border border-white/10 bg-[#141316] p-2">
                    <div className="h-2 w-4/5 rounded bg-white/75" />
                    <div className="h-2 w-3/5 rounded bg-white/40" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconLayoutBoard className="size-4 text-sky-300" />
                  <span className="text-sm font-bold text-unison-text">Classic UI</span>
                </div>
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full border transition-colors",
                    selected === "classic"
                      ? "border-white bg-white text-[#121117]"
                      : "border-white/25 bg-transparent text-transparent",
                  )}
                >
                  <IconCheck className="size-3.5" stroke={2.5} />
                </span>
              </div>

              <p className="mt-1.5 text-xs leading-relaxed text-unison-text-secondary">
                Solid dark surfaces, compact cards, and the familiar two-column layout.
              </p>
            </div>
          </button>
        </div>

        <div className="flex justify-end border-t border-unison-border bg-white/[0.02] px-6 py-4 sm:px-8">
          <button
            type="button"
            data-testid="ftue-continue"
            onClick={() => completeFtue(selected)}
            className="w-full cursor-pointer rounded-xl bg-unison-text px-5 py-2.5 text-xs font-bold text-[#121117] shadow-sm transition-transform hover:opacity-95 active:scale-[0.98] sm:w-auto"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
