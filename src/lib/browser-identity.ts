import type { SignedBody } from "./auth"
import { loadStoredSession } from "./auth"
import { canonicalJson } from "./canonical-json"

const ECDSA_P256 = { name: "ECDSA", namedCurve: "P-256" } as const
const ECDSA_SHA256 = { name: "ECDSA", hash: "SHA-256" } as const
const STORAGE_KEY = "unison.browser.identity.v1"
const KEY_PREFIX = "unison.identity."

export interface BrowserIdentity {
  version: 1
  keyId: string
  publicKey: JsonWebKey
  privateKey: JsonWebKey
  createdAt: number
}

function toBase64(buffer: ArrayBuffer): string {
  let binary = ""
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export const DEFAULT_IDENTITY = {
  version: 1,
  keyId: "cea10b57de8e060ed1a180a00c2bc717a2ab4f231d88fd33ffa6a50a04f23b6e",
  publicKey: {
    crv: "P-256",
    ext: true,
    key_ops: ["verify"],
    kty: "EC",
    x: "FyXkTGfDo1ySYc8VOoSoXLxJ7b1shp9nPv4NDwPDvy4",
    y: "9DrxMD9jEhSo1tqOZf1k8x6DinRC9V2T4yB3FkwOGjI",
  },
  privateKey: {
    crv: "P-256",
    d: "zzKTmI4DoeL_Mlib0QEpLLJe3RdzIR3gNbrmL1ffTkM",
    ext: true,
    key_ops: ["sign"],
    kty: "EC",
    x: "FyXkTGfDo1ySYc8VOoSoXLxJ7b1shp9nPv4NDwPDvy4",
    y: "9DrxMD9jEhSo1tqOZf1k8x6DinRC9V2T4yB3FkwOGjI",
  },
  displayName: "Public Account",
  exportedAt: 1774034657074,
} as const

export function saveActiveBrowserIdentity(identity: {
  keyId: string
  publicKey: JsonWebKey
  privateKey: JsonWebKey
}): void {
  const full: BrowserIdentity = {
    version: 1,
    keyId: identity.keyId,
    publicKey: identity.publicKey,
    privateKey: identity.privateKey,
    createdAt: Date.now(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(full))
  if (identity.keyId !== DEFAULT_IDENTITY.keyId) {
    localStorage.setItem(`${KEY_PREFIX}${identity.keyId}`, JSON.stringify(full))
  }
}

export function clearActiveBrowserIdentity(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BrowserIdentity>
      if (parsed?.keyId === DEFAULT_IDENTITY.keyId) {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function hasSigningKeyFor(keyId: string): boolean {
  if (keyId === DEFAULT_IDENTITY.keyId) return true
  const dedicated = localStorage.getItem(`${KEY_PREFIX}${keyId}`)
  if (dedicated) {
    try {
      const p = JSON.parse(dedicated)
      if (p?.keyId === keyId && p.privateKey) return true
    } catch {}
  }
  const general = localStorage.getItem(STORAGE_KEY)
  if (general) {
    try {
      const p = JSON.parse(general)
      if (p?.keyId === keyId && p.privateKey) return true
    } catch {}
  }
  return false
}

export async function getActiveSigningIdentity(): Promise<{
  keyId: string
  publicKey: JsonWebKey
  privateKey: JsonWebKey
}> {
  const session = loadStoredSession()

  // Case 1: If session is explicitly the Public Account
  if (session && session.keyId === DEFAULT_IDENTITY.keyId) {
    return DEFAULT_IDENTITY as unknown as { keyId: string; publicKey: JsonWebKey; privateKey: JsonWebKey }
  }

  // Case 2: If session is logged in as a specific account, find its dedicated signing key
  if (session && session.keyId) {
    const dedicated = localStorage.getItem(`${KEY_PREFIX}${session.keyId}`)
    if (dedicated) {
      try {
        const parsed = JSON.parse(dedicated) as BrowserIdentity
        if (parsed?.keyId === session.keyId && parsed.privateKey) {
          return parsed
        }
      } catch {}
    }

    const general = localStorage.getItem(STORAGE_KEY)
    if (general) {
      try {
        const parsed = JSON.parse(general) as BrowserIdentity
        if (parsed?.keyId === session.keyId && parsed.privateKey) {
          return parsed
        }
      } catch {}
    }

    // Never silently fall back to DEFAULT_IDENTITY (Public Account) when signed into a personal account
    throw new Error(
      `Signed in as ${session.displayName || session.keyId.slice(0, 8) + "…"}, but no local signing key was found for this session.`,
    )
  }

  // Case 3: If not logged in, check if a non-default stored key exists
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as BrowserIdentity
      if (parsed && parsed.keyId && parsed.privateKey && parsed.keyId !== DEFAULT_IDENTITY.keyId) {
        return parsed
      }
    } catch {}
  }

  // Fallback to Public Account only when signed out
  return DEFAULT_IDENTITY as unknown as { keyId: string; publicKey: JsonWebKey; privateKey: JsonWebKey }
}

export async function signChallengeWithDefaultIdentity(nonce: string): Promise<SignedBody> {
  const key = await crypto.subtle.importKey(
    "jwk",
    DEFAULT_IDENTITY.privateKey as unknown as JsonWebKey,
    ECDSA_P256,
    false,
    ["sign"],
  )
  const payload = {
    origin: window.location.origin,
    timestamp: Date.now(),
    nonce,
    keyId: DEFAULT_IDENTITY.keyId,
  }
  const signature = await crypto.subtle.sign(
    ECDSA_SHA256,
    key,
    new TextEncoder().encode(canonicalJson(payload)),
  )
  return {
    payload,
    signature: toBase64(signature),
    publicKey: DEFAULT_IDENTITY.publicKey,
  }
}

export async function signPayload(data: Record<string, unknown> = {}): Promise<SignedBody> {
  const identity = await getActiveSigningIdentity()
  const key = await crypto.subtle.importKey("jwk", identity.privateKey, ECDSA_P256, false, ["sign"])
  const nonce = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "")

  const payload = {
    ...data,
    keyId: identity.keyId,
    timestamp: Date.now(),
    nonce,
  }

  const signature = await crypto.subtle.sign(
    ECDSA_SHA256,
    key,
    new TextEncoder().encode(canonicalJson(payload)),
  )

  return {
    payload,
    signature: toBase64(signature),
    publicKey: identity.publicKey,
  }
}

export async function exportBrowserIdentityFile(): Promise<void> {
  const identity = await getActiveSigningIdentity()
  const exportPayload = {
    version: 1,
    keyId: identity.keyId,
    publicKey: identity.publicKey,
    privateKey: identity.privateKey,
    exportedAt: Date.now(),
  }
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `better-lyrics-identity-${identity.keyId.slice(0, 8)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
