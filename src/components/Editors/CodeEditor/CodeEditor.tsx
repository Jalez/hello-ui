/** @format */

import { html } from "@codemirror/lang-html";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { Box, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { Compartment } from "@codemirror/state";

import { githubLight } from "@uiw/codemirror-theme-github";
import { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { useAppSelector } from "../../../store/hooks/hooks";

interface CodeEditorProps {
  lang: any;
  title: string;
  template?: string;
  codeUpdater: (data: { html?: string; css?: string }) => void;
  locked?: boolean;
  width?: string;
  levelIdentifier: string;
}

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
  width = "20%",
  levelIdentifier,
}: CodeEditorProps) {
  const lineNumberCompartment = new Compartment();
  const [code, setCode] = useState<string>(template);
  const options = useAppSelector((state) => state.options);
  const theme = options.darkMode ? githubLight : vscodeDark;
  const handleCodeUpdate = (value: string) => {
    if (!locked) {
      setCode(value);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (code !== "") {
      timer = setTimeout(() => {
        codeUpdater({ [title.toLowerCase()]: code });
      }, 200);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [code]);

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
    },
    // value: code,
    extensions: [
      lang,
      EditorState.readOnly.of(locked),
      EditorView.editable.of(!locked),
      EditorView.lineWrapping,
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
        minHeight: "600px",
        flexDirection: "column",
        width: width,

        // backgroundColor: theme === "dark" ? secondaryColor : mainColor,
      }}
    >
      <Typography variant="h3" color="primary" id="title">
        {title} {locked ? "(Locked)" : ""}
      </Typography>
      <Box
        className="codeEditor"
        sx={{
          flex: "1 1 20px",
          height: "100%",
          overflow: "auto",
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
