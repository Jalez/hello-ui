import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { renderDrawboardScreenshot } from "@/app/api/_lib/services/drawboardRenderService";
import {
  buildArtifactKey,
  type DrawboardArtifactDescriptor,
  type DrawboardArtifactRecord,
} from "@/lib/drawboard/artifactCache";
import {
  getCachedDrawboardArtifact,
  setCachedDrawboardArtifact,
} from "@/app/api/_lib/services/drawboardArtifactCacheService";

const MAX_CAPTURE_DIMENSION = 2000;

const renderSchema = z.object({
  css: z.string().default(""),
  snapshotHtml: z.string().min(1),
  width: z.number().int().min(1).max(MAX_CAPTURE_DIMENSION),
  height: z.number().int().min(1).max(MAX_CAPTURE_DIMENSION),
  scenarioId: z.string().min(1),
  urlName: z.enum(["drawingUrl", "solutionUrl"]),
  includeDataUrl: z.boolean().optional(),
  artifactCache: z.object({
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
    width: z.number().int().min(1).max(MAX_CAPTURE_DIMENSION),
    height: z.number().int().min(1).max(MAX_CAPTURE_DIMENSION),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const payload = renderSchema.parse(rawBody);
    const artifactDescriptor = payload.artifactCache as DrawboardArtifactDescriptor | undefined;
    if (artifactDescriptor) {
      const cacheKey = buildArtifactKey(artifactDescriptor);
      const cached = await getCachedDrawboardArtifact(cacheKey);
      if (cached?.pixelBufferBase64 && cached.dataUrl) {
        return NextResponse.json({
          scenarioId: cached.scenarioId,
          urlName: payload.urlName,
          width: cached.width,
          height: cached.height,
          pixelBufferBase64: cached.pixelBufferBase64,
          dataUrl: cached.dataUrl,
        });
      }
    }
    const result = await renderDrawboardScreenshot(payload);
    if (artifactDescriptor && result.dataUrl) {
      const cacheRecord: DrawboardArtifactRecord = {
        ...artifactDescriptor,
        key: buildArtifactKey(artifactDescriptor),
        dataUrl: result.dataUrl,
        pixelBufferBase64: result.pixelBufferBase64,
        createdAt: new Date().toISOString(),
      };
      await setCachedDrawboardArtifact(cacheRecord.key, cacheRecord);
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid drawboard render request",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    console.error("Drawboard render failed", error);
    return NextResponse.json(
      { error: "Failed to render drawboard screenshot" },
      { status: 500 },
    );
  }
}
