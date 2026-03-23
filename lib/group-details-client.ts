"use client";

import { apiUrl } from "@/lib/apiUrl";

export interface ClientGroupMember {
  id: string;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  userImage?: string | null;
  role?: "instructor" | "member";
}

export interface ClientGroupDetails {
  group?: {
    name?: string | null;
    joinKey?: string | null;
  } | null;
  members?: ClientGroupMember[];
}

export interface ClientActiveGroupInstance {
  groupId: string;
  instanceId: string;
  name: string;
  memberNames: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ClientActiveIndividualInstance {
  instanceId: string;
  userId: string;
  displayName: string | null;
  userEmail: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const GROUP_DETAILS_TTL_MS = 5000;

const groupDetailsCache = new Map<string, { expiresAt: number; value: ClientGroupDetails }>();
const groupDetailsInflight = new Map<string, Promise<ClientGroupDetails>>();
const activeGameGroupsCache = new Map<string, { expiresAt: number; value: ClientActiveGroupInstance[] }>();
const activeGameGroupsInflight = new Map<string, Promise<ClientActiveGroupInstance[]>>();
const activeGameIndividualsCache = new Map<string, { expiresAt: number; value: ClientActiveIndividualInstance[] }>();
const activeGameIndividualsInflight = new Map<string, Promise<ClientActiveIndividualInstance[]>>();

interface FetchGroupDetailsOptions {
  gameId?: string | null;
  preferCreatorAccess?: boolean;
}

function getGroupDetailsCacheKey(groupId: string, options?: FetchGroupDetailsOptions): string {
  if (options?.preferCreatorAccess && options.gameId) {
    return `creator:${options.gameId}:${groupId}`;
  }
  return `member:${groupId}`;
}

function getGroupDetailsUrl(groupId: string, options?: FetchGroupDetailsOptions): string {
  if (options?.preferCreatorAccess && options.gameId) {
    return apiUrl(`/api/games/${options.gameId}/groups/${groupId}`);
  }
  return apiUrl(`/api/groups/${groupId}`);
}

export async function fetchGroupDetailsCached(
  groupId: string,
  options?: FetchGroupDetailsOptions,
): Promise<ClientGroupDetails> {
  const now = Date.now();
  const cacheKey = getGroupDetailsCacheKey(groupId, options);
  const cached = groupDetailsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const inflight = groupDetailsInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const request = fetch(getGroupDetailsUrl(groupId, options))
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to load group details");
      }
      const data = await response.json();
      const value = data as ClientGroupDetails;
      groupDetailsCache.set(cacheKey, {
        expiresAt: Date.now() + GROUP_DETAILS_TTL_MS,
        value,
      });
      return value;
    })
    .finally(() => {
      groupDetailsInflight.delete(cacheKey);
    });

  groupDetailsInflight.set(cacheKey, request);
  return request;
}

export function clearGroupDetailsCache(groupId?: string): void {
  if (groupId) {
    for (const key of Array.from(groupDetailsCache.keys())) {
      if (key.endsWith(`:${groupId}`) || key === `member:${groupId}`) {
        groupDetailsCache.delete(key);
      }
    }
    for (const key of Array.from(groupDetailsInflight.keys())) {
      if (key.endsWith(`:${groupId}`) || key === `member:${groupId}`) {
        groupDetailsInflight.delete(key);
      }
    }
    return;
  }

  groupDetailsCache.clear();
  groupDetailsInflight.clear();
}

export async function fetchActiveGameGroupsCached(gameId: string): Promise<ClientActiveGroupInstance[]> {
  const now = Date.now();
  const cached = activeGameGroupsCache.get(gameId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const inflight = activeGameGroupsInflight.get(gameId);
  if (inflight) {
    return inflight;
  }

  const request = fetch(apiUrl(`/api/games/${gameId}/groups`))
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load active groups");
      }
      const value = Array.isArray(payload.groups) ? (payload.groups as ClientActiveGroupInstance[]) : [];
      activeGameGroupsCache.set(gameId, {
        expiresAt: Date.now() + GROUP_DETAILS_TTL_MS,
        value,
      });
      return value;
    })
    .finally(() => {
      activeGameGroupsInflight.delete(gameId);
    });

  activeGameGroupsInflight.set(gameId, request);
  return request;
}

export async function fetchActiveGameIndividualsCached(gameId: string): Promise<ClientActiveIndividualInstance[]> {
  const now = Date.now();
  const cached = activeGameIndividualsCache.get(gameId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const inflight = activeGameIndividualsInflight.get(gameId);
  if (inflight) {
    return inflight;
  }

  const request = fetch(apiUrl(`/api/games/${gameId}/individuals`))
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load individual instances");
      }
      const value = Array.isArray(payload.individuals) ? (payload.individuals as ClientActiveIndividualInstance[]) : [];
      activeGameIndividualsCache.set(gameId, {
        expiresAt: Date.now() + GROUP_DETAILS_TTL_MS,
        value,
      });
      return value;
    })
    .finally(() => {
      activeGameIndividualsInflight.delete(gameId);
    });

  activeGameIndividualsInflight.set(gameId, request);
  return request;
}
