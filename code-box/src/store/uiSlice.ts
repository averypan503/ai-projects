import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UIState {
  sidebarWidth: number;
  consoleHeight: number;
}

const initialState: UIState = {
  sidebarWidth: 250,
  consoleHeight: 200,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSidebarWidth: (state, action: PayloadAction<number>) => {
      state.sidebarWidth = Math.max(200, Math.min(450, action.payload));
    },

    setConsoleHeight: (state, action: PayloadAction<number>) => {
      state.consoleHeight = Math.max(80, Math.min(400, action.payload));
    },

    setUIState: (_state, action: PayloadAction<UIState>) => {
      return action.payload;
    },
  },
});

export const { setSidebarWidth, setConsoleHeight, setUIState } = uiSlice.actions;

export default uiSlice.reducer;