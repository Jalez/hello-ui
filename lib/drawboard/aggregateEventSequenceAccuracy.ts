import type { EventSequenceStep } from "@/types";
import { INITIAL_EVENT_SEQUENCE_STEP_ID } from "./eventSequenceState";

/**
 * Single scenario accuracy for footer/points when using the event-sequence timeline:
 * mean of measured accuracies for initial + each step (only keys present in stepAccuracies).
 * Matches points.slice getAverageScenarioAccuracy rounding for one scenario.
 */
export function aggregateEventSequenceAccuracy(
  steps: EventSequenceStep[],
  stepAccuracies: Record<string, number>,
): number | null {
  const keys = [INITIAL_EVENT_SEQUENCE_STEP_ID, ...steps.map((s) => s.id)];
  const values = keys
    .map((k) => stepAccuracies[k])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (values.length === 0) {
    return null;
  }
  const raw = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(raw * 100) / 100;
}
