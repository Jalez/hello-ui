import type { Dispatch, SetStateAction } from "react";

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

export function useCodeEditorCollaboration(options: UseCodeEditorCollaborationOptions) {
  return useYjsCodeEditorCollaboration(options);
}
