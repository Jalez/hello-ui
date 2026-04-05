import type { Level, PointsThreshold } from "@/types";

export const DEFAULT_POINTS_THRESHOLDS: PointsThreshold[] = [
  { accuracy: 70, pointsPercent: 25 },
  { accuracy: 85, pointsPercent: 60 },
  { accuracy: 95, pointsPercent: 100 },
];

function cloneDefaultThresholds(): PointsThreshold[] {
  return DEFAULT_POINTS_THRESHOLDS.map((t) => ({ ...t }));
}

type LevelThresholdInput = Pick<Level, "percentageTreshold" | "percentageFullPointsTreshold"> & {
  pointsThresholds?: Level["pointsThresholds"];
};

/**
 * One-time migration: old persisted levels often only had percentage bounds.
 * Expand them into a stepped ladder so scoring uses the same threshold model everywhere.
 */
function approximatedThresholdsFromLegacyBounds(low: number, high: number): PointsThreshold[] {
  const lo = Number(low);
  const hi = Number(high);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    return cloneDefaultThresholds();
  }
  const loClamped = Math.max(0, Math.min(100, Math.round(lo)));
  let hiClamped = Math.max(0, Math.min(100, Math.round(hi)));
  if (hiClamped <= loClamped) {
    hiClamped = Math.min(100, loClamped + 1);
  }
  const segments = 20;
  const raw: PointsThreshold[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const accuracy = Math.round(loClamped + ((hiClamped - loClamped) * i) / segments);
    const pointsPercent = Math.round((100 * i) / segments);
    raw.push({ accuracy, pointsPercent });
  }
  raw.sort((a, b) => a.accuracy - b.accuracy);
  const byAccuracy: PointsThreshold[] = [];
  for (const row of raw) {
    const last = byAccuracy[byAccuracy.length - 1];
    if (!last || row.accuracy > last.accuracy) {
      byAccuracy.push({ ...row });
    } else if (row.accuracy === last.accuracy && row.pointsPercent > last.pointsPercent) {
      byAccuracy[byAccuracy.length - 1] = { ...row };
    }
  }
  for (let i = 1; i < byAccuracy.length; i += 1) {
    if (byAccuracy[i].pointsPercent < byAccuracy[i - 1].pointsPercent) {
      byAccuracy[i] = {
        ...byAccuracy[i],
        pointsPercent: byAccuracy[i - 1].pointsPercent,
      };
    }
  }
  if (byAccuracy.length < 2) {
    return cloneDefaultThresholds();
  }
  return byAccuracy;
}

export function resolvePointsThresholds(level: LevelThresholdInput): PointsThreshold[] {
  const existing = level.pointsThresholds?.filter(
    (t) => Number.isFinite(t.accuracy) && Number.isFinite(t.pointsPercent),
  );
  if (existing && existing.length > 0) {
    return [...existing].sort((a, b) => a.accuracy - b.accuracy);
  }
  return approximatedThresholdsFromLegacyBounds(level.percentageTreshold, level.percentageFullPointsTreshold);
}

export function ensurePointsThresholdsOnLevel<L extends Level>(level: L): L {
  const pointsThresholds = resolvePointsThresholds(level);
  return {
    ...level,
    pointsThresholds,
    percentageTreshold: pointsThresholds[0].accuracy,
    percentageFullPointsTreshold: pointsThresholds[pointsThresholds.length - 1].accuracy,
  };
}

export function applyPointsThresholdsInPlace(level: Level): void {
  const next = resolvePointsThresholds(level);
  level.pointsThresholds = next;
  level.percentageTreshold = next[0].accuracy;
  level.percentageFullPointsTreshold = next[next.length - 1].accuracy;
}
