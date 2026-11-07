import { IconMenu2, IconSettings, IconX } from "@tabler/icons-react"
import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import { useUiMode } from "@/context/UiModeContext"
import { usePresence } from "@/hooks/usePresence"
import { cn } from "@/lib/cn"
import { LAYOUT_TRANSITION } from "@/lib/motion-variants"
import { type PageWidth, pageWidthClass } from "@/lib/page-width"
import { BetterLyricsLogo } from "./BetterLyricsLogo"
import { CouncilNavLink } from "./council/CouncilNavLink"
import { IconSwap } from "./icons/IconSwap"
import { SearchBar } from "./SearchBar"
import { SignInControl } from "./SignInControl"
import { artTextShadowClass, glassClass, popoverSurfaceClass } from "./ui"

const newMobileTabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative inline-flex h-[30px] items-center rounded-[9px] px-2.5 text-sm font-medium transition-colors duration-150 after:absolute after:inset-x-0 after:-inset-y-[5px]",
    isActive ? "bg-white/[0.08] text-unison-text" : "text-(--ink-2) hover:bg-white/[0.08] hover:text-unison-text",
  )

const deskTabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative inline-flex h-[30px] items-center rounded-[9px] px-2.5 text-sm font-medium transition-colors duration-150 after:absolute after:inset-x-0 after:-inset-y-[5px] hover:bg-white/[0.04]",
    isActive ? "text-unison-text" : "text-(--ink-2) hover:text-unison-text",
  )

const classicTabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-unison-bg-elevated text-unison-text"
      : "text-unison-text-secondary hover:text-unison-text hover:bg-unison-bg-hover",
  )

const navPill = (active: boolean) =>
  active ? (
    <motion.span
      layoutId="nav-pill"
      transition={LAYOUT_TRANSITION}
      style={{ borderRadius: 9 }}
      className="absolute inset-0 bg-white/[0.08]"
    />
  ) : null

function NavTab({
  to,
  end,
  activeOverride,
  children,
}: {
  to: string
  end?: boolean
  activeOverride?: boolean
  children: string
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => deskTabClass({ isActive: activeOverride ?? isActive })}
    >
      {({ isActive }) => {
        const active = activeOverride ?? isActive
        return (
          <>
            {navPill(active)}
            <span className="relative">{children}</span>
          </>
        )
      }}
    </NavLink>
  )
}

