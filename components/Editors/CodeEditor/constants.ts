import { Compartment } from "@codemirror/state";

export const REMOTE_SYNC_DEBOUNCE_MS = 500;
export const TYPING_IDLE_MS = 800;

export const commentKeymapCompartment = new Compartment();
export const reviewDecorationsCompartment = new Compartment();

export const codeEditorStyle = {
  overflow: "auto",
  boxSizing: "border-box" as const,
  margin: "0",
  padding: "0",
  minHeight: "20px",
};
