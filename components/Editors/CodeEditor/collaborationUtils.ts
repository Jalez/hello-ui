import { ChangeSet, Text as CodeMirrorText } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import type { EditorCursor } from "@/lib/collaboration/types";

import type { RemoteEditorCaret } from "./types";

export function applyChangeSetToContent(content: string, changeSet: ChangeSet) {
  return changeSet.apply(CodeMirrorText.of(content.split("\n"))).toString();
}

export function rebasePendingChangeSet(
  pendingChangeSet: ChangeSet | null,
  remoteChangeSet: ChangeSet,
) {
  return pendingChangeSet ? pendingChangeSet.map(remoteChangeSet) : null;
}

export function matchesActiveEditor(
  message: { editorType: string; levelIndex: number },
  editorType: string,
  levelIndex: number,
) {
  return message.editorType === editorType && message.levelIndex === levelIndex;
}

export function buildRemoteCarets(
  view: EditorView,
  viewport: HTMLDivElement,
  editorCursors: Map<string, EditorCursor>,
  editorType: string,
  levelIndex: number,
) {
  const viewportRect = viewport.getBoundingClientRect();
  const docLen = view.state.doc.length;
  const nextCarets: RemoteEditorCaret[] = [];

  for (const [id, cursor] of editorCursors.entries()) {
    if (cursor.editorType !== editorType || cursor.levelIndex !== levelIndex) {
      continue;
    }

    const rawPos = cursor.selection?.to ?? cursor.selection?.from ?? 0;
    const pos = Math.max(0, Math.min(rawPos, docLen));
    const coords = view.coordsAtPos(pos);
    if (!coords) {
      continue;
    }

    nextCarets.push({
      id,
      x: coords.left - viewportRect.left,
      y: coords.top - viewportRect.top,
      color: cursor.color,
    });
  }

  return nextCarets.slice(0, 12);
}
