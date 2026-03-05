/** @format */
'use client';

import { html } from "@codemirror/lang-html";
import CodeMirror from "@uiw/react-codemirror";
import { Decoration, EditorView, tooltips } from "@codemirror/view";
import { EditorState, type Extension, type Range } from "@codemirror/state";
import { useEffect, useState, useRef, useCallback } from "react";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { Compartment } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { githubLight } from "@uiw/codemirror-theme-github";
import { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { useAppSelector } from "@/store/hooks/hooks";
import { getCommentKeymap } from "./getCommentKeyMap";
import EditorMagicButton from "@/components/CreatorControls/EditorMagicButton";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { EditorType, EditorCursor } from "@/lib/collaboration/types";
import { applyAcceptedHunks, buildLineDiffHunks, type DiffHunk } from "./lineDiff";

const TYPING_DEBOUNCE_MS = 300;
const LOCAL_CODE_UPDATE_DEBOUNCE_MS = 80;

function titleToEditorType(title: "HTML" | "CSS" | "JS"): EditorType {
  switch (title) {
    case "HTML":
      return "html";
    case "CSS":
      return "css";
    case "JS":
      return "js";
  }
}
interface CodeEditorProps {
  lang: Extension;
  title: "HTML" | "CSS" | "JS";
  template?: string;
  codeUpdater: (data: { html?: string; css?: string; js?: string }, type: string) => void;
  locked?: boolean;
  type: string;
  levelIdentifier: string;
}

const commentKeymapCompartment = new Compartment();
const reviewDecorationsCompartment = new Compartment();

interface CodeMirrorProps extends ReactCodeMirrorProps {
  options: {
    lineWrapping?: boolean;
    lineNumbers?: boolean;
    viewportMargin?: number;
    readOnly?: boolean;
    className?: string;
    screenReaderLabel?: string;
    autofocus?: boolean;
    highlightActiveLine?: boolean;
    // add any other CodeMirror options you need here
  };
}

const CodeEditorStyle = {
  overflow: "auto",
  boxSizing: "border-box" as const,
  margin: "0",
  padding: "0",
  minHeight: "20px",
};

interface RemoteEditorCaret {
  id: string;
  x: number;
  y: number;
  color: string;
}

const EMPTY_EDITOR_CURSORS = new Map<string, EditorCursor>();

export default function CodeEditor({
  lang = html(),
  title = "HTML",
  template = "",
  codeUpdater,
  locked = false,
  type = "Template",
  levelIdentifier,
}: CodeEditorProps) {
  const lineNumberCompartment = new Compartment();
  const [code, setCode] = useState<string>(template);
  const currentLevel = useAppSelector((state) => state.currentLevel.currentLevel);
  const options = useAppSelector((state) => state.options);
  const { theme: nextTheme } = useTheme();
  const isDark = nextTheme === 'dark' || (nextTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = isDark ? vscodeDark : githubLight;

  const collaboration = useOptionalCollaboration();
  const isConnected = collaboration?.isConnected ?? false;
  const setTyping = collaboration?.setTyping;
  const applyEditorChange = collaboration?.applyEditorChange;
  const updateEditorSelection = collaboration?.updateEditorSelection;
  const editorCursors = collaboration?.editorCursors ?? EMPTY_EDITOR_CURSORS;
  const editorType = titleToEditorType(title);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCodeRef = useRef<string | null>(null);
  const pendingSelectionRef = useRef<{ from: number; to: number }>({ from: 0, to: 0 });
  const editorViewRef = useRef<EditorView | null>(null);
  const editorViewportRef = useRef<HTMLDivElement | null>(null);
  const [remoteCarets, setRemoteCarets] = useState<RemoteEditorCaret[]>([]);
  const [aiReview, setAiReview] = useState<{ baseCode: string; hunks: DiffHunk[] } | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const handleTypingStart = useCallback(() => {
    if (isConnected && !locked && setTyping) {
      setTyping(editorType, true);
    }
  }, [isConnected, setTyping, editorType, locked]);

  const handleTypingEnd = useCallback(() => {
    if (isConnected && setTyping) {
      setTyping(editorType, false);
    }
  }, [isConnected, setTyping, editorType]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  const scheduleDebouncedSync = useCallback(() => {
    if (!isConnected || locked || !applyEditorChange || !updateEditorSelection) return;

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      const nextCode = pendingCodeRef.current;
      if (typeof nextCode === "string") {
        applyEditorChange(editorType, [nextCode], currentLevel - 1);
        pendingCodeRef.current = null;
      }

      const selection = pendingSelectionRef.current;
      updateEditorSelection(editorType, selection);
    }, TYPING_DEBOUNCE_MS);
  }, [isConnected, locked, applyEditorChange, updateEditorSelection, editorType, currentLevel]);

  useEffect(() => {
    if (!isConnected || !editorViewRef.current || !editorViewportRef.current) {
      if (remoteCarets.length > 0) {
        queueMicrotask(() => setRemoteCarets([]));
      }
      return;
    }

    let rafId: number | null = null;

    const recomputeCarets = () => {
      const view = editorViewRef.current;
      const viewport = editorViewportRef.current;
      if (!view || !viewport) {
        setRemoteCarets([]);
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();
      const docLen = view.state.doc.length;

      const nextCarets: RemoteEditorCaret[] = [];
      for (const [id, cursor] of editorCursors.entries()) {
        const typedCursor = cursor as EditorCursor;
        if (typedCursor.editorType !== editorType) continue;

        const rawPos = typedCursor.selection?.to ?? typedCursor.selection?.from ?? 0;
        const pos = Math.max(0, Math.min(rawPos, docLen));
        const coords = view.coordsAtPos(pos);
        if (!coords) continue;

        nextCarets.push({
          id,
          x: coords.left - viewportRect.left,
          y: coords.top - viewportRect.top,
          color: typedCursor.color,
        });
      }

      setRemoteCarets(nextCarets.slice(0, 12));
    };

    const scheduleRecompute = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(recomputeCarets);
    };

    scheduleRecompute();

    const view = editorViewRef.current;
    const scrollDom = view?.scrollDOM;
    const win = typeof window !== "undefined" ? window : null;

    scrollDom?.addEventListener("scroll", scheduleRecompute, { passive: true });
    win?.addEventListener("resize", scheduleRecompute);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      scrollDom?.removeEventListener("scroll", scheduleRecompute);
      win?.removeEventListener("resize", scheduleRecompute);
    };
  }, [editorCursors, editorType, code, isConnected, remoteCarets.length]);

  const buildReviewDecorations = useCallback((doc: EditorState["doc"], hunks: DiffHunk[]) => {
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
  }, []);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;

    const extension = aiReview
      ? buildReviewDecorations(view.state.doc, aiReview.hunks)
      : [];

    view.dispatch({
      effects: reviewDecorationsCompartment.reconfigure(extension),
    });
  }, [aiReview, buildReviewDecorations]);

  // Custom theme extension to ensure consistent line backgrounds and font size
  // Override all possible background styles from base themes
  const consistentLineTheme = EditorView.theme({
    "&": {
      backgroundColor: "transparent !important",
      fontSize: "14px",
      fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
    },
    ".cm-scroller": {
      backgroundColor: "transparent !important",
    },
    ".cm-content": {
      backgroundColor: "transparent !important",
      fontSize: "14px",
      fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
    },
    ".cm-line": {
      fontSize: "14px",
      fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
    },
    ".cm-ai-pending-line": {
      backgroundColor: isDark ? "rgba(250, 204, 21, 0.14)" : "rgba(250, 204, 21, 0.2)",
    },

    ".cm-gutters": {
      backgroundColor: "transparent !important",
      fontSize: "14px",
      fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
    },
    ".cm-gutter": {
      backgroundColor: "transparent !important",
    },
  }, { dark: isDark });
  const handleCodeUpdate = (value: string) => {
    if (!locked) {
      if (aiReview) {
        setAiReview(null);
      }
      setCode(value);

      // Typing detection + broadcast code change
      if (isConnected) {
        handleTypingStart();
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          handleTypingEnd();
        }, TYPING_DEBOUNCE_MS);

        pendingCodeRef.current = value;
        scheduleDebouncedSync();
      }
    }
  };

  const isCreator = options.creator;
  const pendingHunks = aiReview?.hunks.filter((hunk) => hunk.status === "pending") ?? [];
  const acceptedHunks = aiReview?.hunks.filter((hunk) => hunk.status === "accepted") ?? [];

  const handleAiSuggestion = useCallback(
    (suggestedCode: string) => {
      try {
        const hunks = buildLineDiffHunks(code, suggestedCode);
        if (hunks.length === 0) {
          setReviewError("AI suggestion did not include any code changes.");
          return;
        }
        setReviewError(null);
        setAiReview({ baseCode: code, hunks });
      } catch (error) {
        console.error("Failed to build AI diff hunks", error);
        setReviewError("Failed to build AI diff review.");
      }
    },
    [code],
  );

  const updateHunkStatus = useCallback((hunkId: string, status: DiffHunk["status"]) => {
    setAiReview((current) => {
      if (!current) return current;
      return {
        ...current,
        hunks: current.hunks.map((hunk) => (hunk.id === hunkId ? { ...hunk, status } : hunk)),
      };
    });
  }, []);

  const applyAcceptedChanges = useCallback(() => {
    setAiReview((current) => {
      if (!current) return current;
      const nextCode = applyAcceptedHunks(current.baseCode, current.hunks);
      setCode(nextCode);
      return null;
    });
  }, []);
  // const [savedChanges, setSavedChanges] = useState<boolean>(true);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    // Only sync to Redux when local editor content differs from source template.
    // This prevents idle re-renders from re-dispatching unchanged code.
    if (code !== template) {
      // console.log("updating code: ", title.toLowerCase());
      timer = setTimeout(() => {
        codeUpdater({ [title.toLowerCase()]: code }, type);
      }, LOCAL_CODE_UPDATE_DEBOUNCE_MS);
    }
    // listen for keydown events to set unsaved changes to true: ctrl + s

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [code, template, codeUpdater, title, type]);
  // }, [code, savedChanges]);

  // useEffect(() => {
  //   const handleKeyDown = (e: KeyboardEvent) => {
  //     if (e.ctrlKey && e.key === "s") {
  //       // can I prevent the default behavior of the browser here?
  //       e.preventDefault();
  //       // setSavedChanges(true);
  //     }
  //   };
  //   document.addEventListener("keydown", handleKeyDown);
  //   return () => {
  //     document.removeEventListener("keydown", handleKeyDown);
  //   };
  // }, [savedChanges]);

  useEffect(() => {
    setCode((prev) => (prev === template ? prev : template));
    setAiReview(null);
    setReviewError(null);
  }, [template, levelIdentifier]);

  const cmProps: CodeMirrorProps = {
    options: {
      lineWrapping: true,
      lineNumbers: true,
      // readOnly: true,
      className: "readOnly",
      screenReaderLabel: "Code Editor for " + title,
      autofocus: locked ? false : true,
      // make background black
    },
    // value: code,
    extensions: [
      lang,
      EditorState.readOnly.of(locked),
      EditorView.editable.of(!locked),
      EditorView.lineWrapping,
      consistentLineTheme,
      tooltips({ parent: typeof document !== 'undefined' ? document.body : undefined }),
      // keymap.of(commentKeymap),
      commentKeymapCompartment.of(keymap.of(getCommentKeymap(title))), // default language
      reviewDecorationsCompartment.of([]),
    ],
    theme: theme,
    placeholder: `Write your ${title} here...`,

    onChange: handleCodeUpdate,
    onCreateEditor: (view) => {
      editorViewRef.current = view;
    },
    onUpdate: (viewUpdate) => {
      const selection = viewUpdate.state.selection.main;
      pendingSelectionRef.current = {
        from: selection.from,
        to: selection.to,
      };

      if (isConnected && (viewUpdate.selectionSet || viewUpdate.docChanged)) {
        scheduleDebouncedSync();
      }

      if (viewUpdate.docChanged || viewUpdate.selectionSet || viewUpdate.viewportChanged) {
        const view = editorViewRef.current;
        const viewport = editorViewportRef.current;
        if (view && viewport) {
          const viewportRect = viewport.getBoundingClientRect();
          const docLen = view.state.doc.length;
          const nextCarets: RemoteEditorCaret[] = [];
          for (const [id, cursor] of editorCursors.entries()) {
            const typedCursor = cursor as EditorCursor;
            if (typedCursor.editorType !== editorType) continue;
            const rawPos = typedCursor.selection?.to ?? typedCursor.selection?.from ?? 0;
            const pos = Math.max(0, Math.min(rawPos, docLen));
            const coords = view.coordsAtPos(pos);
            if (!coords) continue;
            nextCarets.push({
              id,
              x: coords.left - viewportRect.left,
              y: coords.top - viewportRect.top,
              color: typedCursor.color,
            });
          }
          setRemoteCarets(nextCarets.slice(0, 12));
        }
      }
    },
  };

  const cmPropsFirstLine: CodeMirrorProps = {
    options: {
      lineWrapping: true,
      lineNumbers: false,
      readOnly: true,
      className: "readOnly",
      screenReaderLabel: "Code Editor for " + title,
      autofocus: locked ? false : true,
      highlightActiveLine: false,
    },
    // value: code,
    extensions: [
      // lang,
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
      consistentLineTheme,
      lineNumberCompartment.of([]),
    ],
    theme: theme,
    placeholder: `Write your ${title} here...`,
  };

      return (
        <div
          className="codeEditorContainer flex flex-1 flex-col w-full h-full relative min-h-0"
        >
      {isCreator && (
        <div className="absolute bottom-0 right-0 z-[100]">
          <EditorMagicButton
            buttonColor="primary"
            EditorCode={code}
            editorType={title}
            onSuggestion={handleAiSuggestion}
            disabled={locked}
          />
        </div>
      )}

      {isCreator && aiReview && (
        <div className="absolute top-1 right-1 z-[120] max-h-60 w-[380px] overflow-auto rounded-md border bg-card p-2 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">
              AI suggestion review: {pendingHunks.length} pending / {acceptedHunks.length} accepted
            </p>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setAiReview(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={applyAcceptedChanges} disabled={acceptedHunks.length === 0}>
                Apply Accepted
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {aiReview.hunks.map((hunk, index) => (
              <div key={hunk.id} className="rounded border bg-muted/40 p-2">
                <div className="mb-1 text-[11px] text-muted-foreground">
                  Change {index + 1} · lines {hunk.startOld + 1}-{Math.max(hunk.endOld, hunk.startOld + 1)}
                </div>
                <pre className="max-h-24 overflow-auto text-[11px] whitespace-pre-wrap rounded bg-background p-1">
                  {hunk.newLines.join("\n") || "(deletion)"}
                </pre>
                <div className="mt-2 flex gap-1">
                  <Button
                    size="sm"
                    variant={hunk.status === "accepted" ? "default" : "outline"}
                    onClick={() => updateHunkStatus(hunk.id, "accepted")}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant={hunk.status === "declined" ? "default" : "outline"}
                    onClick={() => updateHunkStatus(hunk.id, "declined")}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    variant={hunk.status === "pending" ? "default" : "outline"}
                    onClick={() => updateHunkStatus(hunk.id, "pending")}
                  >
                    Pending
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isCreator && reviewError && (
        <div className="absolute top-1 left-1 z-[120] rounded border border-destructive bg-card px-2 py-1 text-xs text-destructive">
          {reviewError}
        </div>
      )}

      <div
        className="codeEditor flex-[1_1_20px] overflow-auto relative min-h-0"
        title={
          locked ? "You can't edit this code" : " Click on the code to edit it"
        }
      >
        {locked && (
          <h3
            id="title"
            className="text-red-500 absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 text-5xl opacity-20 z-[1] select-none overflow-hidden drop-shadow-[2px_2px_2px_#000]"
          >
            Locked
          </h3>
        )}
        {title === "HTML" && (
          <div title="You can't edit this code">
            <CodeMirror
              {...cmPropsFirstLine}
              value={"<div id='root'>"}
              style={CodeEditorStyle}
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
              }}
            />
          </div>
        )}

        <div ref={editorViewportRef} className="relative">
          <CodeMirror
            {...cmProps}
            value={code}
            style={{
              overflow: "auto",
              boxSizing: "border-box",
              margin: "0",
              padding: "0",
            }}
          />
          {isConnected && remoteCarets.length > 0 && (
            <div className="pointer-events-none absolute inset-0 z-20">
              {remoteCarets.map((caret) => (
                <div
                  key={caret.id}
                  className="absolute"
                  style={{ left: caret.x, top: caret.y }}
                >
                  <div
                    className="h-5 w-[2px]"
                    style={{ backgroundColor: caret.color }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        {title === "HTML" && (
          <div title="You can't edit this code">
            <CodeMirror
              {...cmPropsFirstLine}
              value={"</div>"}
              style={CodeEditorStyle}
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
