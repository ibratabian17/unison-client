import { IconMusic } from "@tabler/icons-react"
import { useArtwork } from "@/lib/artwork"
import { cn } from "@/lib/cn"
import { useState } from "react"

export function AlbumArt({ videoId, className }: { videoId: string; className?: string }) {
  const { data: url } = useArtwork(videoId)
  const [failed, setFailed] = useState(false)

  if (url && !failed) {
    return (
      <img
        key={`${videoId}-${url}`}
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn("size-full object-cover", className)}
      />
    )
  }
  return <IconMusic className="size-6 text-unison-text opacity-50" stroke={1.5} />
}
