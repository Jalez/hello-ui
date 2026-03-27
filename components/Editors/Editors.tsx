/** @format */
'use client';

import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import {
  updateCode,
  updateSolutionCode,
} from "@/store/slices/levels.slice";
import { Level } from "@/types";
import { useCallback, useEffect, useRef } from "react";
import EditorTabs from "./EditorTabs";
import { useOptionalCollaboration, useYjsLevelCodeSnapshot } from "@/lib/collaboration/CollaborationProvider";
import { store } from "@/store/store";
import { LOCAL_REDUX_UPDATE_DEBOUNCE_MS } from "./CodeEditor/constants";
import { apiUrl } from "@/lib/apiUrl";

const Editors = (): React.ReactNode => {
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const levels = useAppSelector((state) => state.levels);
  const isCreator = useAppSelector((state) => state.options.creator);
  const collaboration = useOptionalCollaboration();
  const getYText = collaboration?.getYText;
  const getYSolutionText = collaboration?.getYSolutionText;
  const yjsReady = collaboration?.yjsReady === true;
  const yjsDocGeneration = collaboration?.yjsDocGeneration ?? 0;
  const remoteSyncTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const solutionPersistTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    console.log("[collab-loop] Editors mounted");
  }, []);

  const levelsRef = useRef(levels);
  levelsRef.current = levels;

  const codeUpdater = useCallback(
    (language: "html" | "css" | "js", code: string, isSolution: boolean) => {
      const lvl = levelsRef.current[currentLevel - 1];
      if (!lvl) return;

      if (isSolution) {
        if (lvl.solution?.[language] === code) return;
        const nextSolution = { ...lvl.solution, [language]: code };
        dispatch(updateSolutionCode({ id: currentLevel, code: nextSolution }));
      } else {
        if (lvl.code?.[language] === code) return;
        dispatch(
          updateCode({
            id: currentLevel,
            code: { ...lvl.code, [language]: code },
          })
        );
      }
    },
    [currentLevel, dispatch]
  );

  useEffect(() => {
    // Do NOT mirror Yjs -> Redux until the doc is fully synced.
    // During handshake/reconnect the local Y.Texts can be empty; syncing those to Redux
    // can cause creator autosave to persist empty templates (and break game resets).
    if (!getYText || !yjsReady || levels.length === 0) {
      return;
    }

    const remoteSyncTimeouts = remoteSyncTimeoutsRef.current;
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

    const scheduleSyncEditorToRedux = (levelIndex: number, editorType: "html" | "css" | "js") => {
      const key = `${levelIndex}:${editorType}`;
      const existingTimeout = remoteSyncTimeouts.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(() => {
        remoteSyncTimeouts.delete(key);
        syncEditorToRedux(levelIndex, editorType);
      }, LOCAL_REDUX_UPDATE_DEBOUNCE_MS);

      remoteSyncTimeouts.set(key, timeout);
    };

    for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
      for (const editorType of editorTypes) {
        const yText = getYText(editorType, levelIndex);
        if (!yText) {
          continue;
        }

        syncEditorToRedux(levelIndex, editorType);

        const observer = () => {
          scheduleSyncEditorToRedux(levelIndex, editorType);
        };

        yText.observe(observer);
        unobserveCallbacks.push(() => {
          yText.unobserve(observer);
        });
      }
    }

    return () => {
      remoteSyncTimeouts.forEach((timeout) => clearTimeout(timeout));
      remoteSyncTimeouts.clear();
      solutionPersistTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      solutionPersistTimeoutsRef.current.clear();
      unobserveCallbacks.forEach((unobserve) => unobserve());
    };
  }, [dispatch, getYText, levels.length, yjsDocGeneration, yjsReady]);

  // Creator-only: keep solutions in sync via Yjs and persist them to DB.
  useEffect(() => {
    if (!isCreator || !getYSolutionText || levels.length === 0) {
      return;
    }

    const editorTypes: Array<"html" | "css" | "js"> = ["html", "css", "js"];
    const unobserveCallbacks: Array<() => void> = [];
    const lastNonEmptySolutionByKey = new Map<string, { html: string; css: string; js: string }>();

    const syncSolutionToReduxAndPersist = (levelIndex: number) => {
      const yHtml = getYSolutionText("html", levelIndex);
      const yCss = getYSolutionText("css", levelIndex);
      const yJs = getYSolutionText("js", levelIndex);
      if (!yHtml || !yCss || !yJs) {
        return;
      }

      const nextSolution = {
        html: yHtml.toString(),
        css: yCss.toString(),
        js: yJs.toString(),
      };

      const stateLevels = store.getState().levels;
      const targetLevel = stateLevels[levelIndex];
      if (!targetLevel) {
        return;
      }

      if (
        targetLevel.solution?.html !== nextSolution.html ||
        targetLevel.solution?.css !== nextSolution.css ||
        targetLevel.solution?.js !== nextSolution.js
      ) {
        dispatch(updateSolutionCode({ id: levelIndex + 1, code: nextSolution }));
      }

      if (!targetLevel.identifier) {
        return;
      }

      const hasAnyContent = nextSolution.html.length > 0 || nextSolution.css.length > 0 || nextSolution.js.length > 0;
      const hadAnyContent =
        (targetLevel.solution?.html?.length ?? 0) > 0 ||
        (targetLevel.solution?.css?.length ?? 0) > 0 ||
        (targetLevel.solution?.js?.length ?? 0) > 0;

      // Never persist an all-empty snapshot over a previously non-empty solution.
      // This protects against transient empty state during reconnects/restarts.
      if (!hasAnyContent && hadAnyContent) {
        return;
      }

      const persistKey = `${targetLevel.identifier}:${levelIndex}`;
      if (hasAnyContent) {
        lastNonEmptySolutionByKey.set(persistKey, nextSolution);
      }
      const existingTimeout = solutionPersistTimeoutsRef.current.get(persistKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      const timeout = setTimeout(() => {
        solutionPersistTimeoutsRef.current.delete(persistKey);
        const payload = hasAnyContent ? nextSolution : lastNonEmptySolutionByKey.get(persistKey);
        if (!payload) {
          return;
        }
        fetch(apiUrl(`/api/levels/${targetLevel.identifier}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ solution: payload }),
        }).catch(() => {});
      }, 600);
      solutionPersistTimeoutsRef.current.set(persistKey, timeout);
    };

    for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
      // Initial sync (after Yjs becomes ready)
      syncSolutionToReduxAndPersist(levelIndex);
      for (const editorType of editorTypes) {
        const yText = getYSolutionText(editorType, levelIndex);
        if (!yText) {
          continue;
        }
        const observer = () => {
          syncSolutionToReduxAndPersist(levelIndex);
        };
        yText.observe(observer);
        unobserveCallbacks.push(() => yText.unobserve(observer));
      }
    }

    return () => {
      unobserveCallbacks.forEach((unobserve) => unobserve());
    };
  }, [dispatch, getYSolutionText, isCreator, levels.length, yjsDocGeneration]);

  const level = levels[currentLevel - 1] as Level | undefined;
  const yjsLevelCode = useYjsLevelCodeSnapshot(currentLevel - 1, level?.code ?? { html: "", css: "", js: "" });

  if (!level) {
    return null;
  }

  const identifier = level.identifier;

  const languages = {
    html: {
      code: yjsLevelCode.html || "",
      solution: level.solution.html || "",
      locked: level.lockHTML,
    },
    css: {
      code: yjsLevelCode.css || "",
      solution: level.solution.css || "",
      locked: level.lockCSS,
    },
    js: {
      code: yjsLevelCode.js || "",
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
