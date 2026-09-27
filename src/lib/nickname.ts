import { authedFetch } from "@/lib/authedFetch"

export interface AvailabilityResponse {
  available: boolean
  reason?: "INVALID_FORMAT" | "TAKEN" | "SELF"
}

export interface NicknameMutationResponse {
  keyId: string
  displayName: string
}

export const PUBLIC_COMMUNITY_KEY_ID = "cea10b57de8e060ed1a180a00c2bc717a2ab4f231d88fd33ffa6a50a04f23b6e"

export function isPublicAccount(keyId?: string | null): boolean {
  return keyId === PUBLIC_COMMUNITY_KEY_ID
}

export async function checkNicknameAvailability(nickname: string): Promise<AvailabilityResponse> {
  return authedFetch<AvailabilityResponse>("/auth/nickname/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nickname }),
  })
}

export async function putNickname(nickname: string): Promise<NicknameMutationResponse> {
  return authedFetch<NicknameMutationResponse>("/auth/nickname", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nickname }),
  })
}

export async function deleteNickname(): Promise<NicknameMutationResponse> {
  return authedFetch<NicknameMutationResponse>("/auth/nickname", { method: "DELETE" })
}
