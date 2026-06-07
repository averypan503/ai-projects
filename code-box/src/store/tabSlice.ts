import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Tab {
  id: string;
  fileId: string;
  fileName: string;
  isModified: boolean;
}

export interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
}

const savedState = localStorage.getItem('codebox-state');
const initialTabs = savedState ? JSON.parse(savedState).tabs?.tabs || [] : [];
const initialActiveTabId = savedState ? JSON.parse(savedState).tabs?.activeTabId || null : null;

const initialState: TabState = {
  tabs: initialTabs,
  activeTabId: initialActiveTabId,
};

const tabSlice = createSlice({
  name: 'tabs',
  initialState,
  reducers: {
    openTab: (state, action: PayloadAction<{ fileId: string; fileName: string }>) => {
      const { fileId, fileName } = action.payload;

      const existingTab = state.tabs.find((tab) => tab.fileId === fileId);
      if (existingTab) {
        state.activeTabId = existingTab.id;
        return;
      }

      const newTab: Tab = {
        id: `tab-${Date.now()}`,
        fileId,
        fileName,
        isModified: false,
      };
      state.tabs.push(newTab);
      state.activeTabId = newTab.id;
    },

    closeTab: (state, action: PayloadAction<string>) => {
      const tabId = action.payload;
      const tabIndex = state.tabs.findIndex((tab) => tab.id === tabId);

      if (tabIndex === -1) return;

      state.tabs.splice(tabIndex, 1);

      if (state.activeTabId === tabId) {
        state.activeTabId = state.tabs.length > 0
          ? state.tabs[Math.min(tabIndex, state.tabs.length - 1)].id
          : null;
      }
    },

    closeTabByFileId: (state, action: PayloadAction<string>) => {
      const fileId = action.payload;
      const tabIndex = state.tabs.findIndex((tab) => tab.fileId === fileId);

      if (tabIndex === -1) return;

      const closingTabId = state.tabs[tabIndex].id;
      state.tabs.splice(tabIndex, 1);

      if (state.activeTabId === closingTabId) {
        state.activeTabId = state.tabs.length > 0
          ? state.tabs[Math.min(tabIndex, state.tabs.length - 1)].id
          : null;
      }
    },

    closeOtherTabs: (state, action: PayloadAction<string>) => {
      const keepTabId = action.payload;
      const keepTab = state.tabs.find((tab) => tab.id === keepTabId);

      if (!keepTab) return;

      state.tabs = [keepTab];
      state.activeTabId = keepTabId;
    },

    closeAllTabs: (state) => {
      state.tabs = [];
      state.activeTabId = null;
    },

    setActiveTab: (state, action: PayloadAction<string>) => {
      const tabId = action.payload;
      if (state.tabs.some((tab) => tab.id === tabId)) {
        state.activeTabId = tabId;
      }
    },

    markTabModified: (state, action: PayloadAction<string>) => {
      const fileId = action.payload;
      const tab = state.tabs.find((tab) => tab.fileId === fileId);
      if (tab) {
        tab.isModified = true;
      }
    },

    markTabSaved: (state, action: PayloadAction<string>) => {
      const fileId = action.payload;
      const tab = state.tabs.find((tab) => tab.fileId === fileId);
      if (tab) {
        tab.isModified = false;
      }
    },

    updateTabFileName: (state, action: PayloadAction<{ fileId: string; fileName: string }>) => {
      const { fileId, fileName } = action.payload;
      const tab = state.tabs.find((tab) => tab.fileId === fileId);
      if (tab) {
        tab.fileName = fileName;
      }
    },

    setTabs: (_state, action: PayloadAction<TabState>) => {
      return action.payload;
    },
  },
});

export const {
  openTab,
  closeTab,
  closeTabByFileId,
  closeOtherTabs,
  closeAllTabs,
  setActiveTab,
  markTabModified,
  markTabSaved,
  updateTabFileName,
  setTabs
} = tabSlice.actions;

export default tabSlice.reducer;