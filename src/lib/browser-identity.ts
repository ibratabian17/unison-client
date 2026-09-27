import type { SignedBody } from "./auth"
import { canonicalJson } from "./canonical-json"

const ECDSA_P256 = { name: "ECDSA", namedCurve: "P-256" } as const
const ECDSA_SHA256 = { name: "ECDSA", hash: "SHA-256" } as const
const STORAGE_KEY = "unison.browser.identity.v1"

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

async function hashPublicKey(jwk: JsonWebKey): Promise<string> {
  const canonical = canonicalJson({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
}

export function getStoredBrowserIdentity(): BrowserIdentity {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as BrowserIdentity
      if (parsed && parsed.keyId && parsed.publicKey && parsed.privateKey) {
        return parsed
      }
    } catch {}
  }
  return DEFAULT_IDENTITY as unknown as BrowserIdentity
}

export async function signChallengeWithBrowserIdentity(nonce: string): Promise<SignedBody> {
  return signChallengeWithDefaultIdentity(nonce)
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
  displayName: "MysticSnareRise",
  exportedAt: 1774034657074,
} as const;

import { loadStoredSession } from "./auth"

export function saveActiveBrowserIdentity(identity: { keyId: string; publicKey: JsonWebKey; privateKey: JsonWebKey }): void {
  const full: BrowserIdentity = {
    version: 1,
    keyId: identity.keyId,
    publicKey: identity.publicKey,
    privateKey: identity.privateKey,
    createdAt: Date.now(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(full))
}

export async function getActiveSigningIdentity(): Promise<{ keyId: string; publicKey: JsonWebKey; privateKey: JsonWebKey }> {
  const session = loadStoredSession()
  const stored = localStorage.getItem(STORAGE_KEY)
  let parsed: BrowserIdentity | null = null
  if (stored) {
    try {
      parsed = JSON.parse(stored) as BrowserIdentity
    } catch {}
  }

  // If stored identity matches active session, use it
  if (session && parsed && parsed.keyId === session.keyId && parsed.privateKey) {
    return parsed
  }

  // If active session is the default identity, use default identity
  if (session && session.keyId === DEFAULT_IDENTITY.keyId) {
    return DEFAULT_IDENTITY as unknown as { keyId: string; publicKey: JsonWebKey; privateKey: JsonWebKey }
  }

  // If a stored identity exists, use it
  if (parsed && parsed.keyId && parsed.privateKey) {
    return parsed
  }

  // Fallback to DEFAULT_IDENTITY
  return DEFAULT_IDENTITY as unknown as { keyId: string; publicKey: JsonWebKey; privateKey: JsonWebKey }
}

export async function signChallengeWithDefaultIdentity(nonce: string): Promise<SignedBody> {
  saveActiveBrowserIdentity(DEFAULT_IDENTITY as unknown as BrowserIdentity)
  const key = await crypto.subtle.importKey("jwk", DEFAULT_IDENTITY.privateKey as unknown as JsonWebKey, ECDSA_P256, false, ["sign"])
  const payload = {
    origin: window.location.origin,
    timestamp: Date.now(),
    nonce,
    keyId: DEFAULT_IDENTITY.keyId,
  }
  const signature = await crypto.subtle.sign(
    ECDSA_SHA256,
    key,
    new TextEncoder().encode(canonicalJson(payload))
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
    new TextEncoder().encode(canonicalJson(payload))
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
