import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useSession } from "@/auth/useSession"
import { submitLyrics } from "@/lib/api"
import { fetchVideoMetadata } from "@/lib/video-metadata"
import { getLanguageOptions, detectLyricsLanguage } from "@/lib/languages"
import { parseAndValidateLyrics, detectFormat } from "@/lib/lyrics-parser"
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer"
import { LyricsRenderer } from "@/components/LyricsRenderer"
import {
  IconSend,
  IconLoader2,
  IconAlertCircle,
  IconCheck,
  IconUpload,
  IconExternalLink,
  IconPlayerPlay,
  IconPlayerPause,
  IconMusic,
  IconAlertTriangle,
  IconSearch,
} from "@tabler/icons-react"
import { MetadataFinderModal, type SelectedMetadata } from "@/components/MetadataFinderModal"
import { searchAppleMusic } from "@/lib/apple-music"
import type { LyricsFormat, VariantFull } from "@/lib/types"

function extractVideoId(input: string): string {
  const trimmed = input.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed
  const urlMatch = trimmed.match(/(?:v=|\/embed\/|\.be\/|\/v\/|watch\?v=|\/shorts\/)([a-zA-Z0-9_-]{11})/)
  return urlMatch ? urlMatch[1] : trimmed
}

export function SubmitPage() {
  const session = useSession()
  const signedIn = session.status === "signed-in"
  const navigate = useNavigate()

  const [song, setSong] = useState("")
  const [artist, setArtist] = useState("")
  const [album, setAlbum] = useState("")
  const [duration, setDuration] = useState<number | "">("")
  const [videoIdInput, setVideoIdInput] = useState("")
  const [isrc, setIsrc] = useState("")
  const [language, setLanguage] = useState("en")
  const [formatChoice, setFormatChoice] = useState<LyricsFormat | "auto">("auto")
  const [lyricsText, setLyricsText] = useState("")
  const [finderOpen, setFinderOpen] = useState(false)
  const [fetchingMetadata, setFetchingMetadata] = useState(false)
  const [matchedAppleTrack, setMatchedAppleTrack] = useState<string | null>(null)

  const [isDragOver, setIsDragOver] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; hint?: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const languages = useMemo(() => getLanguageOptions(), [])
  const cleanVideoId = useMemo(() => extractVideoId(videoIdInput), [videoIdInput])
  const isValidVideoId = useMemo(() => /^[a-zA-Z0-9_-]{11}$/.test(cleanVideoId), [cleanVideoId])

  // Validation & format parsing
  const validation = useMemo(() => parseAndValidateLyrics(lyricsText), [lyricsText])
  const activeFormat: LyricsFormat = formatChoice === "auto" ? validation.format : formatChoice

  // YouTube Player for synchronized playback
  const { ref: playerRef, getCurrentTime, getPlaying, seekTo, play, pause } = useYouTubePlayer(
    isValidVideoId ? cleanVideoId : null,
    { playerVars: { autoplay: 0 } }
  )

  const [isPlaying, setIsPlaying] = useState(false)
  useEffect(() => {
    const timer = setInterval(() => {
      setIsPlaying(getPlaying())
    }, 250)
    return () => clearInterval(timer)
  }, [getPlaying])

  // Auto-fetch metadata from YouTube and match with Apple Music
  useEffect(() => {
    if (!isValidVideoId) {
      setMatchedAppleTrack(null)
      return
    }

    // If user or uploaded file already filled song and artist, do not auto-match Apple Music
    if (song.trim() && artist.trim()) {
      return
    }

    let cancelled = false
    setFetchingMetadata(true)

    fetchVideoMetadata(cleanVideoId)
      .then(async (ytMeta) => {
        if (cancelled || !ytMeta) return
        const ytSong = ytMeta.song || ""
        const ytArtist = ytMeta.artist || ""

        // If metadata was already provided, skip
        if (song.trim() && artist.trim()) return

        // Set baseline from YT
        setSong((prev) => (prev ? prev : ytSong))
        setArtist((prev) => (prev ? prev : ytArtist))

        // Search Apple Music catalog with YouTube title & artist
        const searchQuery = [ytSong, ytArtist].filter(Boolean).join(" ")
        if (searchQuery) {
          try {
            const appleResults = await searchAppleMusic(searchQuery)
            if (cancelled) return

            if (appleResults && appleResults.length > 0) {
              const bestMatch = appleResults[0].attributes
              setSong(bestMatch.name)
              setArtist(bestMatch.artistName)
              if (bestMatch.albumName) setAlbum(bestMatch.albumName)
              if (bestMatch.durationInMillis) {
                setDuration(Math.round(bestMatch.durationInMillis / 1000))
              }
              if (bestMatch.isrc) setIsrc(bestMatch.isrc)
              setMatchedAppleTrack(`${bestMatch.name} · ${bestMatch.artistName}`)
            }
          } catch (e) {
            console.error("Apple Music auto-match error:", e)
          }
        }
      })
      .finally(() => {
        if (!cancelled) setFetchingMetadata(false)
      })

    return () => {
      cancelled = true
    }
  }, [cleanVideoId, isValidVideoId])

  // Auto-detect language from lyrics
  useEffect(() => {
    if (!lyricsText) return
    const detected = detectLyricsLanguage(lyricsText)
    if (detected && language === "en") {
      setLanguage(detected)
    }
  }, [lyricsText, language])

  // Process file upload
  const processUploadedFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = (event.target?.result as string) || ""
      setLyricsText(content)

      const parsed = parseAndValidateLyrics(content)
      if (parsed.extractedMeta.song && !song) setSong(parsed.extractedMeta.song)
      if (parsed.extractedMeta.artist && !artist) setArtist(parsed.extractedMeta.artist)
      if (parsed.extractedMeta.album && !album) setAlbum(parsed.extractedMeta.album)
      if (parsed.extractedMeta.duration && !duration) setDuration(parsed.extractedMeta.duration)
    }
    reader.readAsText(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processUploadedFile(file)
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processUploadedFile(file)
  }

  // Composer Link
  const composerUrl = useMemo(() => {
    const url = new URL("https://composer.betterlyrics.org/")
    if (song) url.searchParams.set("title", song)
    if (artist) url.searchParams.set("artist", artist)
    if (album) url.searchParams.set("album", album)
    if (duration) url.searchParams.set("duration", String(duration))
    if (cleanVideoId) url.searchParams.set("videoId", cleanVideoId)
    if (isrc) url.searchParams.set("isrc", isrc)
    return url.toString()
  }, [song, artist, album, duration, cleanVideoId, isrc])

  // Transient variant object for Braccato preview
  const previewVariant: VariantFull = useMemo(() => {
    return {
      id: 0,
      videoId: isValidVideoId ? cleanVideoId : "",
      song: song || "Preview Song",
      artist: artist || "Preview Artist",
      album: album || undefined,
      duration: typeof duration === "number" ? duration : 0,
      format: activeFormat,
      syncType: activeFormat === "ttml" ? "richsync" : activeFormat === "lrc" ? "linesync" : "plain",
      language,
      score: 0,
      effectiveScore: 0,
      voteCount: 0,
      confidence: "medium",
      createdAt: Date.now(),
      hidden: false,
      lyrics: lyricsText || "[00:00.00]Paste, type, or drop lyrics to preview synchronized playback.",
      userVote: null,
    }
  }, [isValidVideoId, cleanVideoId, song, artist, album, duration, activeFormat, language, lyricsText])

  const handleLineClick = useCallback(
    (seconds: number) => {
      seekTo(seconds)
      play()
    },
    [seekTo, play]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signedIn) {
      setFeedback({
        type: "error",
        title: "Sign in required",
        hint: "Please sign in via the top-right button to submit lyrics with your account.",
      })
      return
    }

    if (!song.trim() || !artist.trim() || !isValidVideoId || !lyricsText.trim()) {
      setFeedback({
        type: "error",
        title: "Please fill all required fields",
        hint: "Song title, artist name, YouTube video/audio ID, and lyrics content are required.",
      })
      return
    }

    try {
      setSubmitting(true)
      setFeedback(null)

      const payload = {
        song: song.trim(),
        artist: artist.trim(),
        album: album.trim() || undefined,
        videoId: cleanVideoId,
        isrc: isrc.trim() || undefined,
        duration: typeof duration === "number" ? duration : 0,
        language: language || undefined,
        format: activeFormat,
        lyrics: lyricsText.trim(),
      }

      await submitLyrics(payload)
      setFeedback({
        type: "success",
        title: "Lyrics submitted successfully!",
        hint: "Redirecting to lyrics view...",
      })
      setTimeout(() => {
        navigate(`/song/${cleanVideoId}`)
      }, 1200)
    } catch (err) {
      setFeedback({
        type: "error",
        title: "Submission failed",
        hint: err instanceof Error ? err.message : "Failed to submit lyrics.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleMetadataSelect = (meta: SelectedMetadata) => {
    if (meta.song) setSong(meta.song)
    if (meta.artist) setArtist(meta.artist)
    if (meta.album) setAlbum(meta.album)
    if (meta.duration) setDuration(meta.duration)
    if (meta.isrc) setIsrc(meta.isrc)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-unison-border pb-4 gap-2">
        <div>
          <h1 className="text-xl font-bold text-unison-text">Submit Lyrics</h1>
          <p className="text-xs text-unison-text-secondary mt-0.5">
            Submit synced LRC, TTML, or plain lyrics to the Unison repository.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInput}
            accept=".lrc,.ttml,.txt,.xml,text/plain"
            className="hidden"
            aria-label="Upload lyrics file"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-unison-border bg-unison-bg-elevated px-3 py-1.5 text-xs font-medium text-unison-text transition-colors hover:border-unison-border-strong hover:bg-unison-bg-hover cursor-pointer"
          >
            <IconUpload className="size-3.5 text-unison-text-secondary" />
            <span>Upload File (.lrc / .ttml / .txt)</span>
          </button>
        </div>
      </div>

      <MetadataFinderModal
        isOpen={finderOpen}
        initialQuery={[song, artist].filter(Boolean).join(" ")}
        onClose={() => setFinderOpen(false)}
        onSelect={handleMetadataSelect}
      />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Form: Fields & Lyrics Textarea (7 cols) */}
        <div className="lg:col-span-7 space-y-3.5">
          {/* 1. YouTube Video / Audio Track (Top Field) */}
          <div className="rounded-xl border border-unison-border bg-unison-bg-elevated p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-unison-text flex items-center gap-1.5">
                YouTube Video or Audio URL / ID <span className="text-red-500">*</span>
              </span>
              {fetchingMetadata && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-unison-text-secondary">
                  <IconLoader2 className="size-3.5 animate-spin text-unison-text-secondary" />
                  <span>Matching catalog...</span>
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={videoIdInput}
              onChange={(e) => setVideoIdInput(e.target.value)}
              placeholder="Paste YouTube or YouTube Music URL, or 11-character video ID..."
              className="w-full font-mono rounded-lg border border-unison-border bg-unison-bg px-3 py-2 text-xs text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none"
            />

            {/* Auto-match status banner / helper */}
            {matchedAppleTrack ? (
              <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-[11px] text-emerald-300">
                <div className="flex items-center gap-1.5 truncate">
                  <IconCheck className="size-3.5 shrink-0 text-emerald-400" />
                  <span className="truncate">Auto-matched with Apple Music: <strong>{matchedAppleTrack}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => setFinderOpen(true)}
                  className="shrink-0 ml-2 text-xs text-emerald-400 underline hover:text-emerald-200 cursor-pointer"
                >
                  Change match
                </button>
              </div>
            ) : isValidVideoId && !fetchingMetadata ? (
              <div className="flex items-center justify-between text-[11px] text-unison-text-muted px-1">
                <span>Loaded video: {cleanVideoId}</span>
                <button
                  type="button"
                  onClick={() => setFinderOpen(true)}
                  className="text-unison-text-secondary hover:text-unison-text flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <IconSearch className="size-3" />
                  <span>Match Apple Music</span>
                </button>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-unison-text-secondary">
                Song <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                required
                value={song}
                onChange={(e) => setSong(e.target.value)}
                placeholder="Song title"
                className="w-full rounded-lg border border-unison-border bg-unison-bg-elevated px-3 py-2 text-xs text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-unison-text-secondary">
                Artist <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                required
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Artist name"
                className="w-full rounded-lg border border-unison-border bg-unison-bg-elevated px-3 py-2 text-xs text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-unison-text-secondary">Album</span>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                placeholder="Album name (Optional)"
                className="w-full rounded-lg border border-unison-border bg-unison-bg-elevated px-3 py-2 text-xs text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-unison-text-secondary">Language</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                aria-label="Language selection"
                className="w-full rounded-lg border border-unison-border bg-unison-bg-elevated px-3 py-2 text-xs text-unison-text focus:border-unison-border-strong focus:outline-none"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* 3-col Row for Duration, ISRC, Format */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-unison-text-secondary">
                Duration <span className="text-[10px] text-unison-text-muted font-normal">(sec)</span>
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : "")}
                placeholder="e.g. 210"
                className="w-full font-mono rounded-lg border border-unison-border bg-unison-bg-elevated px-3 py-2 text-xs text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-unison-text-secondary">
                ISRC <span className="text-[10px] text-unison-text-muted font-normal">(Optional)</span>
              </span>
              <input
                type="text"
                value={isrc}
                onChange={(e) => setIsrc(e.target.value)}
                placeholder="e.g. USUM71607007"
                className="w-full font-mono rounded-lg border border-unison-border bg-unison-bg-elevated px-3 py-2 text-xs text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-unison-text-secondary">Format</span>
              <select
                value={formatChoice}
                onChange={(e) => setFormatChoice(e.target.value as LyricsFormat | "auto")}
                aria-label="Format selection"
                className="w-full rounded-lg border border-unison-border bg-unison-bg-elevated px-3 py-2 text-xs text-unison-text focus:border-unison-border-strong focus:outline-none"
              >
                <option value="auto">Auto ({validation.format.toUpperCase()})</option>
                <option value="lrc">LRC</option>
                <option value="ttml">TTML</option>
                <option value="plain">Plain Text</option>
              </select>
            </label>
          </div>

          {/* Lyrics Content & Dropzone */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-unison-text-secondary">
                Lyrics Content <span className="text-red-500">*</span>
              </span>
              <div className="flex items-center gap-2 text-[10px] text-unison-text-muted font-mono">
                <span>{validation.lineCount} lines ({validation.timedLineCount} timed)</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 uppercase font-bold text-unison-text">
                  {activeFormat}
                </span>
              </div>
            </div>
            <textarea
              required
              rows={15}
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              placeholder="Paste synced LRC, rich TTML, or plain lyrics here, or drop a .lrc / .ttml file..."
              className={`w-full font-mono text-xs leading-relaxed rounded-lg border bg-unison-bg-elevated p-3 text-unison-text placeholder:text-unison-text-muted focus:border-unison-border-strong focus:outline-none transition-colors ${
                isDragOver ? "border-indigo-500 bg-indigo-500/10" : "border-unison-border"
              }`}
              spellCheck={false}
            />
          </div>

          {/* Validation Warnings */}
          {validation.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-[11px] text-amber-300 space-y-1">
              {validation.warnings.map((w, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <IconAlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-400" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div
              className={`flex items-start gap-2.5 rounded-lg p-3 text-xs ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-300 border border-red-500/20"
              }`}
            >
              {feedback.type === "success" ? (
                <IconCheck className="size-4 shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <IconAlertCircle className="size-4 shrink-0 mt-0.5 text-red-400" />
              )}
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">{feedback.title}</span>
                {feedback.hint && <span className="opacity-80 text-[11px]">{feedback.hint}</span>}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-1">
            <a
              href={composerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-unison-border bg-unison-bg-elevated px-3 py-2 text-xs text-unison-text-secondary transition-colors hover:border-unison-border-strong hover:bg-unison-bg-hover hover:text-unison-text"
            >
              <IconExternalLink className="size-3.5" />
              <span>Create in Composer</span>
            </a>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2 text-xs font-semibold text-white shadow transition-colors hover:bg-red-500 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconSend className="size-3.5" />}
              Submit Lyrics
            </button>
          </div>
        </div>

        {/* Right Column: Braccato Live Lyrics Reader & Audio/Playback Sync (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-unison-border pb-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-unison-text-muted">
              Live Preview
            </span>
            <span className="text-[11px] text-unison-text-muted">Click lines to seek</span>
          </div>

          {/* Sleek Compact Player & Transport Bar (Works for MV & Audio Topic Tracks) */}
          <div className="rounded-xl border border-unison-border bg-unison-bg-elevated p-3 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="size-7 rounded-md bg-white/5 border border-unison-border flex items-center justify-center shrink-0">
                  <IconMusic className="size-4 text-unison-text-secondary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-unison-text truncate">{song || "Track Preview"}</p>
                  <p className="text-[11px] text-unison-text-muted truncate">{artist || "Enter Video/Audio ID"}</p>
                </div>
              </div>

              {/* Play/Pause Button */}
              {isValidVideoId && (
                <button
                  type="button"
                  onClick={() => {
                    if (isPlaying) pause()
                    else play()
                  }}
                  className="rounded-full bg-white/10 hover:bg-white/20 p-2 text-unison-text transition-colors cursor-pointer shrink-0"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <IconPlayerPause className="size-4" /> : <IconPlayerPlay className="size-4" />}
                </button>
              )}
            </div>

            {/* Hidden / Tiny Video Embed (Runs audio/video in background without eating vertical space) */}
            <div className={`overflow-hidden rounded-lg border border-unison-border/40 bg-black transition-all ${
              isValidVideoId ? "h-28 w-full" : "hidden"
            }`}>
              <div className="size-full" ref={playerRef} />
            </div>
          </div>

          {/* Full-Height Braccato Synchronized Reader */}
          <div className="relative flex-1 min-h-[480px] rounded-xl border border-unison-border bg-unison-bg-elevated p-4 overflow-hidden shadow-sm">
            {lyricsText.trim().length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-unison-text-muted text-center space-y-2">
                <IconMusic className="size-8 opacity-30" />
                <p className="text-xs">Paste lyrics or drop a file to preview synchronized reader.</p>
              </div>
            ) : (
              <LyricsRenderer
                variant={previewVariant}
                getCurrentTime={getCurrentTime}
                getPlaying={getPlaying}
                onLineClick={handleLineClick}
              />
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
