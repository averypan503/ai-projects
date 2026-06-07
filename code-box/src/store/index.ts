import { configureStore, Middleware } from '@reduxjs/toolkit';
import fileReducer from './fileSlice';
import tabReducer from './tabSlice';
import consoleReducer from './consoleSlice';
import uiReducer from './uiSlice';
import type { FileState } from './fileSlice';
import type { TabState } from './tabSlice';
import type { ConsoleState } from './consoleSlice';
import type { UIState } from './uiSlice';

const STORAGE_KEY = 'codebox-state';

interface SavedState {
  files: FileState;
  tabs: TabState;
  console: ConsoleState;
  ui: UIState;
}

const loadState = (): SavedState | undefined => {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (serialized === null) return undefined;
    return JSON.parse(serialized);
  } catch {
    return undefined;
  }
};

const saveState = (state: RootState) => {
  try {
    const serialized = JSON.stringify({
      files: state.files,
      tabs: state.tabs,
      console: state.console,
      ui: state.ui,
    });
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    console.error('Failed to save state to localStorage');
  }
};

const persistenceMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);
  saveState(store.getState());
  return result;
};

const savedState = loadState();

const store = configureStore({
  reducer: {
    files: fileReducer,
    tabs: tabReducer,
    console: consoleReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(persistenceMiddleware),
  preloadedState: savedState,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export { store };