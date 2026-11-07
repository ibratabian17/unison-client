import { useEffect, useRef } from "react"
import {
  IconCheck,
  IconLayoutBoard,
  IconSettings,
  IconSparkles,
  IconX,
} from "@tabler/icons-react"
import { Switch } from "@/components/council/Switch"
import { popoverSurfaceClass } from "@/components/ui"
import { type UiMode, useUiMode } from "@/context/UiModeContext"
import { cn } from "@/lib/cn"

export function SettingsContent({ onClose: _onClose }: { onClose?: () => void }) {
  const {
    uiMode,
    setUiMode,
    artBackgroundEnabled,
    setArtBackgroundEnabled,
    hoverPreviewEnabled,
    setHoverPreviewEnabled,
  } = useUiMode()

  const pickMode = (mode: UiMode) => {
    setUiMode(mode)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-unison-text">Appearance</h3>
          <p className="mt-0.5 text-xs text-unison-text-muted">
            Choose between the new glass interface and the classic dark layout.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => pickMode("new")}
            aria-pressed={uiMode === "new"}
            data-testid="settings-ui-new"
            className={cn(
              "flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3.5 text-left transition-all",
              uiMode === "new"
                ? "border-white/40 bg-white/[0.08] shadow-sm"
                : "border-unison-border bg-white/[0.02] hover:border-unison-border-strong hover:bg-white/[0.04]",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-unison-text">
                <IconSparkles className="size-4 text-amber-300" />
                New UI
              </span>
              {uiMode === "new" ? (
                <span className="grid size-5 place-items-center rounded-full bg-unison-text text-[#121117]">
                  <IconCheck className="size-3.5" stroke={2.5} />
                </span>
              ) : null}
            </div>
            <p className="text-xs leading-relaxed text-unison-text-secondary">
              Translucent glass surfaces, album-colored backgrounds, and cover art grids.
            </p>
          </button>

          <button
            type="button"
            onClick={() => pickMode("classic")}
            aria-pressed={uiMode === "classic"}
            data-testid="settings-ui-classic"
            className={cn(
              "flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3.5 text-left transition-all",
              uiMode === "classic"
                ? "border-white/40 bg-white/[0.08] shadow-sm"
                : "border-unison-border bg-white/[0.02] hover:border-unison-border-strong hover:bg-white/[0.04]",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-unison-text">
                <IconLayoutBoard className="size-4 text-sky-300" />
                Classic UI
              </span>
              {uiMode === "classic" ? (
                <span className="grid size-5 place-items-center rounded-full bg-unison-text text-[#121117]">
                  <IconCheck className="size-3.5" stroke={2.5} />
                </span>
              ) : null}
            </div>
            <p className="text-xs leading-relaxed text-unison-text-secondary">
              Solid dark surfaces, compact cards, and the classic two-column layout.
            </p>
          </button>
        </div>
      </div>

      {uiMode === "new" ? (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-unison-text-muted">
            Background Effects
          </div>
          <div className="flex flex-col gap-3 text-sm text-unison-text">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-unison-text">Album Art Background</div>
                <div className="text-[11px] text-unison-text-muted">
                  Tint the page background using colors from the current song cover
                </div>
              </div>
              <Switch checked={artBackgroundEnabled} onChange={setArtBackgroundEnabled}>
                <span className="sr-only">Album Art Background</span>
              </Switch>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-unison-text">Hover Cover Preview</div>
                <div className="text-[11px] text-unison-text-muted">
                  Blend the background when hovering over songs in the feed
                </div>
              </div>
              <Switch checked={hoverPreviewEnabled} onChange={setHoverPreviewEnabled}>
                <span className="sr-only">Hover Cover Preview</span>
              </Switch>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function SettingsModal() {
  const { settingsOpen, setSettingsOpen, uiMode } = useUiMode()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!settingsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false)
    }
    document.addEventListener("keydown", onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener("keydown", onKey)
  }, [settingsOpen, setSettingsOpen])

  if (!settingsOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      data-testid="settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) setSettingsOpen(false)
      }}
    >
      <div
        className={cn(
          "relative flex w-full max-w-lg flex-col overflow-hidden rounded-[22px]",
          uiMode === "new"
            ? popoverSurfaceClass
            : "border border-unison-border-strong bg-[#121117] shadow-[0_24px_60px_rgba(0,0,0,0.65)]",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <IconSettings className="size-5 text-unison-text-secondary" />
            <h2 className="text-base font-bold text-unison-text">Settings</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
            className="grid size-8 cursor-pointer place-items-center rounded-full bg-white/[0.06] text-unison-text-secondary transition-colors hover:bg-white/[0.12] hover:text-unison-text"
          >
            <IconX className="size-4" stroke={2} />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-5">
          <SettingsContent onClose={() => setSettingsOpen(false)} />
        </div>
      </div>
    </div>
  )
}
