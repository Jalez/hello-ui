/** @format */
'use client';

import { html } from "@codemirror/lang-html";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, tooltips } from "@codemirror/view";
import { githubLight } from "@uiw/codemirror-theme-github";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import CodeMirror from "@uiw/react-codemirror";
import type { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { useCodeMirror } from "@uiw/react-codemirror";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

import EditorMagicButton from "@/components/CreatorControls/EditorMagicButton";
import { useAppSelector } from "@/store/hooks/hooks";
import { useGameplayTelemetry } from "@/components/General/useGameplayTelemetry";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";

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
import { titleToEditorType } from "./utils";

const lineNumberCompartment = new Compartment();

function YjsEditorSurface({
  editorProps,
  editorKey,
  editorInitialState,
  style,
}: {
  editorProps: ReactCodeMirrorProps;
  editorKey: string;
  editorInitialState: { json: unknown };
  style: React.CSSProperties;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const { setContainer } = useCodeMirror({
    ...editorProps,
    initialState: editorInitialState,
  });

  useEffect(() => {
    if (hostRef.current) {
      setContainer(hostRef.current);
    }
  }, [setContainer]);

  return <div key={editorKey} ref={hostRef} style={style} />;
}

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
  const currentLevel = useAppSelector((state) => state.currentLevel.currentLevel);
  const options = useAppSelector((state) => state.options);
  const { recordPaste, recordEditorActivity } = useGameplayTelemetry();
  const { theme: nextTheme } = useTheme();
  const isDark =
    nextTheme === "dark" ||
    (nextTheme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const theme = isDark ? vscodeDark : githubLight;
  const consistentLineTheme = createConsistentLineTheme(isDark);
  const lastActivityTsRef = useRef<number | null>(null);
  const collaboration = useOptionalCollaboration();

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
    isYjsManaged,
    editorExtensions,
    editorKey,
    editorInitialState,
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
    onLocalUserInput: options.mode === "game"
      ? () => {
          const now = Date.now();
          const delta = lastActivityTsRef.current == null ? 1200 : now - lastActivityTsRef.current;
          lastActivityTsRef.current = now;
          recordEditorActivity(currentLevel - 1, delta);
        }
      : undefined,
  });
  const editorType = titleToEditorType(title);

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

  const flushPendingLocalCodeUpdate = useCallback((pendingCode) => {
    if (pendingCode === null || pendingCode === template) {
      return;
    }
    // In Yjs mode, Redux is synced from the shared Y.Doc observer in Editors.tsx.
    // Pushing transient local mirror state here creates a second authority and
    // can reintroduce stale template churn during concurrent typing.
    if (isYjsManaged) {
      return;
    }
    // Skip if applying external update (avoids echo).
    if (applyingExternalUpdateRef.current) {
      return;
    }
    codeUpdater({ [title.toLowerCase()]: pendingCode }, type);
  }, [applyingExternalUpdateRef, codeUpdater, isYjsManaged, template, title, type]);

  useEffect(() => {
    if (!isYjsManaged && applyingExternalUpdateRef.current) {
      return;
    }

    if (code === template) {
      return;
    }
    const timeout = setTimeout(() => {
      flushPendingLocalCodeUpdate(code);
    }, LOCAL_REDUX_UPDATE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
    }
  }, [applyingExternalUpdateRef, code, flushPendingLocalCodeUpdate, isYjsManaged, template]);


  useEffect(() => {
    clearReview();
  }, [clearReview, levelIdentifier, template]);

  useEffect(() => {
    if (!collaboration?.reportEditorWatchState) {
      return;
    }

    const interval = window.setInterval(() => {
      const view = editorViewRef.current;
      const isFocused = view?.hasFocus ?? false;
      const isEditable = !locked && Boolean(view?.contentDOM?.isContentEditable ?? true);
      const version = isYjsManaged ? null : collaboration.getEditorVersion(editorType, currentLevel - 1);

      collaboration.reportEditorWatchState({
        editorType,
        levelIndex: currentLevel - 1,
        content: code,
        version,
        isEditable,
        isFocused,
        isTyping: false,
        source: "interval",
      });

      if (isFocused && !isEditable && !locked) {
        collaboration.reportCollaborationHealthEvent("editor_readonly_stall", "warn", {
          contentLength: code.length,
          version,
        }, {
          editorType,
          levelIndex: currentLevel - 1,
        });
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [code, collaboration, currentLevel, editorType, isYjsManaged, locked, editorViewRef]);

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
      EditorView.domEventHandlers({
        paste: (event) => {
          if (options.mode !== "game") {
            return false;
          }
          const clipboardText = event.clipboardData?.getData("text") ?? "";
          recordPaste(currentLevel - 1, clipboardText.length);
          return false;
        },
      }),
      ...sharedExtensions,
      commentKeymapCompartment.of(keymap.of(getCommentKeymap(title))),
      reviewDecorationsCompartment.of([]),
      ...editorExtensions,
    ],
    theme,
    placeholder: `Write your ${title} here...`,
    ...(isYjsManaged
      ? {}
      : {
          onChange: (value: string) => {
            if (options.mode === "game") {
              const now = Date.now();
              const delta = lastActivityTsRef.current == null ? 1200 : now - lastActivityTsRef.current;
              lastActivityTsRef.current = now;
              recordEditorActivity(currentLevel - 1, delta);
            }
            handleCodeUpdate(value);
          },
        }),
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

  const editorStyle: React.CSSProperties = {
    overflow: "auto",
    boxSizing: "border-box",
    margin: "0",
    padding: "0",
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
          {isYjsManaged ? (
            <YjsEditorSurface
              key={editorKey}
              editorProps={editableEditorProps}
              editorKey={editorKey}
              editorInitialState={editorInitialState}
              style={editorStyle}
            />
          ) : (
            <CodeMirror
              {...editableEditorProps}
              key={editorKey}
              value={code}
              style={editorStyle}
            />
          )}
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
