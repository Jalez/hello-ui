/** @format */

import { html } from "@codemirror/lang-html";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { Box, IconButton, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { Compartment } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { githubLight } from "@uiw/codemirror-theme-github";
import { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { useAppDispatch, useAppSelector } from "../../../store/hooks/hooks";
import { getCommentKeymap } from "./getCommentKeyMap";

import { handleLocking } from "../../../store/slices/levels.slice";
import EditorMagicButton from "../../CreatorControls/EditorMagicButton";
interface CodeEditorProps {
  lang: any;
  title: "HTML" | "CSS" | "JS";
  template?: string;
  codeUpdater: (data: { html?: string; css?: string }, type: string) => void;
  locked?: boolean;
  type: string;
  levelIdentifier: string;
}

const commentKeymapCompartment = new Compartment();

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
  const options = useAppSelector((state) => state.options);
  const theme = options.darkMode ? githubLight : vscodeDark;
  const handleCodeUpdate = (value: string) => {
    if (!locked) {
      setCode(value);
      // setSavedChanges(false);
    }
  };

  const isCreator = options.creator;
  // const [savedChanges, setSavedChanges] = useState<boolean>(true);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    // if (code !== "" && savedChanges) {
    if (code !== "") {
      // console.log("updating code: ", title.toLowerCase());
      timer = setTimeout(() => {
        codeUpdater({ [title.toLowerCase()]: code }, type);
      }, 200);
    }
    // listen for keydown events to set unsaved changes to true: ctrl + s

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [code]);
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
    setCode(template);
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
      // keymap.of(commentKeymap),
      commentKeymapCompartment.of(keymap.of(getCommentKeymap(title))), // default language
    ],
    theme: theme,
    placeholder: `Write your ${title} here...`,

    onChange: handleCodeUpdate,
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
      lineNumberCompartment.of([]),
    ],
    theme: theme,
    placeholder: `Write your ${title} here...`,
  };

  return (
    <Box
      className="codeEditorContainer"
      sx={{
        display: "flex",
        height: "100%",
        flexDirection: "column",
        width: "100%",
        position: "relative",

        // backgroundColor: theme === "dark" ? secondaryColor : mainColor,
      }}
    >
      {isCreator && (
        <Box
          sx={{
            position: "absolute",
            bottom: "0",
            right: "0",
            zIndex: 100,
          }}
        >
          <EditorMagicButton
            buttonColor="primary"
            EditorCode={code}
            editorType={title}
            editorCodeChanger={handleCodeUpdate}
            disabled={locked}
          />
        </Box>
      )}
      {locked && (
        <Typography
          variant="h3"
          color="primary"
          id="title"
          sx={{
            color: "red",
            position: "absolute",
            // put this in the middle of the editor and at a 45 degree angle
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) rotate(-45deg)",
            fontSize: "5rem",
            opacity: 0.2,
            zIndex: 1,
            // disable select
            userSelect: "none",
            // create a line background around everything else around it
            overflow: "hidden",
          }}
        >
          Locked
        </Typography>
      )}

      <Box
        className="codeEditor"
        sx={{
          flex: "1 1 20px",
          height: "100%",
          overflow: "auto",
          position: "relative",
        }}
        title={
          locked ? "You can't edit this code" : " Click on the code to edit it"
        }
      >
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
      </Box>
    </Box>
  );
}
