"use client";

import { apiUrl } from "@/lib/apiUrl";

export interface ClientGroupDetails {
  group?: {
    name?: string | null;
    joinKey?: string | null;
  } | null;
  members?: Array<unknown>;
}

const GROUP_DETAILS_TTL_MS = 5000;

const groupDetailsCache = new Map<string, { expiresAt: number; value: ClientGroupDetails }>();
const groupDetailsInflight = new Map<string, Promise<ClientGroupDetails>>();

export async function fetchGroupDetailsCached(groupId: string): Promise<ClientGroupDetails> {
  const now = Date.now();
  const cached = groupDetailsCache.get(groupId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const inflight = groupDetailsInflight.get(groupId);
  if (inflight) {
    return inflight;
  }

  const request = fetch(apiUrl(`/api/groups/${groupId}`))
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to load group details");
      }
      const data = await response.json();
      const value = data as ClientGroupDetails;
      groupDetailsCache.set(groupId, {
        expiresAt: Date.now() + GROUP_DETAILS_TTL_MS,
        value,
      });
      return value;
    })
    .finally(() => {
      groupDetailsInflight.delete(groupId);
    });

  groupDetailsInflight.set(groupId, request);
  return request;
}

export function clearGroupDetailsCache(groupId?: string): void {
  if (groupId) {
    groupDetailsCache.delete(groupId);
    groupDetailsInflight.delete(groupId);
    return;
  }

  groupDetailsCache.clear();
  groupDetailsInflight.clear();
}
