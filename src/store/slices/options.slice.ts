import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { obfuscate } from "../../utils/obfuscators/obfuscate";

interface OptionsState {
  darkMode: boolean;
  showWordCloud: boolean;
}

const initialState: OptionsState = {
  darkMode: false,
  showWordCloud: false,
};

const storage = obfuscate("options");

const storedOptions = storage.getItem(storage.key);
if (storedOptions) {
  initialState.darkMode = JSON.parse(storedOptions).darkMode;
  initialState.showWordCloud = JSON.parse(storedOptions).showWordCloud;
} else {
  initialState.darkMode = false;
  initialState.showWordCloud = false;
}

const optionsSlice = createSlice({
  name: "options",
  initialState,
  reducers: {
    setDarkMode(state, action: PayloadAction<boolean>) {
      state.darkMode = action.payload;

      storage.setItem(storage.key, JSON.stringify(state));
    },
    setShowWordCloud(state, action: PayloadAction<boolean>) {
      state.showWordCloud = action.payload;
      storage.setItem(storage.key, JSON.stringify(state));
    },
  },
});

export const { setDarkMode, setShowWordCloud } = optionsSlice.actions;

export default optionsSlice.reducer;
