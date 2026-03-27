/** @format */
'use client';

// ModelArtContainer.tsx
import { Frame } from "../Frame";
import { ArtContainer } from "../ArtContainer";
import { useAppSelector } from "@/store/hooks/hooks";
import { scenario } from "@/types";

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
};

export const ModelArtContainer = ({
  children,
  scenario,
  showInteractivePreview = false,
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

  // decode with base64
  return (
    <ArtContainer
      width={scenario.dimensions.width}
      height={scenario.dimensions.height}
    >
      <Frame
        id="DrawBoard"
        newCss={solutionCSS}
        newHtml={solutionHTML}
        newJs={solutionJS + "\n" + scenario.js}
        events={level.events || []}
        scenario={scenario}
        name="solutionUrl"
        hiddenFromView={!showInteractivePreview}
      />
      {children}
    </ArtContainer>
  );
};
