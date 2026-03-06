import CodeMirror from "@uiw/react-codemirror";
import type { ReactCodeMirrorProps } from "@uiw/react-codemirror";

import { codeEditorStyle } from "./constants";

interface HtmlFrameLineProps {
  value: string;
  props: ReactCodeMirrorProps;
}

export function HtmlFrameLine({ value, props }: HtmlFrameLineProps) {
  return (
    <div title="You can't edit this code">
      <CodeMirror
        {...props}
        value={value}
        style={codeEditorStyle}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
        }}
      />
    </div>
  );
}
