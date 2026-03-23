import type { EditorType, EditorCursor } from "@/lib/collaboration/types";

import type { RemoteEditorCaret } from "./types";

export function titleToEditorType(title: "HTML" | "CSS" | "JS"): EditorType {
  switch (title) {
    case "HTML":
      return "html";
    case "CSS":
      return "css";
    case "JS":
      return "js";
  }
}

export const EMPTY_EDITOR_CURSORS = new Map<string, EditorCursor>();

export function areRemoteCaretsEqual(a: RemoteEditorCaret[], b: RemoteEditorCaret[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((caret, index) => {
    const other = b[index];
    return (
      caret.id === other.id &&
      caret.x === other.x &&
      caret.y === other.y &&
      caret.color === other.color &&
      caret.showCaret === other.showCaret &&
      caret.selectionRects.length === other.selectionRects.length &&
      caret.selectionRects.every((rect, rectIndex) => {
        const otherRect = other.selectionRects[rectIndex];
        return rect.x === otherRect.x
          && rect.y === otherRect.y
          && rect.width === otherRect.width
          && rect.height === otherRect.height;
      })
    );
  });
}
