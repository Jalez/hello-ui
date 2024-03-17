/** @format */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { obfuscate } from "../../utils/obfuscators/obfuscate";

interface CurrentLevelState {
  currentLevel: number;
}

const initialState: CurrentLevelState = {
  currentLevel: 1,
};

const storage = obfuscate("currentLevel");

const currentLevel = storage.getItem(storage.key);
if (currentLevel) {
  initialState.currentLevel = parseInt(currentLevel);
} else {
  initialState.currentLevel = 1;
}

const currentLevelSlice = createSlice({
  name: "currentLevel",
  initialState,
  reducers: {
    setCurrentLevel(state, action: PayloadAction<number>) {
      // Get the whole store state

      state.currentLevel = action.payload;
      storage.setItem(storage.key, action.payload.toString());
    },
  },
});

export const { setCurrentLevel } = currentLevelSlice.actions;

export default currentLevelSlice.reducer;
