import { createSlice } from "@reduxjs/toolkit";

interface solutionUrlsState {
  [key: string]: string;
}
const initialState: solutionUrlsState = {};

const solutionUrlsSlice = createSlice({
  name: "solutionUrls",
  initialState,
  reducers: {
    addSolutionUrl(state, action) {
      const { solutionUrl, scenarioId } = action.payload;
      state[scenarioId] = solutionUrl;
    },
    resetSolutionUrls(state) {
      return initialState;
    },
  },
});

export const { addSolutionUrl, resetSolutionUrls } = solutionUrlsSlice.actions;

export default solutionUrlsSlice.reducer;
