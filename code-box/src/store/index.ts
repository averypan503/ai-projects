import { configureStore } from '@reduxjs/toolkit';
import fileReducer from './fileSlice';
import tabReducer from './tabSlice';
import consoleReducer from './consoleSlice';
import uiReducer from './uiSlice';
import type { TabState } from './tabSlice';
import type { ConsoleState } from './consoleSlice';
import type { UIState } from './uiSlice';

const STORAGE_KEY = 'codebox-state';

interface SavedState {
  rootDirectoryName?: string;
  tabs: TabState;
  console: ConsoleState;
  ui: UIState;
}

const loadState = (): SavedState | undefined => {
  try {
    const storage = localStorage.getItem(STORAGE_KEY);
    if (!storage) return undefined;
    return JSON.parse(storage);
  } catch (err) {
    console.error('本地存储数据损坏，清空记录', err);
    localStorage.removeItem(STORAGE_KEY);
    return undefined;
  }
};

const saveState = (state: RootState) => {
  try {
    const persistData = {
      ui: {
        sidebarWidth: state.ui.sidebarWidth,
        consoleHeight: state.ui.consoleHeight,
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistData));
  } catch (err) {
    console.error('状态保存失败', err);
  }
};

const savedState = loadState();

const preloadedState = savedState ? {
  files: {
    tree: [],
    files: {},
    isLoadedFromLocal: false,
  },
  tabs: { tabs: [], activeTabId: null },
  console: { logs: [], isVisible: true },
  ui: savedState.ui,
} : undefined;

const store = configureStore({
  reducer: {
    files: fileReducer,
    tabs: tabReducer,
    console: consoleReducer,
    ui: uiReducer,
  },
  preloadedState,
});

store.subscribe(() => {
  saveState(store.getState());
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export { store };