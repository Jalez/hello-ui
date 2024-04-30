import { createSlice } from "@reduxjs/toolkit";

interface differenceUrlsState {
  [key: string]: string;
}
const initialState: differenceUrlsState = {};

const differenceUrlsSlice = createSlice({
  name: "differenceUrls",
  initialState,
  reducers: {
    addDifferenceUrl(state, action) {
      const { differenceUrl, scenarioId } = action.payload;
      state[scenarioId] = differenceUrl;
    },
  },
});

export const { addDifferenceUrl } = differenceUrlsSlice.actions;

export default differenceUrlsSlice.reducer;
