import { useEffect, useRef } from "react";
import {
  INITIAL_EVENT_SEQUENCE_STEP_ID,
  cancelAutoReplay,
  setSelectedEventSequenceStepId,
  updateSequenceRuntimeState,
  waitForStepAccuracy,
} from "./eventSequenceState";
import type { EventSequenceStep } from "@/types";
import type { AutoReplayState } from "./eventSequenceState";

type UseAutoReplaySequenceParams = {
  runtimeKey: string | null;
  levelId: number;
  scenarioId: string | null;
  steps: EventSequenceStep[];
  autoReplay: AutoReplayState | null;
};

/**
 * Watches for `autoReplay.running` in the sequence runtime state and, when
 * active, cycles through every display step (initial + recorded steps),
 * selecting each one and waiting for its accuracy comparison to complete.
 *
 * The comparison itself is handled by ScenarioDrawing's existing effect —
 * this hook just automates step selection.
 */
export function useAutoReplaySequence({
  runtimeKey,
  levelId,
  scenarioId,
  steps,
  autoReplay,
}: UseAutoReplaySequenceParams) {
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!runtimeKey || !scenarioId) {
      return;
    }

    if (!autoReplay?.running) {
      return;
    }

    cancelledRef.current = false;

    const displayStepIds = [INITIAL_EVENT_SEQUENCE_STEP_ID, ...steps.map((s) => s.id)];
    const totalSteps = displayStepIds.length;

    const run = async () => {
      // Save the step that was selected before auto-replay started so we can
      // restore it afterward (if the user hasn't clicked away).
      const originalStepId = displayStepIds[0];

      for (let i = 0; i < displayStepIds.length; i++) {
        if (cancelledRef.current) {
          break;
        }

        const stepId = displayStepIds[i]!;

        // Update progress in runtime state.
        updateSequenceRuntimeState(runtimeKey, (current) => {
          if (!current.autoReplay) {
            return current;
          }
          return {
            ...current,
            autoReplay: { ...current.autoReplay, stepIndex: i, totalSteps },
          };
        });

        // Clear any stale accuracy so waitForStepAccuracy doesn't resolve
        // immediately with a value from a previous run.
        updateSequenceRuntimeState(runtimeKey, (current) => {
          const prev = current.stepAccuracies[stepId];
          if (prev === undefined || prev === -1) return current;
          return {
            ...current,
            stepAccuracies: { ...current.stepAccuracies, [stepId]: -1 },
          };
        });

        // Select this step — triggers replay + comparison in ScenarioDrawing.
        setSelectedEventSequenceStepId(levelId, scenarioId, stepId);

        // Give the iframe a moment to start the replay before we wait for accuracy.
        await new Promise((resolve) => setTimeout(resolve, 200));

        if (cancelledRef.current) {
          break;
        }

        try {
          await waitForStepAccuracy(runtimeKey, stepId, 15_000);
        } catch {
          // Timeout — move on to the next event.
          console.warn(`Auto-replay: timed out waiting for event ${stepId}`);
        }

        if (cancelledRef.current) {
          break;
        }
      }

      // Finished — clear auto-replay state.
      if (!cancelledRef.current) {
        cancelAutoReplay(runtimeKey);
        // Stay on the last event so the user sees final results.
        setSelectedEventSequenceStepId(levelId, scenarioId, displayStepIds[displayStepIds.length - 1] ?? originalStepId);
      }
    };

    void run().catch((error) => {
      console.error("Auto-replay failed:", error);
      cancelAutoReplay(runtimeKey);
    });

    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeKey, levelId, scenarioId, steps, autoReplay?.running]);
}
