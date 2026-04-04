'use client';

import { EventSequenceStep } from "@/types";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { INITIAL_EVENT_SEQUENCE_STEP_ID, type AutoReplayState, type EventSequenceRecordingMode } from "@/lib/drawboard/eventSequenceState";

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
  /** Accuracy was measured against an older drawing version. */
  stale: boolean;
  /** Comparison could not produce a result for this step. */
  comparisonFailed: boolean;
  percent: number;
  /** When true, show the accuracy percent (including 0%) instead of the step index. */
  showPercentLabel: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "relative flex h-11 w-11 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
        comparisonFailed
          ? "border-red-400 bg-red-50 text-red-500 dark:bg-red-950"
          : completed
            ? "border-emerald-500 bg-emerald-500 text-white"
            : active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground",
        stale && showPercentLabel && !comparisonFailed ? "opacity-60" : "",
      ].join(" ")}
    >
      {loading && (
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
      )}
      {stale && showPercentLabel && !loading && !comparisonFailed && (
        <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-1 ring-background" />
      )}
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
            const realStepIndex = index - 1;
            const rawValue = stepAccuracies[step.id];
            const loading = rawValue === -1;
            const comparisonFailed = rawValue === -2;
            const measured = rawValue !== undefined && rawValue >= 0;
            const percent = measured ? rawValue : 0;
            const showPercentLabel = measured || comparisonFailed;
            const stale = Boolean(staleStepIds?.has(step.id));
            return (
              <Tooltip key={step.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full bg-transparent p-0"
                    aria-label={`Event step ${index + 1}`}
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
                <TooltipContent side="top" className="max-w-[260px]">
                  <div className="text-sm font-medium">
                    {isInitialStep ? "Initial state" : `Step ${index}`}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {step.instruction}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
          {!hasSteps ? (
            <div className="text-sm text-muted-foreground">
              {creatorMode
                ? interactivePreview
                  ? "Use the Interactions subnavbar to record the intended event sequence."
                  : "Switch to interactive preview to start recording an event sequence."
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
            Replaying {autoReplay.stepIndex}/{autoReplay.totalSteps}
          </span>
        </div>
      ) : null}
    </div>
  );
}
