import { createContext, type ReactNode, useCallback, useContext, useState } from "react"

export type UiMode = "new" | "classic"

const UI_MODE_KEY = "unison.ui-mode.v1"
const FTUE_SEEN_KEY = "unison.ftue.seen.v1"
const ART_BG_KEY = "unison.art-bg.v1"
const HOVER_PREVIEW_KEY = "unison.hover-preview.v1"

function readStoredMode(): UiMode {
  try {
    const val = localStorage.getItem(UI_MODE_KEY)
    if (val === "classic" || val === "new") return val
  } catch {}
  return "new"
}

function readFtueSeen(): boolean {
  try {
    return localStorage.getItem(FTUE_SEEN_KEY) === "1"
  } catch {
    return false
  }
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const val = localStorage.getItem(key)
    if (val === "0") return false
    if (val === "1") return true
  } catch {}
  return fallback
}

export interface UiModeContextValue {
  uiMode: UiMode
  setUiMode: (mode: UiMode) => void
  ftueSeen: boolean
  completeFtue: (chosenMode: UiMode) => void
  reopenFtue: () => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  artBackgroundEnabled: boolean
  setArtBackgroundEnabled: (enabled: boolean) => void
  hoverPreviewEnabled: boolean
  setHoverPreviewEnabled: (enabled: boolean) => void
}

const UiModeContext = createContext<UiModeContextValue>({
  uiMode: "new",
  setUiMode: () => {},
  ftueSeen: true,
  completeFtue: () => {},
  reopenFtue: () => {},
  settingsOpen: false,
  setSettingsOpen: () => {},
  artBackgroundEnabled: true,
  setArtBackgroundEnabled: () => {},
  hoverPreviewEnabled: true,
  setHoverPreviewEnabled: () => {},
})

export function UiModeProvider({ children }: { children: ReactNode }) {
  const [uiMode, setUiModeState] = useState<UiMode>(readStoredMode)
  const [ftueSeen, setFtueSeenState] = useState<boolean>(readFtueSeen)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [artBackgroundEnabled, setArtBgState] = useState<boolean>(() => readBool(ART_BG_KEY, true))
  const [hoverPreviewEnabled, setHoverPreviewState] = useState<boolean>(() => readBool(HOVER_PREVIEW_KEY, true))

  const setUiMode = useCallback((mode: UiMode) => {
    setUiModeState(mode)
    try {
      localStorage.setItem(UI_MODE_KEY, mode)
    } catch {}
  }, [])

  const completeFtue = useCallback((chosenMode: UiMode) => {
    setUiModeState(chosenMode)
    setFtueSeenState(true)
    try {
      localStorage.setItem(UI_MODE_KEY, chosenMode)
      localStorage.setItem(FTUE_SEEN_KEY, "1")
    } catch {}
  }, [])

  const reopenFtue = useCallback(() => {
    setFtueSeenState(false)
    try {
      localStorage.removeItem(FTUE_SEEN_KEY)
    } catch {}
  }, [])

  const setArtBackgroundEnabled = useCallback((enabled: boolean) => {
    setArtBgState(enabled)
    try {
      localStorage.setItem(ART_BG_KEY, enabled ? "1" : "0")
    } catch {}
  }, [])

  const setHoverPreviewEnabled = useCallback((enabled: boolean) => {
    setHoverPreviewState(enabled)
    try {
      localStorage.setItem(HOVER_PREVIEW_KEY, enabled ? "1" : "0")
    } catch {}
  }, [])

  return (
    <UiModeContext.Provider
      value={{
        uiMode,
        setUiMode,
        ftueSeen,
        completeFtue,
        reopenFtue,
        settingsOpen,
        setSettingsOpen,
        artBackgroundEnabled,
        setArtBackgroundEnabled,
        hoverPreviewEnabled,
        setHoverPreviewEnabled,
      }}
    >
      {children}
    </UiModeContext.Provider>
  )
}

export function useUiMode(): UiModeContextValue {
  return useContext(UiModeContext)
}
