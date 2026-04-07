import type { DrawboardArtifactRecord } from "@/lib/drawboard/artifactCache";
import { createClient, type RedisClientType } from "redis";

const DEFAULT_TTL_SECONDS = 60 * 60;
const memoryCache = new Map<string, { value: DrawboardArtifactRecord; expiresAt: number }>();
let nativeRedisClientPromise: Promise<RedisClientType | null> | null = null;

function nativeRedisUrl(): string {
  return (
    process.env.REDIS_URL
    || process.env.DRAWBOARD_REDIS_URL
    || ""
  ).trim();
}

function redisBaseUrl(): string {
  return (
    process.env.UPSTASH_REDIS_REST_URL
    || process.env.REDIS_REST_URL
    || ""
  ).trim();
}

function redisToken(): string {
  return (
    process.env.UPSTASH_REDIS_REST_TOKEN
    || process.env.REDIS_REST_TOKEN
    || ""
  ).trim();
}

function hasRedisConfig(): boolean {
  return nativeRedisUrl().length > 0 || (redisBaseUrl().length > 0 && redisToken().length > 0);
}

async function getNativeRedisClient(): Promise<RedisClientType | null> {
  const url = nativeRedisUrl();
  if (!url) {
    return null;
  }
  if (!nativeRedisClientPromise) {
    nativeRedisClientPromise = (async () => {
      const client = createClient({
        url,
      });
      client.on("error", (error) => {
        console.error("[drawboard-artifact-cache] native redis error", error);
      });
      await client.connect();
      return client;
    })().catch((error) => {
      console.error("[drawboard-artifact-cache] failed to connect native redis", error);
      nativeRedisClientPromise = null;
      return null;
    });
  }
  return nativeRedisClientPromise;
}

async function upstashGet(key: string): Promise<DrawboardArtifactRecord | null> {
  const response = await fetch(`${redisBaseUrl()}/get/${encodeURIComponent(key)}`, {
    headers: {
      Authorization: `Bearer ${redisToken()}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  const json = await response.json() as { result?: string | null };
  if (!json?.result) {
    return null;
  }
  try {
    return JSON.parse(json.result) as DrawboardArtifactRecord;
  } catch {
    return null;
  }
}

async function upstashSet(key: string, value: DrawboardArtifactRecord, ttlSeconds: number): Promise<void> {
  await fetch(`${redisBaseUrl()}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      value: JSON.stringify(value),
      ex: ttlSeconds,
    }),
  }).catch(() => {});
}

async function nativeRedisGet(key: string): Promise<DrawboardArtifactRecord | null> {
  const client = await getNativeRedisClient();
  if (!client) {
    return null;
  }
  const raw = await client.get(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as DrawboardArtifactRecord;
  } catch {
    return null;
  }
}

async function nativeRedisSet(key: string, value: DrawboardArtifactRecord, ttlSeconds: number): Promise<void> {
  const client = await getNativeRedisClient();
  if (!client) {
    return;
  }
  await client.set(key, JSON.stringify(value), {
    EX: ttlSeconds,
  });
}

export async function getCachedDrawboardArtifact(key: string): Promise<DrawboardArtifactRecord | null> {
  const now = Date.now();
  const memory = memoryCache.get(key);
  if (memory && memory.expiresAt > now) {
    return memory.value;
  }
  if (memory) {
    memoryCache.delete(key);
  }
  if (hasRedisConfig()) {
    const cached = nativeRedisUrl()
      ? await nativeRedisGet(key)
      : await upstashGet(key);
    if (cached) {
      memoryCache.set(key, {
        value: cached,
        expiresAt: now + DEFAULT_TTL_SECONDS * 1000,
      });
      return cached;
    }
  }
  return null;
}

export async function setCachedDrawboardArtifact(
  key: string,
  value: DrawboardArtifactRecord,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
  if (hasRedisConfig()) {
    if (nativeRedisUrl()) {
      await nativeRedisSet(key, value, ttlSeconds);
    } else {
      await upstashSet(key, value, ttlSeconds);
    }
  }
}
