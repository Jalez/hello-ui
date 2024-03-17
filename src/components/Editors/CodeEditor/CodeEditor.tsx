/** @format */

import { html } from "@codemirror/lang-html";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { Typography } from "@mui/material";
import { useEffect, useState, useRef } from "react";
import { vscodeDark, vscodeDarkInit } from "@uiw/codemirror-theme-vscode";

import {
  duotoneLight,
  duotoneLightInit,
  duotoneDark,
  duotoneDarkInit,
} from "@uiw/codemirror-theme-duotone";
import {
  ReactCodeMirrorProps,
  ReactCodeMirrorRef,
} from "@uiw/react-codemirror";
import { useAppSelector } from "../../../store/hooks/hooks";
import { mainColor, secondaryColor } from "../../../constants";

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

  const options = useAppSelector((state) => state.options);
  const theme = options.darkMode ? duotoneLight : vscodeDark;
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
  }, [template]);

  const editorTheme = vscodeDark;
  // const editorTheme = duotoneLight;

  const cmProps: CodeMirrorProps = {
    options: {
      lineWrapping: true,
      lineNumbers: true,
      readOnly: true,
      className: "readOnly",
      screenReaderLabel: "Code Editor for " + title,
      autofocus: locked ? false : true,
    },
    value: code,
    extensions: [
      lang,
      EditorState.readOnly.of(locked),
      EditorView.editable.of(!locked),
      EditorView.lineWrapping,
    ],
    theme: theme,
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

        // backgroundColor: theme === "dark" ? secondaryColor : mainColor,
      }}
    >
      <Typography variant="h3" color="primary" id="title">
        {title} {locked ? "(Locked)" : ""}
      </Typography>
      <div
        className="codeEditor"
        style={{
          flex: "1 1 20px",
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
