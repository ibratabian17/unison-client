const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export const tokenMs = (name: string, fallback: number) => {
  const raw = token(name)
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value) || value <= 0) return fallback
  return raw.endsWith("ms") ? value : raw.endsWith("s") ? value * 1000 : value
}

export const tokenValue = (name: string, fallback: string) => token(name) || fallback
