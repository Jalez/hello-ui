import { EditorView } from "@codemirror/view";

export function createConsistentLineTheme(isDark: boolean) {
  return EditorView.theme({
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
}
