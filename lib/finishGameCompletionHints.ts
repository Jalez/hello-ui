import type { Level } from "@/types";

/** Subset of Redux points slice needed for completion hints. */
export type PointsSnapshotForHints = {
  allPoints: number;
  allMaxPoints: number;
  levels: Record<
    string,
    | {
        points: number;
        maxPoints: number;
        scenarios: { scenarioId: string; accuracy: number }[];
      }
    | undefined
  >;
};

function scenarioAccuracy(
  levelPoints: PointsSnapshotForHints["levels"][string],
  scenarioId: string,
): number {
  const row = levelPoints?.scenarios?.find((s) => s.scenarioId === scenarioId);
  return typeof row?.accuracy === "number" && Number.isFinite(row.accuracy) ? row.accuracy : 0;
}

/** 1-based index in `level.scenarios` so copy matches what players see (order of scenarios in the level). */
function scenarioUserLabel(level: Level, scenarioId: string): string {
  const idx = level.scenarios.findIndex((s) => s.scenarioId === scenarioId);
  if (idx >= 0) {
    return `scenario ${idx + 1}`;
  }
  return `«${scenarioId}»`;
}

/**
 * Returns human-readable bullets when the player is missing more than 50% of total points
 * (earned/max < 0.5) and there are identifiable gaps.
 *
 * If `levels` is empty (e.g. finish view opened without App hydrating Redux), returns [] so we
 * do not show misleading hints.
 *
 * Event-sequence completeness uses scenario accuracy only; per-step counts are not persisted
 * for learners in Redux (see Frame.tsx / interactionArtifacts).
 */
export function finishGameCompletionHints(levels: Level[], points: PointsSnapshotForHints): string[] {
  if (levels.length === 0) {
    return [];
  }

  const max = points.allMaxPoints;
  const earned = points.allPoints;
  if (max <= 0) {
    return [];
  }

  if (earned / max >= 0.5) {
    return [];
  }

  const hints: string[] = [];

  for (const level of levels) {
    const lp = points.levels[level.name];
    if (level.maxPoints > 0 && (lp?.points ?? 0) === 0) {
      hints.push(`No points yet on level «${level.name}».`);
    }
  }

  for (const level of levels) {
    const lp = points.levels[level.name];
    for (const scenario of level.scenarios) {
      const sid = scenario.scenarioId;
      const label = scenarioUserLabel(level, sid);
      const seqLen = level.eventSequence?.byScenarioId?.[sid]?.length ?? 0;
      const acc = scenarioAccuracy(lp, sid);

      if (seqLen > 0 && acc < 100) {
        hints.push(
          `Interaction sequence for ${label} on «${level.name}» may be incomplete (not all steps verified / matched).`,
        );
      } else if (acc <= 0) {
        hints.push(`${label.charAt(0).toUpperCase()}${label.slice(1)} on «${level.name}» is still at 0%.`);
      }
    }
  }

  return hints;
}
