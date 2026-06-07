import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface LogEntry {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: Date;
}

export interface ConsoleState {
  logs: LogEntry[];
  isVisible: boolean;
}

const initialState: ConsoleState = {
  logs: [
    {
      id: 'init-1',
      type: 'info',
      message: 'CodeBox IDE initialized',
      timestamp: new Date(),
    },
    {
      id: 'init-2',
      type: 'success',
      message: 'All components loaded successfully',
      timestamp: new Date(),
    },
  ],
  isVisible: true,
};

const consoleSlice = createSlice({
  name: 'console',
  initialState,
  reducers: {
    addLog: (state, action: PayloadAction<{ type: LogEntry['type']; message: string }>) => {
      const { type, message } = action.payload;
      const newLog: LogEntry = {
        id: `log-${Date.now()}`,
        type,
        message,
        timestamp: new Date(),
      };
      state.logs.push(newLog);
    },

    clearLogs: (state) => {
      state.logs = [];
    },

    setVisibility: (state, action: PayloadAction<boolean>) => {
      state.isVisible = action.payload;
    },

    setLogs: (_state, action: PayloadAction<ConsoleState>) => {
      return action.payload;
    },
  },
});

export const { addLog, clearLogs, setVisibility, setLogs } = consoleSlice.actions;

export default consoleSlice.reducer;