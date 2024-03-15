/** @format */

import { html } from "@codemirror/lang-html";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { Typography } from "@mui/material";
import { useEffect, useState, useRef } from "react";
import { vscodeDark, vscodeDarkInit } from "@uiw/codemirror-theme-vscode";
import {
  ReactCodeMirrorProps,
  ReactCodeMirrorRef,
} from "@uiw/react-codemirror";

import "./CodeEditor.css";

interface CodeEditorProps {
  lang: any;
  title: string;
  template?: string;
  codeUpdater: (data: { html?: string; css?: string }) => void;
  locked?: boolean;
  width?: string;
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
    // add any other CodeMirror options you need here
  };
}

export default function CodeEditor({
  lang = html(),
  title = "HTML",
  template = "",
  codeUpdater,
  locked = false,
  width = "20%",
}: CodeEditorProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const [code, setCode] = useState<string>(template);

  const handleCodeUpdate = (value: string) => {
    if (!locked) {
      // console.log("Code updated: ", value);
      setCode(value);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (code !== "") {
      timer = setTimeout(() => {
        codeUpdater({ [title.toLowerCase()]: code });

        // console.log("Updating in state");
      }, 200);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [code]);

  useEffect(() => {
    setCode(template);
  }, [template]);

  const editorTheme = vscodeDark;

  const cmProps: CodeMirrorProps = {
    options: {
      lineWrapping: true,
      lineNumbers: true,
      // viewportMargin: Infinity,
      readOnly: true,
      className: "readOnly",
      screenReaderLabel: "Code Editor for " + title,
      // add any other CodeMirror options you need here
      // height: "fit-content",
      autofocus: locked ? false : true,
    },
    value: code,
    extensions: [
      lang,
      EditorState.readOnly.of(locked),
      EditorView.editable.of(!locked),
      EditorView.lineWrapping,
    ],
    theme: editorTheme,
    placeholder: `Write your ${title} here...`,
    style: {
      overflow: "auto",
      boxSizing: "border-box",
      margin: "0",
      padding: "0",
    },

    onChange: handleCodeUpdate,
  };

  return (
    <div
      className="codeEditorContainer"
      style={{
        display: "flex",
        height: "100%",
        flexDirection: "column",
        width: width,
        // flex: `1 ${width} 20%`,
        // width: "49.5%",
        // include the border width
        // backgroundColor: "#1e1e1e",
      }}
    >
      <Typography
        variant="h3"
        // Make it h2

        color="primary"
        id="title"
      >
        {title} {locked ? "(Locked)" : ""}
      </Typography>
      <div
        className="codeEditor"
        style={{
          // maxWidth: width,
          flex: "1 1 20px",
          backgroundColor: "#1e1e1e",
          height: "100%",
          overflow: "auto",
        }}
        title={
          locked ? "You can't edit this code" : " Click on the code to edit it"
        }
      >
        <CodeMirror {...cmProps} />
      </div>
    </div>
  );
}
