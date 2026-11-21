import { IconBrandDiscordFilled, IconLoader2 } from "@tabler/icons-react"
import { DiscordConnectLock } from "@/components/discord-ui"
import { chipClass } from "@/components/ui"
import type { DiscordLink } from "@/hooks/useDiscordLink"
import { cn } from "@/lib/cn"

export function DiscordChip({ id, username }: { id: string; username: string }) {
  return (
    <a
      href={`https://discord.com/users/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Open Discord profile"
      className={cn(chipClass, "t-reveal gap-[9px] pl-1")}
    >
      <span className="grid size-[22px] place-items-center rounded-md bg-[#5865f2] text-white [corner-shape:superellipse(1.6)]">
        <IconBrandDiscordFilled className="size-3.5" />
      </span>
      {username}
    </a>
  )
}

export function DiscordConnectChip({ link }: { link: DiscordLink }) {
  return (
    <DiscordConnectLock locked={!link.canConnect}>
      <button
        type="button"
        onClick={link.canConnect ? link.connect : undefined}
        disabled={link.connecting}
        aria-disabled={!link.canConnect}
        className={cn(
          chipClass,
          "t-reveal gap-[9px] pl-1 aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
        )}
      >
        <span className="grid size-[22px] place-items-center rounded-md bg-[#5865f2] text-white [corner-shape:superellipse(1.6)]">
          {link.connecting ? (
            <IconLoader2 className="size-3.5 animate-spin" stroke={2} />
          ) : (
            <IconBrandDiscordFilled className="size-3.5" />
          )}
        </span>
        {link.connecting ? "Connecting…" : "Connect Discord"}
      </button>
    </DiscordConnectLock>
  )
}
