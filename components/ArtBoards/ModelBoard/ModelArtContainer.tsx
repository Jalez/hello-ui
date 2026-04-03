/** @format */
"use client";

// ModelArtContainer.tsx
import type { Ref } from "react";
import { Frame, type FrameHandle } from "../Frame";
import { ArtContainer } from "../ArtContainer";
import { useAppSelector } from "@/store/hooks/hooks";
import { DrawboardSnapshotPayload, EventSequenceStep, InteractionTrigger, scenario } from "@/types";
import { Spinner } from "@/components/General/Spinner/Spinner";

const EMPTY_REPLAY_SEQUENCE: EventSequenceStep[] = [];

type LegacySolution = {
  SCSS: string;
  SHTML: string;
  SJS: string;
  drawn: boolean;
};

type ModelArtContainerProps = {
  children: React.ReactNode;
  scenario: scenario;
  showInteractivePreview?: boolean;
  frameRef?: Ref<FrameHandle>;
  onCaptureBusyChange?: (busy: boolean) => void;
  /** When false (game), the solution iframe is removed after the first capture so the live solution is never visible. */
  isCreator?: boolean;
  solutionUrl?: string;
  recordingSequence?: boolean;
  replaySequence?: EventSequenceStep[];
  /** When set, used as Frame `events` instead of `level.events` (event-sequence scrubbing). */
  interactionTriggers?: InteractionTrigger[];
  interactiveOverride?: boolean;
  snapshotOverride?: DrawboardSnapshotPayload | null;
  suppressHeavyLayoutEffects?: boolean;
};

export const ModelArtContainer = ({
  children,
  scenario,
  showInteractivePreview = false,
  frameRef,
  onCaptureBusyChange,
  isCreator = true,
  solutionUrl = "",
  recordingSequence = false,
  replaySequence = EMPTY_REPLAY_SEQUENCE,
  interactionTriggers,
  interactiveOverride,
  snapshotOverride = null,
  suppressHeavyLayoutEffects = false,
}: ModelArtContainerProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const solutions = useAppSelector((state) => state.solutions as unknown as Record<string, LegacySolution>);
  if (!level) return null;

  const defaultLevelSolutions = solutions[level.name]
    ? {
        css: solutions[level.name].SCSS,
        html: solutions[level.name].SHTML,
        js: solutions[level.name].SJS,
      }
    : null;
  const levelSolution = level.solution || { css: "", html: "", js: "" };
  const solutionCSS = levelSolution.css || defaultLevelSolutions?.css || "";
  const solutionHTML = levelSolution.html || defaultLevelSolutions?.html || "";
  const solutionJS = levelSolution.js || defaultLevelSolutions?.js || "";
  const frameCss = snapshotOverride?.css ?? solutionCSS;
  const frameHtml = snapshotOverride?.snapshotHtml ?? solutionHTML;
  const frameEvents = interactionTriggers ?? level.events ?? [];

  const hasSolutionCapture = Boolean(solutionUrl?.trim());
  // Keep the frame mounted in game mode when there are replay steps so it can
  // re-capture per step (the frame is hidden but interactive for background replay).
  const hasActiveReplay = replaySequence.length > 0;
  // Initial timeline step uses empty replay but still needs the iframe (capture + DOM reset).
  const mountSolutionFrame =
    isCreator || !hasSolutionCapture || hasActiveReplay || Boolean(interactiveOverride);

  return (
    <ArtContainer
      width={scenario.dimensions.width}
      height={scenario.dimensions.height}
    >
      {mountSolutionFrame && (
        <Frame
          ref={frameRef}
          id="DrawBoard"
          newCss={frameCss}
          newHtml={frameHtml}
          newJs={solutionJS + "\n" + scenario.js}
          events={frameEvents}
          scenario={scenario}
          name="solutionUrl"
          hiddenFromView={!showInteractivePreview}
          onCaptureBusyChange={onCaptureBusyChange}
          interactiveOverride={interactiveOverride}
          recordingSequence={recordingSequence}
          persistRecordedSequenceStep={recordingSequence}
          replaySequence={replaySequence}
          suppressHeavyLayoutEffects={suppressHeavyLayoutEffects}
        />
      )}
      {children}
      {!isCreator && !hasSolutionCapture && (
        <div
          className="absolute inset-0 z-[50] flex items-center justify-center bg-background"
          aria-busy
          aria-label="Preparing reference"
        >
          <Spinner
            height={scenario.dimensions.height}
            width={scenario.dimensions.width}
            message="Preparing reference…"
          />
        </div>
      )}
    </ArtContainer>
  );
};
