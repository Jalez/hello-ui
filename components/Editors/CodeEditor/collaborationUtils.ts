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

function findSharedEdges(base: string, target: string) {
  let prefix = 0;
  const maxPrefix = Math.min(base.length, target.length);
  while (prefix < maxPrefix && base.charCodeAt(prefix) === target.charCodeAt(prefix)) {
    prefix += 1;
  }

  let suffix = 0;
  const maxSuffix = Math.min(base.length - prefix, target.length - prefix);
  while (
    suffix < maxSuffix &&
    base.charCodeAt(base.length - 1 - suffix) === target.charCodeAt(target.length - 1 - suffix)
  ) {
    suffix += 1;
  }

  return { prefix, suffix };
}

export function rebaseIntentChangeSet(
  previousSyncedContent: string,
  canonicalContent: string,
  intendedVisibleContent: string,
) {
  if (canonicalContent === intendedVisibleContent) {
    return null;
  }

  const { prefix, suffix } = findSharedEdges(previousSyncedContent, intendedVisibleContent);
  const removedBase = previousSyncedContent.slice(prefix, previousSyncedContent.length - suffix);
  const insertedText = intendedVisibleContent.slice(prefix, intendedVisibleContent.length - suffix);

  if (removedBase.length === 0 && insertedText.length === 0) {
    return null;
  }

  const prefixAnchor = previousSyncedContent.slice(0, prefix);
  const suffixAnchor = previousSyncedContent.slice(previousSyncedContent.length - suffix);

  let from = prefix;
  if (prefixAnchor && canonicalContent.startsWith(prefixAnchor)) {
    from = prefixAnchor.length;
  } else {
    from = Math.min(prefix, canonicalContent.length);
  }

  let to = from + removedBase.length;
  if (suffixAnchor && canonicalContent.endsWith(suffixAnchor)) {
    to = Math.max(from, canonicalContent.length - suffixAnchor.length);
  } else {
    to = Math.min(canonicalContent.length, from + removedBase.length);
  }

  return ChangeSet.of([{ from, to, insert: insertedText }], canonicalContent.length);
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

  const clampPos = (value: number) => Math.max(0, Math.min(value, docLen));

  const buildSelectionRects = (fromRaw: number, toRaw: number) => {
    const from = clampPos(fromRaw);
    const to = clampPos(toRaw);
    if (from === to) {
      return [] as Array<{ x: number; y: number; width: number; height: number }>;
    }
    const start = Math.min(from, to);
    const end = Math.max(from, to);

    const startLine = view.state.doc.lineAt(start);
    const endLine = view.state.doc.lineAt(end);
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];

    const maxLines = 20;
    let line = startLine;
    let lineCount = 0;
    while (lineCount < maxLines) {
      const lineStart = line.number === startLine.number ? start : line.from;
      const lineEnd = line.number === endLine.number ? end : line.to;
      const a = view.coordsAtPos(lineStart);
      const b = view.coordsAtPos(lineEnd);
      if (a && b) {
        const left = Math.min(a.left, b.left) - viewportRect.left;
        const right = Math.max(a.left, b.left) - viewportRect.left;
        const top = Math.min(a.top, b.top) - viewportRect.top;
        const bottom = Math.max(a.bottom, b.bottom) - viewportRect.top;
        const width = Math.max(2, right - left);
        const height = Math.max(2, bottom - top);
        rects.push({ x: left, y: top, width, height });
      }

      if (line.number >= endLine.number) {
        break;
      }
      lineCount += 1;
      line = view.state.doc.line(line.number + 1);
    }

    return rects;
  };

  for (const [id, cursor] of editorCursors.entries()) {
    if (cursor.editorType !== editorType || cursor.levelIndex !== levelIndex) {
      continue;
    }

    const rawPos = cursor.selection?.to ?? cursor.selection?.from ?? 0;
    const pos = clampPos(rawPos);
    const coords = view.coordsAtPos(pos);
    if (!coords) {
      continue;
    }

    nextCarets.push({
      id,
      x: coords.left - viewportRect.left,
      y: coords.top - viewportRect.top,
      color: cursor.color,
      showCaret: cursor.sessionRole !== "readonly",
      selectionRects: buildSelectionRects(cursor.selection?.from ?? pos, cursor.selection?.to ?? pos),
    });
  }

  return nextCarets.slice(0, 12);
}
