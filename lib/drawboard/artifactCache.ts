import { apiUrl } from "@/lib/apiUrl";
import type { DrawboardCaptureMode } from "@/lib/gameRuntimeConfig";

export type DrawboardArtifactType = "drawing" | "solution" | "solution-step";

export type DrawboardArtifactDescriptor = {
  version: "v1";
  captureMode: DrawboardCaptureMode;
  artifactType: DrawboardArtifactType;
  fingerprint: string;
  gameId?: string | null;
  levelIdentifier?: string | null;
  levelName?: string | null;
  scenarioId: string;
  stepId?: string | null;
  platformBucket?: string | null;
  width: number;
  height: number;
};

export type DrawboardArtifactRecord = DrawboardArtifactDescriptor & {
  key: string;
  dataUrl: string;
  pixelBufferBase64?: string;
  createdAt: string;
};

const LOCAL_STORAGE_PREFIX = "drawboard-artifact-cache:v1:";
const LOCAL_STORAGE_INDEX_KEY = `${LOCAL_STORAGE_PREFIX}__index__`;
const LOCAL_STORAGE_MAX_ITEMS = 48;

function stableHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    h1 ^= code;
    h1 = Math.imul(h1, 16777619);
    h2 ^= code;
    h2 = Math.imul(h2, 2246822519);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeField(value: string | null | undefined, fallback = "none"): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function buildArtifactKey(descriptor: DrawboardArtifactDescriptor): string {
  const visibilityBucket =
    descriptor.captureMode === "browser"
      ? normalizeField(descriptor.platformBucket, "platform-unknown")
      : "server-shared";
  const raw = [
    descriptor.version,
    descriptor.captureMode,
    descriptor.artifactType,
    descriptor.fingerprint,
    normalizeField(descriptor.gameId),
    normalizeField(descriptor.levelIdentifier),
    normalizeField(descriptor.levelName),
    descriptor.scenarioId,
    normalizeField(descriptor.stepId),
    visibilityBucket,
    String(descriptor.width),
    String(descriptor.height),
  ].join("|");
  return stableHash(raw);
}

export function hashArtifactFingerprint(parts: Array<string | number | null | undefined>): string {
  return stableHash(parts.map((value) => String(value ?? "")).join("\u0000"));
}

function localStorageKey(key: string): string {
  return `${LOCAL_STORAGE_PREFIX}${key}`;
}

function readIndex(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_INDEX_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeIndex(index: string[]): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(LOCAL_STORAGE_INDEX_KEY, JSON.stringify(index));
  } catch {
    // Ignore storage failures in constrained environments.
  }
}

function pruneOldestEntries(index: string[]): string[] {
  if (typeof window === "undefined" || index.length <= LOCAL_STORAGE_MAX_ITEMS) {
    return index;
  }
  const next = [...index];
  while (next.length > LOCAL_STORAGE_MAX_ITEMS) {
    const oldestKey = next.shift();
    if (!oldestKey) {
      break;
    }
    try {
      window.localStorage.removeItem(localStorageKey(oldestKey));
    } catch {
      break;
    }
  }
  return next;
}

export function persistLocalArtifact(record: DrawboardArtifactRecord): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(localStorageKey(record.key), JSON.stringify(record));
    const currentIndex = readIndex().filter((entry) => entry !== record.key);
    currentIndex.push(record.key);
    writeIndex(pruneOldestEntries(currentIndex));
  } catch {
    // Ignore quota/storage errors; Redis remains the shared source of truth.
  }
}

export function removeLocalArtifactsMatching(
  predicate: (record: DrawboardArtifactRecord) => boolean,
): void {
  if (typeof window === "undefined") {
    return;
  }
  const index = readIndex();
  const kept: string[] = [];
  for (const key of index) {
    try {
      const raw = window.localStorage.getItem(localStorageKey(key));
      if (!raw) {
        continue;
      }
      const parsed = JSON.parse(raw) as DrawboardArtifactRecord;
      if (predicate(parsed)) {
        window.localStorage.removeItem(localStorageKey(key));
        continue;
      }
      kept.push(key);
    } catch {
      window.localStorage.removeItem(localStorageKey(key));
    }
  }
  writeIndex(kept);
}

export function readLocalArtifact(descriptor: DrawboardArtifactDescriptor): DrawboardArtifactRecord | null {
  if (typeof window === "undefined") {
    return null;
  }
  const key = buildArtifactKey(descriptor);
  try {
    const raw = window.localStorage.getItem(localStorageKey(key));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as DrawboardArtifactRecord;
    if (parsed?.fingerprint !== descriptor.fingerprint) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function toQueryString(descriptor: DrawboardArtifactDescriptor): string {
  const params = new URLSearchParams();
  params.set("version", descriptor.version);
  params.set("captureMode", descriptor.captureMode);
  params.set("artifactType", descriptor.artifactType);
  params.set("fingerprint", descriptor.fingerprint);
  params.set("scenarioId", descriptor.scenarioId);
  params.set("width", String(descriptor.width));
  params.set("height", String(descriptor.height));
  if (descriptor.gameId) params.set("gameId", descriptor.gameId);
  if (descriptor.levelIdentifier) params.set("levelIdentifier", descriptor.levelIdentifier);
  if (descriptor.levelName) params.set("levelName", descriptor.levelName);
  if (descriptor.stepId) params.set("stepId", descriptor.stepId);
  if (descriptor.platformBucket) params.set("platformBucket", descriptor.platformBucket);
  return params.toString();
}

export async function fetchRemoteArtifact(
  descriptor: DrawboardArtifactDescriptor,
): Promise<DrawboardArtifactRecord | null> {
  const response = await fetch(apiUrl(`/api/drawboard/artifacts?${toQueryString(descriptor)}`), {
    method: "GET",
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Artifact fetch failed: ${response.status}`);
  }
  const json = (await response.json()) as DrawboardArtifactRecord;
  if (!json?.dataUrl) {
    return null;
  }
  return json;
}

export async function uploadRemoteArtifact(record: DrawboardArtifactRecord): Promise<void> {
  await fetch(apiUrl("/api/drawboard/artifacts"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(record),
  });
}
