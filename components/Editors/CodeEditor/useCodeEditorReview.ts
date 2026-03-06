import { type Dispatch, type SetStateAction, useCallback, useState } from "react";
import { type EditorState, type Range } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

import { applyAcceptedHunks, buildLineDiffHunks, type DiffHunk } from "./lineDiff";
import type { AiReviewState } from "./types";

interface UseCodeEditorReviewOptions {
  code: string;
  setCode: Dispatch<SetStateAction<string>>;
}

export function useCodeEditorReview({ code, setCode }: UseCodeEditorReviewOptions) {
  const [review, setReview] = useState<AiReviewState | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const clearReview = useCallback(() => {
    setReview(null);
    setReviewError(null);
  }, []);

  const handleAiSuggestion = useCallback((suggestedCode: string) => {
    try {
      const hunks = buildLineDiffHunks(code, suggestedCode);
      if (hunks.length === 0) {
        setReviewError("AI suggestion did not include any code changes.");
        return;
      }

      setReviewError(null);
      setReview({ baseCode: code, hunks });
    } catch (error) {
      console.error("Failed to build AI diff hunks", error);
      setReviewError("Failed to build AI diff review.");
    }
  }, [code]);

  const updateHunkStatus = useCallback((hunkId: string, status: DiffHunk["status"]) => {
    setReview((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        hunks: current.hunks.map((hunk) => (hunk.id === hunkId ? { ...hunk, status } : hunk)),
      };
    });
  }, []);

  const applyAcceptedChanges = useCallback(() => {
    setReview((current) => {
      if (!current) {
        return current;
      }

      setCode(applyAcceptedHunks(current.baseCode, current.hunks));
      return null;
    });
  }, [setCode]);

  const pendingHunks = review?.hunks.filter((hunk) => hunk.status === "pending") ?? [];
  const acceptedHunks = review?.hunks.filter((hunk) => hunk.status === "accepted") ?? [];

  return {
    review,
    reviewError,
    pendingHunks,
    acceptedHunks,
    clearReview,
    handleAiSuggestion,
    updateHunkStatus,
    applyAcceptedChanges,
  };
}

export function buildReviewDecorations(doc: EditorState["doc"], hunks: DiffHunk[]) {
  const ranges: Range<Decoration>[] = [];
  const pendingHunks = hunks.filter((hunk) => hunk.status === "pending");

  for (const hunk of pendingHunks) {
    const startLineNumber = Math.min(Math.max(hunk.startOld + 1, 1), doc.lines);
    const endLineNumber = Math.min(
      Math.max((hunk.endOld > hunk.startOld ? hunk.endOld : hunk.startOld + 1), 1),
      doc.lines,
    );

    for (let line = startLineNumber; line <= endLineNumber; line += 1) {
      ranges.push(Decoration.line({ class: "cm-ai-pending-line" }).range(doc.line(line).from));
    }
  }

  return EditorView.decorations.of(Decoration.set(ranges));
}
