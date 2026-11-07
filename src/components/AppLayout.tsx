import { AuthProvider } from "@/auth/AuthProvider"
import { FtueModal } from "@/components/FtueModal"
import { SettingsModal } from "@/components/SettingsModal"
import { UiModeProvider, useUiMode } from "@/context/UiModeContext"
import { cn } from "@/lib/cn"
import { pageWidthClass, usePageWidth } from "@/lib/page-width"
import type { BadgeImage } from "@/lib/types"
import { MotionConfig } from "motion/react"
import { Outlet } from "react-router-dom"
import { AppHeader } from "./AppHeader"
import { BadgeAssetPreloader } from "./BadgeAssetPreloader"
import { BadgeCatalogueProvider } from "./BadgeCatalogueContext"
import { PageArtProvider } from "./PageArt"
import { ToastViewport } from "./ToastViewport"
import { artPageClass } from "./ui"

// Stable reference so the preloader effect does not re-run on every render.
const COLOR_VARIANTS: (keyof BadgeImage)[] = ["color"]

function AppShell() {
  const width = usePageWidth()
  const { uiMode } = useUiMode()
  const isNew = uiMode === "new"

  return (
    <PageArtProvider>
      <div className={cn("min-h-full", isNew && artPageClass)}>
        <AppHeader width={width} />
        <main
          className={cn(
            "mx-auto",
            isNew
              ? cn("pt-6 pb-8 max-sm:pt-0", pageWidthClass(width))
              : cn("py-8", width === "wide" ? pageWidthClass("wide") : "max-w-5xl px-6"),
          )}
        >
          <Outlet />
        </main>
        <FtueModal />
        <SettingsModal />
        <ToastViewport />
      </div>
    </PageArtProvider>
  )
}

export function AppLayout() {
  return (
    <MotionConfig reducedMotion="user">
      <UiModeProvider>
        <AuthProvider>
          <BadgeCatalogueProvider>
            <BadgeAssetPreloader variants={COLOR_VARIANTS} fetchPriority="high" />
            <AppShell />
          </BadgeCatalogueProvider>
        </AuthProvider>
      </UiModeProvider>
    </MotionConfig>
  )
}