export function AppHeader({ width = "default" }: { width?: PageWidth }) {
  const { uiMode, setSettingsOpen } = useUiMode()
  const isNew = uiMode === "new"
  const { pathname } = useLocation()
  const isFeedActive = pathname === "/" || pathname === "/feed" || pathname === "/songs"
  const [menuOpen, setMenuOpen] = useState(false)
  const menu = usePresence(menuOpen)
  const headerRef = useRef<HTMLElement | null>(null)
  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  if (!isNew) {
    return (
      <header
        ref={headerRef}
        className="sticky top-0 z-10 border-b border-unison-border bg-unison-bg/80 backdrop-blur"
      >
        <div
          className={cn(
            "mx-auto flex items-center justify-between gap-4 py-4 lg:grid lg:grid-cols-[auto_auto_1fr_auto] lg:gap-6",
            width === "wide" ? pageWidthClass("wide") : "max-w-5xl px-6",
          )}
        >
          <Link
            to="/"
            aria-label="Unison home"
            className="flex items-center gap-2 transition-opacity hover:opacity-80 lg:justify-self-start"
          >
            <BetterLyricsLogo size={20} />
            <span className="text-base font-semibold tracking-tight">Unison</span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex lg:justify-self-start">
            <NavLink to="/" end className={() => classicTabClass({ isActive: isFeedActive })}>
              Feed
            </NavLink>
            <NavLink to="/curators" className={classicTabClass}>
              Leaderboard
            </NavLink>
            <CouncilNavLink className={classicTabClass} />
            <NavLink to="/translate" className={classicTabClass}>
              Translate
            </NavLink>
            <NavLink to="/submit" className={classicTabClass}>
              Submit
            </NavLink>
            <NavLink to="/docs" className={classicTabClass}>
              Docs
            </NavLink>
          </nav>
          <div className="hidden lg:flex lg:w-full lg:max-w-xs lg:justify-self-end">
            <SearchBar />
          </div>
          <div className="flex items-center gap-2 lg:justify-self-end">
            <div className="lg:hidden">
              <SearchBar compact />
            </div>
            <div className="hidden lg:block">
              <SignInControl />
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="group cursor-pointer rounded-md p-1.5 text-unison-text transition-colors hover:bg-unison-bg-hover lg:hidden"
            >
              {menuOpen ? (
                <IconX className="size-5 opacity-70 transition-opacity group-hover:opacity-100" stroke={1.5} />
              ) : (
                <IconMenu2 className="size-5 opacity-70 transition-opacity group-hover:opacity-100" stroke={1.5} />
              )}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-6 top-full mt-2 flex w-56 flex-col gap-2 rounded-lg border border-unison-border bg-unison-bg-elevated p-3 shadow-lg lg:hidden"
          >
            <nav className="flex flex-col gap-1">
              <NavLink
                to="/"
                end
                role="menuitem"
                onClick={closeMenu}
                className={() => classicTabClass({ isActive: isFeedActive })}
              >
                Feed
              </NavLink>
              <NavLink to="/curators" role="menuitem" onClick={closeMenu} className={classicTabClass}>
                Leaderboard
              </NavLink>
              <CouncilNavLink role="menuitem" onClick={closeMenu} className={classicTabClass} />
              <NavLink to="/translate" role="menuitem" onClick={closeMenu} className={classicTabClass}>
                Translate
              </NavLink>
              <NavLink to="/submit" role="menuitem" onClick={closeMenu} className={classicTabClass}>
                Submit
              </NavLink>
              <NavLink to="/docs" role="menuitem" onClick={closeMenu} className={classicTabClass}>
                Docs
              </NavLink>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenu()
                  setSettingsOpen(true)
                }}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm font-medium text-unison-text-secondary transition-colors hover:bg-unison-bg-hover hover:text-unison-text"
              >
                <IconSettings className="size-4" stroke={1.5} />
                Settings
              </button>
            </nav>
            <div className="flex items-center justify-end border-t border-unison-border pt-2">
              <SignInControl />
            </div>
          </div>
        ) : null}
      </header>
    )
  }

  return (
    <header
      ref={headerRef}
      className={cn(
        "top-0 z-10",
        width === "wide"
          ? "sticky bg-[rgba(15,14,19,0.28)] shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)] backdrop-blur-[20px] backdrop-saturate-150"
          : "relative",
      )}
    >
      <div
        className={cn(
          "mx-auto flex items-center justify-between gap-4 py-4 lg:grid lg:grid-cols-[auto_auto_1fr_auto] lg:gap-6",
          pageWidthClass(width),
        )}
      >
        <Link
          to="/"
          aria-label="Unison home"
          className={cn(
            "flex items-center gap-2 transition-opacity hover:opacity-80 lg:justify-self-start",
            artTextShadowClass,
          )}
        >
          <BetterLyricsLogo size={20} />
          <span className="text-base font-semibold tracking-tight">Unison</span>
        </Link>
        <nav
          className={cn(
            "hidden items-center lg:flex lg:justify-self-start",
            glassClass,
            "gap-0.5 rounded-xl p-[3px]",
          )}
        >
          <NavTab to="/" end activeOverride={isFeedActive}>
            Feed
          </NavTab>
          <NavTab to="/curators">Leaderboard</NavTab>
          <CouncilNavLink className={deskTabClass} indicator={navPill} />
          <NavTab to="/translate">Translate</NavTab>
          <NavTab to="/submit">Submit</NavTab>
          <NavTab to="/docs">Docs</NavTab>
        </nav>
        <div className="hidden lg:flex lg:w-full lg:max-w-xs lg:justify-self-end">
          <SearchBar glass />
        </div>
        <div className="flex items-center gap-2 lg:justify-self-end">
          <div className="lg:hidden">
            <SearchBar compact glass />
          </div>
          <div className="hidden lg:block">
            <SignInControl glass />
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="group flex cursor-pointer rounded-md p-1.5 text-unison-text transition-colors hover:bg-unison-bg-hover lg:hidden"
          >
            <IconSwap
              swapped={menuOpen}
              from={<IconMenu2 className="size-full" stroke={1.5} />}
              to={<IconX className="size-full" stroke={1.5} />}
              className="size-5 opacity-70 transition-opacity group-hover:opacity-100"
            />
          </button>
        </div>
      </div>
      {menu.mounted ? (
        <div
          role="menu"
          data-origin="top-right"
          className={cn(
            popoverSurfaceClass,
            "t-dropdown absolute right-6 top-full mt-2 flex w-56 flex-col gap-2 rounded-2xl p-3 lg:hidden",
            menu.closing && "is-closing",
          )}
        >
          <nav className="flex flex-col gap-1">
            <NavLink
              to="/"
              end
              role="menuitem"
              onClick={closeMenu}
              className={() => newMobileTabClass({ isActive: isFeedActive })}
            >
              Feed
            </NavLink>
            <NavLink to="/curators" role="menuitem" onClick={closeMenu} className={newMobileTabClass}>
              Leaderboard
            </NavLink>
            <CouncilNavLink role="menuitem" onClick={closeMenu} className={newMobileTabClass} />
            <NavLink to="/translate" role="menuitem" onClick={closeMenu} className={newMobileTabClass}>
              Translate
            </NavLink>
            <NavLink to="/submit" role="menuitem" onClick={closeMenu} className={newMobileTabClass}>
              Submit
            </NavLink>
            <NavLink to="/docs" role="menuitem" onClick={closeMenu} className={newMobileTabClass}>
              Docs
            </NavLink>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu()
                setSettingsOpen(true)
              }}
              className="relative inline-flex h-[30px] items-center gap-2 rounded-[9px] px-2.5 text-sm font-medium text-(--ink-2) transition-colors hover:bg-white/[0.08] hover:text-unison-text"
            >
              <IconSettings className="size-4" stroke={1.5} />
              Settings
            </button>
          </nav>
          <div className="flex items-center justify-end border-t border-unison-border pt-2">
            <SignInControl />
          </div>
        </div>
      ) : null}
    </header>
  )
}
