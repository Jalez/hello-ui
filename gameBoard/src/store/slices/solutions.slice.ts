import { createSlice } from "@reduxjs/toolkit";

interface solutionsState {
  [key: string]: {
    SCSS: string;
    SHTML: string;
    SJS: string;
  };
}
const initialState: solutionsState = {};

const solutionsSlice = createSlice({
  name: "solutions",
  initialState,
  reducers: {
    addSolution(state, action) {
      const { solutionCode, levelId } = action.payload;
      state[levelId] = { ...solutionCode };
    },
    setSolutions(state, action) {
      return action.payload;
    },
  },
});

export const { addSolution, setSolutions } = solutionsSlice.actions;

export default solutionsSlice.reducer;
