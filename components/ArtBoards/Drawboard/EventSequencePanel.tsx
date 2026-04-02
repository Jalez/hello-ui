'use client';

import { EventSequenceStep, scenario } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Trash2, Circle, CircleDot, Square } from "lucide-react";

type EventSequencePanelProps = {
  scenario: scenario;
  creatorMode: boolean;
  interactivePreview: boolean;
  recording: boolean;
  steps: EventSequenceStep[];
  activeStepIndex: number;
  stepAccuracies: Record<string, number>;
  previewUrls: Record<string, string>;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onClearSequence: () => void;
  onUpdateStep: (stepId: string, field: "label" | "instruction", value: string) => void;
  onRemoveStep: (stepId: string) => void;
};

function StepCircle({
  active,
  completed,
  percent,
  children,
}: {
  active: boolean;
  completed: boolean;
  percent: number;
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
      {percent > 0 ? `${Math.round(percent)}%` : children}
    </div>
  );
}

export function EventSequencePanel({
  scenario,
  creatorMode,
  interactivePreview,
  recording,
  steps,
  activeStepIndex,
  stepAccuracies,
  previewUrls,
  onStartRecording,
  onStopRecording,
  onClearSequence,
  onUpdateStep,
  onRemoveStep,
}: EventSequencePanelProps) {
  const hasSteps = steps.length > 0;
  const activeStep = steps[activeStepIndex] ?? steps[steps.length - 1] ?? null;
  const shouldRender = creatorMode ? interactivePreview || hasSteps : hasSteps;

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="mt-3 w-full max-w-[min(100%,520px)] rounded-2xl border bg-background/95 p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Event sequence</div>
          <div className="text-xs text-muted-foreground">
            Scenario {scenario.scenarioId}
          </div>
        </div>
        {creatorMode ? (
          <div className="flex flex-wrap items-center gap-2">
            {!recording ? (
              <Button type="button" size="sm" variant="outline" onClick={onStartRecording}>
                <CircleDot className="mr-2 h-4 w-4" />
                Start recording
              </Button>
            ) : (
              <Button type="button" size="sm" variant="default" onClick={onStopRecording}>
                <Square className="mr-2 h-4 w-4" />
                Stop recording
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={onClearSequence} disabled={!hasSteps && !recording}>
              Clear sequence
            </Button>
          </div>
        ) : activeStep ? (
          <Badge variant="secondary">Step {Math.min(activeStepIndex + 1, steps.length)} / {steps.length}</Badge>
        ) : null}
      </div>

      {recording ? (
        <div className="mt-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-sm text-primary">
          Recording verified view-changing interactions in order.
        </div>
      ) : null}

      {activeStep && previewUrls[activeStep.id] ? (
        <div className="mt-3 overflow-hidden rounded-xl border bg-muted/40">
          <img
            src={previewUrls[activeStep.id]}
            alt={activeStep.instruction}
            className="block max-h-[180px] w-full object-contain"
          />
          <div className="border-t px-3 py-2 text-sm text-foreground">
            {activeStep.instruction}
          </div>
        </div>
      ) : null}

      <TooltipProvider>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {steps.map((step, index) => {
            const percent = stepAccuracies[step.id] ?? (index < activeStepIndex ? 100 : 0);
            return (
              <Tooltip key={step.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full bg-transparent p-0"
                    aria-label={`Event step ${index + 1}`}
                  >
                    <StepCircle
                      active={index === activeStepIndex}
                      completed={index < activeStepIndex}
                      percent={percent}
                    >
                      {index + 1}
                    </StepCircle>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px]">
                  <div className="text-sm font-medium">{step.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{step.instruction}</div>
                </TooltipContent>
              </Tooltip>
            );
          })}
          {!hasSteps ? (
            <div className="text-sm text-muted-foreground">
              {creatorMode
                ? "Switch to interactive preview and record the intended event sequence."
                : "No event sequence has been recorded for this scenario."}
            </div>
          ) : null}
        </div>
      </TooltipProvider>

      {creatorMode && hasSteps ? (
        <div className="mt-4 space-y-3">
          {steps.map((step, index) => (
            <div key={step.id} className="rounded-xl border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Circle className="h-3.5 w-3.5" />
                  Step {index + 1}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => onRemoveStep(step.id)}
                  aria-label={`Remove event step ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Input
                  value={step.label}
                  onChange={(event) => onUpdateStep(step.id, "label", event.target.value)}
                  placeholder="Step label"
                />
                <Input
                  value={step.instruction}
                  onChange={(event) => onUpdateStep(step.id, "instruction", event.target.value)}
                  placeholder="Instruction shown to players"
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
