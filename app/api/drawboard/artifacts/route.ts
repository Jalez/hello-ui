import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  buildArtifactKey,
  type DrawboardArtifactRecord,
} from "@/lib/drawboard/artifactCache";
import {
  getCachedDrawboardArtifact,
  setCachedDrawboardArtifact,
} from "@/app/api/_lib/services/drawboardArtifactCacheService";

const descriptorSchema = z.object({
  version: z.literal("v1"),
  captureMode: z.enum(["browser", "playwright"]),
  artifactType: z.enum(["drawing", "solution", "solution-step"]),
  fingerprint: z.string().min(1),
  gameId: z.string().optional().nullable(),
  levelIdentifier: z.string().optional().nullable(),
  levelName: z.string().optional().nullable(),
  scenarioId: z.string().min(1),
  stepId: z.string().optional().nullable(),
  platformBucket: z.string().optional().nullable(),
  width: z.coerce.number().int().min(1).max(2000),
  height: z.coerce.number().int().min(1).max(2000),
});

const recordSchema = descriptorSchema.extend({
  key: z.string().optional(),
  dataUrl: z.string().min(1),
  pixelBufferBase64: z.string().optional(),
  createdAt: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const parsed = descriptorSchema.safeParse({
    version: request.nextUrl.searchParams.get("version"),
    captureMode: request.nextUrl.searchParams.get("captureMode"),
    artifactType: request.nextUrl.searchParams.get("artifactType"),
    fingerprint: request.nextUrl.searchParams.get("fingerprint"),
    gameId: request.nextUrl.searchParams.get("gameId"),
    levelIdentifier: request.nextUrl.searchParams.get("levelIdentifier"),
    levelName: request.nextUrl.searchParams.get("levelName"),
    scenarioId: request.nextUrl.searchParams.get("scenarioId"),
    stepId: request.nextUrl.searchParams.get("stepId"),
    platformBucket: request.nextUrl.searchParams.get("platformBucket"),
    width: request.nextUrl.searchParams.get("width"),
    height: request.nextUrl.searchParams.get("height"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid artifact descriptor" }, { status: 400 });
  }
  const key = buildArtifactKey(parsed.data);
  const cached = await getCachedDrawboardArtifact(key);
  if (!cached) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(cached);
}

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  const parsed = recordSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid artifact record" }, { status: 400 });
  }
  const descriptor = parsed.data;
  const key = buildArtifactKey(descriptor);
  const record: DrawboardArtifactRecord = {
    ...descriptor,
    key,
    createdAt: parsed.data.createdAt ?? new Date().toISOString(),
  };
  await setCachedDrawboardArtifact(key, record);
  return NextResponse.json({ ok: true, key });
}
