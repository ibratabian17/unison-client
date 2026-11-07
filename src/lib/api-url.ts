export const API_BASE = "https://unison.betterlyrics.org"

export function resolveApiPath(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`
}
