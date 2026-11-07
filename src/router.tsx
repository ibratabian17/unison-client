import { type ComponentType, Suspense, lazy } from "react"
import { type RouteObject, RouterProvider, createBrowserRouter, createHashRouter, Navigate } from "react-router-dom"
import { AppLayout } from "./components/AppLayout"
import { MobileGate } from "./components/exam/MobileGate"
import { AboutPage } from "./pages/AboutPage"
import { CuratorsPage } from "./pages/CuratorsPage"
import { DocsPage } from "./pages/DocsPage"
import { DownloadsPage } from "./pages/DownloadsPage"
import { ExamPage } from "./pages/ExamPage"
import { FeedPage } from "./pages/FeedPage"
import { LinkPage } from "./pages/LinkPage"
import { LyricsPage } from "./pages/LyricsPage"
import { MePage } from "./pages/MePage"
import { MigratePage } from "./pages/MigratePage"
import { NicknamePage } from "./pages/NicknamePage"
import { QueuePage } from "./pages/QueuePage"
import { SealedPage } from "./pages/SealedPage"
import { SearchPage } from "./pages/SearchPage"
import { SettingsPage } from "./pages/SettingsPage"
import { SubmitPage } from "./pages/SubmitPage"
import { TranslatePage } from "./pages/TranslatePage"
import { UserPage } from "./pages/UserPage"
import { councilRoute } from "./pages/council/routes"

const devRoutes: RouteObject[] = []
if (import.meta.env.DEV) {
  const devPages: { path: string; load: () => Promise<{ default: ComponentType }> }[] = [
    { path: "dev", load: () => import("./pages/DevIndex") },
    { path: "dev/link", load: () => import("./pages/DevLinkPreview") },
    { path: "dev/curators", load: () => import("./pages/DevCuratorsPreview") },
    { path: "dev/me", load: () => import("./pages/DevMePreview") },
    { path: "dev/migrate", load: () => import("./pages/DevMigratePreview") },
  ]
  for (const { path, load } of devPages) {
    const Page = lazy(load)
    devRoutes.push({
      path,
      element: (
        <Suspense fallback={null}>
          <Page />
        </Suspense>
      ),
    })
  }
}

const isGitHubPagesSubpath =
  typeof window !== "undefined" && window.location.hostname.endsWith(".github.io")

if (typeof window !== "undefined" && !isGitHubPagesSubpath && window.location.hash.startsWith("#/")) {
  const targetPath = window.location.hash.slice(1)
  window.history.replaceState(null, "", targetPath)
}

const createRouter = isGitHubPagesSubpath ? createHashRouter : createBrowserRouter

const router = createRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <FeedPage /> },
      { path: "feed", element: <FeedPage /> },
      { path: "songs", element: <Navigate to="/" replace /> },
      { path: "sealed", element: <SealedPage /> },
      { path: "seal", element: <Navigate to="/sealed" replace /> },
      { path: "submit", element: <SubmitPage /> },
      { path: "translate", element: <TranslatePage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "queue", element: <QueuePage /> },
      { path: "curators", element: <CuratorsPage /> },
      { path: "search", element: <SearchPage /> },
      { path: "song/:videoId", element: <LyricsPage /> },
      { path: "me", element: <MePage /> },
      { path: "curator/:keyId", element: <UserPage /> },
      { path: "u/:nickname", element: <NicknamePage /> },
      { path: "about", element: <AboutPage /> },
      { path: "downloads", element: <DownloadsPage /> },
      { path: "docs", element: <DocsPage /> },
      { path: "link", element: <LinkPage /> },
      { path: "migrate", element: <MigratePage /> },
      councilRoute,
      {
        path: "exam",
        element: (
          <MobileGate>
            <ExamPage />
          </MobileGate>
        ),
      },
      ...devRoutes,
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
