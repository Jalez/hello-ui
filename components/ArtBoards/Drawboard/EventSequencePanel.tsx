'use client';

import { EventSequenceStep } from "@/types";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { INITIAL_EVENT_SEQUENCE_STEP_ID, type EventSequenceRecordingMode } from "@/lib/drawboard/eventSequenceState";

type EventSequencePanelProps = {
  creatorMode: boolean;
  interactivePreview: boolean;
  recordingMode: EventSequenceRecordingMode;
  steps: EventSequenceStep[];
  activeStepIndex: number;
  stepAccuracies: Record<string, number>;
  onUpdateStep: (stepId: string, field: "label" | "instruction", value: string) => void;
  selectedStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
};

function StepCircle({
  active,
  completed,
  percent,
  showPercentLabel,
  children,
}: {
  active: boolean;
  completed: boolean;
  percent: number;
  /** When true, show the rounded percent (including 0%) instead of the step index. */
  showPercentLabel: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "flex h-11 w-11 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
        completed
          ? "border-emerald-500 bg-emerald-500 text-white"
          : active
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-foreground",
      ].join(" ")}
    >
      {showPercentLabel ? `${Math.round(percent)}%` : children}
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
      {activeStep ? (
        <div className="mt-2 flex items-center justify-center gap-2 text-sm text-center">
          <div className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Step {activeDisplayIndex}
          </div>
          {creatorMode && !recording && selectedRealStep ? (
            <Input
              value={selectedRealStep.instruction}
              onChange={(event) => onUpdateStep(selectedRealStep.id, "instruction", event.target.value)}
              placeholder="Instruction shown to players"
              className="h-8 max-w-[420px] text-center"
            />
          ) : (
            <div className="text-sm text-foreground">
              {activeStep.instruction}
            </div>
          )}
        </div>
      ) : null}

      <TooltipProvider>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {displaySteps.map((step, index) => {
            const isInitialStep = step.id === INITIAL_EVENT_SEQUENCE_STEP_ID;
            const realStepIndex = index - 1;
            const measured = !isInitialStep && step.id in stepAccuracies;
            const percent = isInitialStep
              ? 100
              : measured
                ? (stepAccuracies[step.id] ?? 0)
                : (realStepIndex < activeStepIndex ? 100 : 0);
            const showPercentLabel =
              isInitialStep
              || measured
              || percent > 0;
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
                      active={step.id === selectedStepId || (!selectedStepId && isInitialStep)}
                      completed={isInitialStep || realStepIndex < activeStepIndex}
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
    </div>
  );
}
