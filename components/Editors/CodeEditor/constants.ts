import { Compartment } from "@codemirror/state";
import { DEFAULT_REMOTE_SYNC_DEBOUNCE_MS } from "@/lib/gameRuntimeConfig";

/** Build-time fallback only; prefer useGameRuntimeConfig().remoteSyncDebounceMs in components. */
export const REMOTE_SYNC_DEBOUNCE_MS = DEFAULT_REMOTE_SYNC_DEBOUNCE_MS;
export const LOCAL_REDUX_UPDATE_DEBOUNCE_MS = REMOTE_SYNC_DEBOUNCE_MS;

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
