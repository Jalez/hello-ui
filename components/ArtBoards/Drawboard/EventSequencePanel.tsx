'use client';

import { EventSequenceStep } from "@/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { INITIAL_EVENT_SEQUENCE_STEP_ID, type AutoReplayState, type EventSequenceRecordingMode } from "@/lib/drawboard/eventSequenceState";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

/** Show up to two decimal places; trim trailing zeros (e.g. 87.4% not 87.40%). */
function formatStepAccuracyPercent(value: number): string {
  return `${parseFloat(value.toFixed(2))}%`;
}

type EventSequencePanelProps = {
  creatorMode: boolean;
  interactivePreview: boolean;
  recordingMode: EventSequenceRecordingMode;
  steps: EventSequenceStep[];
  activeStepIndex: number;
  stepAccuracies: Record<string, number>;
  staleStepIds?: Set<string>;
  autoReplay?: AutoReplayState | null;
  onUpdateStep: (stepId: string, field: "label" | "instruction", value: string) => void;
  selectedStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
};

function StepCircle({
  active,
  completed,
  loading,
  stale,
  comparisonFailed,
  percent,
  showPercentLabel,
  children,
}: {
  active: boolean;
  completed: boolean;
  loading: boolean;
  /** Accuracy was measured against an older drawing / source version. */
  stale: boolean;
  /** Comparison could not produce a result for this event. */
  comparisonFailed: boolean;
  percent: number;
  /** When true, show the accuracy percent (including 0%) instead of the event index. */
  showPercentLabel: boolean;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full border-2 transition-colors",
          active
            ? "border-primary bg-primary/10 text-primary"
            : "border-muted-foreground/30 bg-muted/50 text-muted-foreground",
        )}
        aria-busy
        aria-label="Measuring accuracy"
      >
        <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
      </div>
    );
  }

  const staleRing = stale && showPercentLabel && !comparisonFailed;

  return (
    <div
      className={cn(
        "relative flex h-11 w-11 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
        comparisonFailed
          ? "border-red-400 bg-red-50 text-red-500 dark:bg-red-950"
          : completed
            ? "border-emerald-500 bg-emerald-500 text-white"
            : active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground",
        staleRing && "ring-2 ring-amber-500/70 ring-offset-2 ring-offset-background dark:ring-amber-400/60",
        staleRing ? "opacity-90" : "",
      )}
    >
      {comparisonFailed ? "!" : showPercentLabel ? formatStepAccuracyPercent(percent) : children}
    </div>
  );
}

export function EventSequencePanel({
  creatorMode,
  interactivePreview,
  recordingMode,
  steps,
  activeStepIndex,
  stepAccuracies,
  staleStepIds,
  autoReplay,
  onUpdateStep,
  selectedStepId,
  onSelectStep,
}: EventSequencePanelProps) {
  const hasSteps = steps.length > 0;
  const recording = recordingMode !== "idle";
  const shouldRender = creatorMode ? (recording || hasSteps) : true;
  const displaySteps = [
    {
      id: INITIAL_EVENT_SEQUENCE_STEP_ID,
      label: "Initial state",
      instruction: "View before any interactions are triggered.",
      eventType: "click",
      targetSummary: "initial state",
    },
    ...steps,
  ];
  const selectedDisplayIndex = displaySteps.findIndex((step) => step.id === selectedStepId);
  const fallbackDisplayIndex = hasSteps
    ? Math.min(activeStepIndex + 1, displaySteps.length - 1)
    : 0;
  const activeDisplayIndex = selectedDisplayIndex >= 0 ? selectedDisplayIndex : fallbackDisplayIndex;
  const activeStep = displaySteps[activeDisplayIndex] ?? displaySteps[0];
  const selectedRealStep = activeStep?.id && activeStep.id !== INITIAL_EVENT_SEQUENCE_STEP_ID
    ? steps.find((step) => step.id === activeStep.id) ?? null
    : null;

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="mb-3 w-full max-w-[min(100%,720px)]">

      <TooltipProvider>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {displaySteps.map((step, index) => {
            const isInitialStep = step.id === INITIAL_EVENT_SEQUENCE_STEP_ID;
            const rawValue = stepAccuracies[step.id];
            const loading = rawValue === -1;
            const comparisonFailed = rawValue === -2;
            const measured = rawValue !== undefined && rawValue >= 0;
            const percent = measured ? rawValue : 0;
            const showPercentLabel = measured || comparisonFailed;
            const stale = Boolean(staleStepIds?.has(step.id));

            const title = isInitialStep ? "Initial state" : `Event ${index}`;

            return (
              <Tooltip key={step.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full bg-transparent p-0"
                    aria-label={`Event ${index + 1}`}
                    onClick={() => onSelectStep?.(step.id)}
                  >
                    <StepCircle
                      active={step.id === selectedStepId}
                      completed={percent === 100}
                      loading={loading}
                      stale={stale}
                      comparisonFailed={comparisonFailed}
                      percent={percent}
                      showPercentLabel={showPercentLabel}
                    >
                      {index}
                    </StepCircle>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px]">
                  <div className="text-sm font-medium">{title}</div>
                  {loading ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">Measuring accuracy for this event…</p>
                  ) : comparisonFailed ? (
                    <p className="mt-1.5 text-xs text-destructive">
                      Could not compare this event to your design. Try again or check the preview.
                    </p>
                  ) : measured ? (
                    <p className="mt-1.5 text-xs">
                      <span className="text-muted-foreground">Accuracy: </span>
                      <span className="font-medium tabular-nums">{formatStepAccuracyPercent(percent)}</span>
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      No accuracy yet — select this event to measure against your design.
                    </p>
                  )}
                  {measured && stale && !loading ? (
                    <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                      Out of date: your code, solution, or sequence changed after this was measured. Select the event
                      again to refresh.
                    </p>
                  ) : null}
                  <p className="mt-1.5 text-xs text-muted-foreground">{step.instruction}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
          {!hasSteps ? (
            <div className="text-sm text-muted-foreground">
              {creatorMode
                ? interactivePreview
                  ? "Use the Interactions subnavbar to record the intended event sequence."
                  : "Switch to live preview to start recording an event sequence."
                : "No event sequence has been recorded for this scenario."}
            </div>
          ) : null}
        </div>
      </TooltipProvider>

      {autoReplay?.running && autoReplay.totalSteps > 0 ? (
        <div className="mt-2 flex items-center justify-center gap-2">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${Math.round((autoReplay.stepIndex / autoReplay.totalSteps) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            Running events {autoReplay.stepIndex}/{autoReplay.totalSteps}
          </span>
        </div>
      ) : null}
    </div>
  );
}
