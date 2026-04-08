import { createSlice } from "@reduxjs/toolkit";

const name = "drawingUrls";

interface DrawingUrlsState {
  [key: string]: string;
}

const initialState: DrawingUrlsState = {};

const drawingUrlsSlice = createSlice({
  name,
  initialState,
  reducers: {
    addDrawingUrl(state, action) {
      const { drawingUrl, storageKey, scenarioId } = action.payload as {
        drawingUrl: string;
        storageKey?: string;
        scenarioId?: string;
      };
      const key = (storageKey?.trim() || scenarioId?.trim() || "");
      if (!key) return;
      if (state[key] === drawingUrl) return;
      state[key] = drawingUrl;
    },
    resetDrawingUrls() {
      return {};
    },
  },
});

export const { addDrawingUrl, resetDrawingUrls } = drawingUrlsSlice.actions;

export default drawingUrlsSlice.reducer;
