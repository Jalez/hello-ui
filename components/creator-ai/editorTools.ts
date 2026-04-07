"use client";

import type { CollaborationContextValue } from "@/lib/collaboration/CollaborationProvider";
import type { EditorType } from "@/lib/collaboration/types";
import { updateCode, updateSolutionCode } from "@/store/slices/levels.slice";
import type { AppDispatch, RootState } from "@/store/store";
import type { Level } from "@/types";

import type { CreatorAiEditorLanguage, CreatorAiEditorTarget } from "./store";

type EditorContent = {
  html: string;
  css: string;
  js: string;
};

function getLevelAtIndex(state: RootState, levelIndex: number): Level | null {
  return state.levels[levelIndex] ?? null;
}

function getEditorTextFromLevel(
  level: Level,
  target: CreatorAiEditorTarget,
  language: CreatorAiEditorLanguage,
): string {
  return target === "solution"
    ? (level.solution?.[language] ?? "")
    : (level.code?.[language] ?? "");
}

function getEditorTextFromCollaboration(
  collaboration: CollaborationContextValue | null | undefined,
  levelIndex: number,
  target: CreatorAiEditorTarget,
  language: CreatorAiEditorLanguage,
): string | null {
  const getter = target === "solution"
    ? collaboration?.getYSolutionText
    : collaboration?.getYText;
  const yText = getter?.(language as EditorType, levelIndex) ?? null;
  return yText ? yText.toString() : null;
}

function getEditorContent(
  state: RootState,
  collaboration: CollaborationContextValue | null | undefined,
  levelIndex: number,
  target: CreatorAiEditorTarget,
): EditorContent {
  const level = getLevelAtIndex(state, levelIndex);
  if (!level) {
    return { html: "", css: "", js: "" };
  }

  const languages: CreatorAiEditorLanguage[] = ["html", "css", "js"];
  return Object.fromEntries(
    languages.map((language) => {
      const collabValue = getEditorTextFromCollaboration(collaboration, levelIndex, target, language);
      return [language, collabValue ?? getEditorTextFromLevel(level, target, language)];
    }),
  ) as EditorContent;
}

export function getLevelContextSnapshot({
  state,
  collaboration,
  levelIndex,
  activeLanguage,
  activeTarget,
}: {
  state: RootState;
  collaboration: CollaborationContextValue | null | undefined;
  levelIndex: number;
  activeLanguage: CreatorAiEditorLanguage;
  activeTarget: CreatorAiEditorTarget;
}) {
  const level = getLevelAtIndex(state, levelIndex);
  if (!level) {
    return null;
  }

  const scenarios = (level.scenarios ?? []).map((scenario) => ({
    scenarioId: scenario.scenarioId,
    width: scenario.dimensions.width,
    height: scenario.dimensions.height,
    unit: scenario.dimensions.unit || "px",
  }));
  const primaryScenario = scenarios[0] ?? null;

  return {
    levelIndex,
    levelName: level.name,
    activeEditor: {
      language: activeLanguage,
      target: activeTarget,
    },
    template: getEditorContent(state, collaboration, levelIndex, "template"),
    solution: getEditorContent(state, collaboration, levelIndex, "solution"),
    primaryDimensions: primaryScenario
      ? {
          width: primaryScenario.width,
          height: primaryScenario.height,
          unit: primaryScenario.unit,
          scenarioId: primaryScenario.scenarioId,
        }
      : null,
    scenarios,
    instructions: level.instructions ?? [],
    events: level.events ?? [],
    interactive: Boolean(level.interactive),
    locks: {
      html: Boolean(level.lockHTML),
      css: Boolean(level.lockCSS),
      js: Boolean(level.lockJS),
    },
  };
}

export function readEditorContent({
  state,
  collaboration,
  levelIndex,
  target,
  language,
}: {
  state: RootState;
  collaboration: CollaborationContextValue | null | undefined;
  levelIndex: number;
  target: CreatorAiEditorTarget;
  language: CreatorAiEditorLanguage;
}) {
  const level = getLevelAtIndex(state, levelIndex);
  if (!level) {
    return null;
  }

  return {
    levelIndex,
    levelName: level.name,
    target,
    language,
    content:
      getEditorTextFromCollaboration(collaboration, levelIndex, target, language)
      ?? getEditorTextFromLevel(level, target, language),
  };
}

export function writeEditorContent({
  state,
  dispatch,
  collaboration,
  levelIndex,
  target,
  language,
  content,
}: {
  state: RootState;
  dispatch: AppDispatch;
  collaboration: CollaborationContextValue | null | undefined;
  levelIndex: number;
  target: CreatorAiEditorTarget;
  language: CreatorAiEditorLanguage;
  content: string;
}) {
  const level = getLevelAtIndex(state, levelIndex);
  if (!level) {
    return {
      success: false,
      message: "Current level was not found.",
      changed: false,
    };
  }

  const getter = target === "solution"
    ? collaboration?.getYSolutionText
    : collaboration?.getYText;
  const yText = getter?.(language as EditorType, levelIndex) ?? null;

  if (yText) {
    const previous = yText.toString();
    if (previous === content) {
      return {
        success: true,
        message: `No changes needed for ${target} ${language.toUpperCase()}.`,
        changed: false,
      };
    }

    const applyChange = () => {
      yText.delete(0, yText.length);
      if (content.length > 0) {
        yText.insert(0, content);
      }
    };

    if (yText.doc) {
      yText.doc.transact(applyChange, "external-code-state");
    } else {
      applyChange();
    }

    return {
      success: true,
      message: `Updated ${target} ${language.toUpperCase()} through collaboration state.`,
      changed: true,
    };
  }

  if (target === "solution") {
    dispatch(
      updateSolutionCode({
        id: levelIndex + 1,
        code: {
          ...level.solution,
          [language]: content,
        },
      }),
    );
  } else {
    dispatch(
      updateCode({
        id: levelIndex + 1,
        code: {
          ...level.code,
          [language]: content,
        },
      }),
    );
  }

  return {
    success: true,
    message: `Updated ${target} ${language.toUpperCase()} in local state.`,
    changed: true,
  };
}
