/** @format */
'use client';

import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import {
  updateCode,
  updateSolutionCode,
} from "@/store/slices/levels.slice";
import { Level } from "@/types";
import { useCallback, useEffect } from "react";
import EditorTabs from "./EditorTabs";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { store } from "@/store/store";

const Editors = (): React.ReactNode => {
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const levels = useAppSelector((state) => state.levels);
  const collaboration = useOptionalCollaboration();
  const isYjsEnabled = collaboration?.isYjsEnabled ?? false;
  const getYText = collaboration?.getYText;
  const yjsDocGeneration = collaboration?.yjsDocGeneration ?? 0;

  const codeUpdater = useCallback(
    (language: "html" | "css" | "js", code: string, isSolution: boolean) => {
      if (!levels[currentLevel - 1]) return;

      if (isSolution) {
        if (levels[currentLevel - 1].solution?.[language] === code) return;
        dispatch(
          updateSolutionCode({
            id: currentLevel,
            code: { ...levels[currentLevel - 1].solution, [language]: code },
          })
        );
      } else {
        if (levels[currentLevel - 1].code?.[language] === code) return;
        dispatch(
          updateCode({
            id: currentLevel,
            code: { ...levels[currentLevel - 1].code, [language]: code },
          })
        );
      }
    },
    [levels, currentLevel, dispatch]
  );

  useEffect(() => {
    if (!isYjsEnabled || !getYText || levels.length === 0) {
      return;
    }

    const editorTypes: Array<"html" | "css" | "js"> = ["html", "css", "js"];
    const unobserveCallbacks: Array<() => void> = [];

    const syncEditorToRedux = (levelIndex: number, editorType: "html" | "css" | "js") => {
      const yText = getYText(editorType, levelIndex);
      if (!yText) {
        return;
      }

      const stateLevels = store.getState().levels;
      const targetLevel = stateLevels[levelIndex];
      if (!targetLevel) {
        return;
      }

      const nextContent = yText.toString();
      const currentCode = targetLevel.code || { html: "", css: "", js: "" };
      if ((currentCode[editorType] || "") === nextContent) {
        return;
      }

      dispatch(
        updateCode({
          id: levelIndex + 1,
          code: {
            ...currentCode,
            [editorType]: nextContent,
          },
        })
      );
    };

    for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
      for (const editorType of editorTypes) {
        const yText = getYText(editorType, levelIndex);
        if (!yText) {
          continue;
        }

        syncEditorToRedux(levelIndex, editorType);

        const observer = () => {
          syncEditorToRedux(levelIndex, editorType);
        };

        yText.observe(observer);
        unobserveCallbacks.push(() => {
          yText.unobserve(observer);
        });
      }
    }

    return () => {
      unobserveCallbacks.forEach((unobserve) => unobserve());
    };
  }, [dispatch, getYText, isYjsEnabled, levels.length, yjsDocGeneration]);

  const level = levels[currentLevel - 1] as Level | undefined;

  if (!level) {
    return null;
  }

  const identifier = level.identifier;

  const languages = {
    html: {
      code: level.code.html || "",
      solution: level.solution.html || "",
      locked: level.lockHTML,
    },
    css: {
      code: level.code.css || "",
      solution: level.solution.css || "",
      locked: level.lockCSS,
    },
    js: {
      code: level.code.js || "",
      solution: level.solution.js || "",
      locked: level.lockJS,
    },
  };

  return (
    <div className="flex-1 flex flex-row justify-center items-stretch">
      <EditorTabs
        languages={languages}
        codeUpdater={codeUpdater}
        identifier={identifier}
      />
    </div>
  );
};

export default Editors;
