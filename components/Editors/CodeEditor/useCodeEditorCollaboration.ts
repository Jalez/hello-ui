import type { Dispatch, SetStateAction } from "react";

import { logCollaborationStep } from "@/lib/collaboration/logCollaborationStep";
import { useYjsCodeEditorCollaboration } from "./useYjsCodeEditorCollaboration";

interface UseCodeEditorCollaborationOptions {
  title: "HTML" | "CSS" | "JS";
  code: string;
  setCode: Dispatch<SetStateAction<string>>;
  template: string;
  enabled?: boolean;
  locked: boolean;
  levelIdentifier: string;
  currentLevel: number;
  onLocalChange?: () => void;
  onLocalUserInput?: () => void;
}

/**
 * COLLABORATION STEP 3.5:
 * Thin adapter that routes code editors into the current collaboration engine.
 * Right now that means every shared editor goes through the Yjs-backed flow.
 */
export function useCodeEditorCollaboration(options: UseCodeEditorCollaborationOptions) {
  logCollaborationStep("3.5", "useCodeEditorCollaboration", {
    title: options.title,
    levelIdentifier: options.levelIdentifier,
    currentLevel: options.currentLevel,
    enabled: options.enabled ?? true,
  });
  return useYjsCodeEditorCollaboration(options);
}
