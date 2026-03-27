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
      const { drawingUrl, scenarioId } = action.payload;
      if (state[scenarioId] === drawingUrl) return;
      state[scenarioId] = drawingUrl;
    },
    resetDrawingUrls() {
      return {};
    },
  },
});

export const { addDrawingUrl, resetDrawingUrls } = drawingUrlsSlice.actions;

export default drawingUrlsSlice.reducer;
