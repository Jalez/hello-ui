import { Compartment } from "@codemirror/state";

function readRemoteSyncDebounceMs(): number {
  const raw = process.env.NEXT_PUBLIC_REMOTE_SYNC_DEBOUNCE_MS;
  if (raw === undefined || raw === "") {
    return 0;
  }
  const n = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return n;
}

/** Yjs → Redux mirror and Frame render-ready → capture delay; set via NEXT_PUBLIC_REMOTE_SYNC_DEBOUNCE_MS (ms), default 0. */
export const REMOTE_SYNC_DEBOUNCE_MS = readRemoteSyncDebounceMs();
export const TYPING_IDLE_MS = 800;
export const LOCAL_REDUX_UPDATE_DEBOUNCE_MS = REMOTE_SYNC_DEBOUNCE_MS;

export const commentKeymapCompartment = new Compartment();
export const reviewDecorationsCompartment = new Compartment();

export const codeEditorStyle = {
  overflow: "auto",
  boxSizing: "border-box" as const,
  margin: "0",
  padding: "0",
  minHeight: "20px",
};
