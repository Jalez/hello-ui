/** @format */
'use client';

import { html } from "@codemirror/lang-html";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, tooltips } from "@codemirror/view";
import { githubLight } from "@uiw/codemirror-theme-github";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import CodeMirror from "@uiw/react-codemirror";
import type { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

import EditorMagicButton from "@/components/CreatorControls/EditorMagicButton";
import { useAppSelector } from "@/store/hooks/hooks";

import { AiReviewPanel } from "./AiReviewPanel";
import {
  commentKeymapCompartment,
  reviewDecorationsCompartment,
  LOCAL_REDUX_UPDATE_DEBOUNCE_MS,
} from "./constants";
import { getCommentKeymap } from "./getCommentKeyMap";
import { HtmlFrameLine } from "./HtmlFrameLine";
import { RemoteCaretsOverlay } from "./RemoteCaretsOverlay";
import { createConsistentLineTheme } from "./theme";
import type { CodeEditorProps } from "./types";
import { useCodeEditorCollaboration } from "./useCodeEditorCollaboration";
import { buildReviewDecorations, useCodeEditorReview } from "./useCodeEditorReview";

const lineNumberCompartment = new Compartment();

export default function CodeEditor({
  lang = html(),
  title = "HTML",
  template = "",
  codeUpdater,
  locked = false,
  type = "Template",
  levelIdentifier,
}: CodeEditorProps) {
  const [code, setCode] = useState(template);
  const localUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCodeForReduxRef = useRef<string | null>(null);
  const currentLevel = useAppSelector((state) => state.currentLevel.currentLevel);
  const options = useAppSelector((state) => state.options);
  const { theme: nextTheme } = useTheme();
  const isDark =
    nextTheme === "dark" ||
    (nextTheme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const theme = isDark ? vscodeDark : githubLight;
  const consistentLineTheme = createConsistentLineTheme(isDark);

  const {
    review,
    reviewError,
    clearReview,
    handleAiSuggestion,
    updateHunkStatus,
    applyAcceptedChanges,
  } = useCodeEditorReview({
    code,
    setCode,
  });

  const {
    isConnected,
    remoteCarets,
    editorViewportRef,
    editorViewRef,
    applyingExternalUpdateRef,
    handleCodeUpdate,
    handleEditorCreate,
    handleEditorUpdate,
  } = useCodeEditorCollaboration({
    title,
    code,
    setCode,
    template,
    enabled: type === "Template",
    locked,
    levelIdentifier,
    currentLevel,
    onLocalChange: review ? clearReview : undefined,
  });

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) {
      return;
    }

    const extension = review
      ? buildReviewDecorations(view.state.doc, review.hunks)
      : [];

    view.dispatch({
      effects: reviewDecorationsCompartment.reconfigure(extension),
    });
  }, [editorViewRef, review]);

  const flushPendingLocalCodeUpdate = useCallback(() => {
    const pendingCode = pendingCodeForReduxRef.current;
    if (pendingCode === null || applyingExternalUpdateRef.current || pendingCode === template) {
      pendingCodeForReduxRef.current = null;
      return;
    }

    codeUpdater({ [title.toLowerCase()]: pendingCode }, type);
    pendingCodeForReduxRef.current = null;
  }, [applyingExternalUpdateRef, codeUpdater, template, title, type]);

  useEffect(() => {
    if (applyingExternalUpdateRef.current) {
      return;
    }

    if (code === template) {
      if (localUpdateTimeoutRef.current) {
        clearTimeout(localUpdateTimeoutRef.current);
        localUpdateTimeoutRef.current = null;
      }
      pendingCodeForReduxRef.current = null;
      return;
    }

    pendingCodeForReduxRef.current = code;
    if (localUpdateTimeoutRef.current) {
      clearTimeout(localUpdateTimeoutRef.current);
    }

    localUpdateTimeoutRef.current = setTimeout(() => {
      localUpdateTimeoutRef.current = null;
      flushPendingLocalCodeUpdate();
    }, LOCAL_REDUX_UPDATE_DEBOUNCE_MS);
  }, [applyingExternalUpdateRef, code, flushPendingLocalCodeUpdate, template]);

  useEffect(() => {
    return () => {
      if (localUpdateTimeoutRef.current) {
        clearTimeout(localUpdateTimeoutRef.current);
        localUpdateTimeoutRef.current = null;
      }
      flushPendingLocalCodeUpdate();
    };
  }, [flushPendingLocalCodeUpdate]);

  useEffect(() => {
    clearReview();
  }, [clearReview, levelIdentifier, template]);

  const sharedExtensions = [
    consistentLineTheme,
    tooltips({ parent: typeof document !== "undefined" ? document.body : undefined }),
  ];

  const editableEditorProps: ReactCodeMirrorProps = {
    extensions: [
      lang,
      EditorState.readOnly.of(locked),
      EditorView.editable.of(!locked),
      EditorView.lineWrapping,
      ...sharedExtensions,
      commentKeymapCompartment.of(keymap.of(getCommentKeymap(title))),
      reviewDecorationsCompartment.of([]),
    ],
    theme,
    placeholder: `Write your ${title} here...`,
    onChange: handleCodeUpdate,
    onCreateEditor: handleEditorCreate,
    onUpdate: handleEditorUpdate,
  };

  const htmlFrameLineProps: ReactCodeMirrorProps = {
    extensions: [
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
      consistentLineTheme,
      lineNumberCompartment.of([]),
    ],
    theme,
    placeholder: `Write your ${title} here...`,
  };

  return (
    <div className="codeEditorContainer relative flex h-full min-h-0 w-full flex-1 flex-col">
      {options.creator && (
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

      {options.creator && review && (
        <AiReviewPanel
          review={review}
          onClose={clearReview}
          onApplyAccepted={applyAcceptedChanges}
          onUpdateHunkStatus={updateHunkStatus}
        />
      )}

      {options.creator && reviewError && (
        <div className="absolute top-1 left-1 z-[120] rounded border border-destructive bg-card px-2 py-1 text-xs text-destructive">
          {reviewError}
        </div>
      )}

      <div
        className="codeEditor relative min-h-0 flex-[1_1_20px] overflow-auto"
        title={locked ? "You can't edit this code" : " Click on the code to edit it"}
      >
        {locked && (
          <h3
            id="title"
            className="absolute left-1/2 top-[20%] z-[1] -translate-x-1/2 -translate-y-1/2 -rotate-45 select-none overflow-hidden text-5xl text-red-500 opacity-20 drop-shadow-[2px_2px_2px_#000]"
          >
            Locked
          </h3>
        )}

        {title === "HTML" && (
          <HtmlFrameLine
            value={"<div id='root'>"}
            props={htmlFrameLineProps}
          />
        )}

        <div ref={editorViewportRef} className="relative">
          <CodeMirror
            {...editableEditorProps}
            value={code}
            style={{
              overflow: "auto",
              boxSizing: "border-box",
              margin: "0",
              padding: "0",
            }}
          />
          {isConnected && <RemoteCaretsOverlay carets={remoteCarets} />}
        </div>

        {title === "HTML" && (
          <HtmlFrameLine
            value={"</div>"}
            props={htmlFrameLineProps}
          />
        )}
      </div>
    </div>
  );
}
