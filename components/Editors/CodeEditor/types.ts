import type { Extension } from "@codemirror/state";

import type { DiffHunk } from "./lineDiff";

export interface CodeEditorProps {
  lang: Extension;
  title: "HTML" | "CSS" | "JS";
  template?: string;
  codeUpdater: (data: { html?: string; css?: string; js?: string }, type: string) => void;
  locked?: boolean;
  type: string;
  levelIdentifier: string;
}

export interface RemoteEditorCaret {
  id: string;
  x: number;
  y: number;
  color: string;
}

export interface AiReviewState {
  baseCode: string;
  hunks: DiffHunk[];
}
