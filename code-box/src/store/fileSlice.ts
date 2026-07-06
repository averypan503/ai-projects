import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export const safePathToId = (path: string): string => {
  return btoa(encodeURIComponent(path));
};

export interface File {
  id: string;
  name: string;
  path: string;
  content: string;
  type: 'file' | 'folder';
  children?: File[];
  isLoaded?: boolean;
  fileHandle?: FileSystemFileHandle;
  directoryHandle?: FileSystemDirectoryHandle;
}

export interface FileState {
  tree: File[];
  files: Record<string, File>;
  isLoadedFromLocal: boolean;
}

function buildFileMap(files: File[]): Record<string, File> {
  const map: Record<string, File> = {};
  const build = (items: File[]) => {
    items.forEach((file) => {
      map[file.id] = file;
      if (file.children) {
        build(file.children);
      }
    });
  };
  build(files);
  return map;
}

const initialState: FileState = {
  tree: [],
  files: {},
  isLoadedFromLocal: false,
};

const fileSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    initializeEmptyState: (state) => {
      state.tree = [];
      state.files = {};
      state.isLoadedFromLocal = false;
    },

    addFile: (state, action: PayloadAction<{ parentId?: string; name: string; content?: string; fileHandle?: FileSystemFileHandle }>) => {
      const { parentId, name, content = '', fileHandle } = action.payload;
      const filePath = parentId ? `${state.files[parentId]?.path || ''}/${name}` : `/${name}`;
      const newFile: File = {
        id: safePathToId(filePath),
        name,
        path: filePath,
        content,
        type: 'file',
        fileHandle,
      };

      if (parentId && state.files[parentId]?.type === 'folder') {
        state.files[parentId].children = state.files[parentId].children || [];
        state.files[parentId].children.push(newFile);
      } else {
        state.tree.push(newFile);
      }
      state.files[newFile.id] = newFile;
    },

    addFolder: (state, action: PayloadAction<{ parentId?: string; name: string; directoryHandle?: FileSystemDirectoryHandle }>) => {
      const { parentId, name, directoryHandle } = action.payload;
      const folderPath = parentId ? `${state.files[parentId]?.path || ''}/${name}` : `/${name}`;
      const newFolder: File = {
        id: safePathToId(folderPath),
        name,
        path: folderPath,
        content: '',
        type: 'folder',
        children: [],
        directoryHandle,
      };

      if (parentId && state.files[parentId]?.type === 'folder') {
        state.files[parentId].children = state.files[parentId].children || [];
        state.files[parentId].children.push(newFolder);
      } else {
        state.tree.push(newFolder);
      }
      state.files[newFolder.id] = newFolder;
    },

    deleteFile: (state, action: PayloadAction<string>) => {
      const fileId = action.payload;
      const file = state.files[fileId];
      if (!file) return;

      const removeFromTree = (items: File[]): File[] => {
        return items.filter((item) => {
          if (item.id === fileId) {
            delete state.files[item.id];
            return false;
          }
          if (item.children) {
            item.children = removeFromTree(item.children);
          }
          return true;
        });
      };

      state.tree = removeFromTree(state.tree);
      delete state.files[fileId];
    },

    updateFileContent: (state, action: PayloadAction<{ id: string; content: string }>) => {
      const { id, content } = action.payload;
      if (state.files[id]) {
        state.files[id].content = content;
        state.files[id].isLoaded = true;
      }
    },

    updateFileName: (state, action: PayloadAction<{ id: string; name: string; path: string }>) => {
      const { id, name, path } = action.payload;
      if (state.files[id]) {
        const oldPath = state.files[id].path;
        state.files[id].name = name;
        state.files[id].path = path;

        const updateChildPaths = (children: File[], oldParentPath: string, newParentPath: string) => {
          children.forEach((child) => {
            child.path = child.path.replace(oldParentPath, newParentPath);
            if (state.files[child.id]) {
              state.files[child.id].path = child.path;
            }
            if (child.children) {
              updateChildPaths(child.children, oldParentPath + '/' + child.name, newParentPath + '/' + child.name);
            }
          });
        };

        if (state.files[id].children) {
          updateChildPaths(state.files[id].children, oldPath, path);
        }

        const updateTree = (items: File[]): void => {
          items.forEach((item) => {
            if (item.id === id) {
              item.name = name;
              item.path = path;
            }
            if (item.children) {
              updateTree(item.children);
            }
          });
        };
        updateTree(state.tree);
      }
    },

    loadLocalFiles: (state, action: PayloadAction<{ tree: File[]; files: Record<string, File> }>) => {
      const { tree, files } = action.payload;
      state.tree = tree;
      state.files = files;
      state.isLoadedFromLocal = true;
    },

    loadFolderChildren: (state, action: PayloadAction<{ folderId: string; children: File[] }>) => {
      const { folderId, children } = action.payload;

      // 1. 更新 state.files 中的 folder
      const folder = state.files[folderId];
      if (folder && folder.type === 'folder') {
        folder.children = children;
        folder.isLoaded = true;
        children.forEach((child) => {
          state.files[child.id] = child;
        });
      }

      // 2. 同时更新 state.tree 中的 folder（递归遍历 tree，确保同步更新）
      const updateInTree = (items: File[]): void => {
        for (const item of items) {
          if (item.id === folderId) {
            item.children = children;
            item.isLoaded = true;
            return;
          }
          if (item.children) {
            updateInTree(item.children);
          }
        }
      };
      updateInTree(state.tree);
    },

    setFolderLoaded: (state, action: PayloadAction<{ folderId: string }>) => {
      const { folderId } = action.payload;

      // 1. 更新 state.files 中的 folder
      const folder = state.files[folderId];
      if (folder && folder.type === 'folder') {
        folder.isLoaded = true;
      }

      // 2. 同时更新 state.tree 中的 folder（递归遍历 tree，确保同步更新）
      const updateInTree = (items: File[]): void => {
        for (const item of items) {
          if (item.id === folderId) {
            item.isLoaded = true;
            return;
          }
          if (item.children) {
            updateInTree(item.children);
          }
        }
      };
      updateInTree(state.tree);
    },

    clearLocalFiles: (state) => {
      state.tree = [];
      state.files = {};
      state.isLoadedFromLocal = false;
    },

    setFiles: (_state, action: PayloadAction<FileState>) => {
      return action.payload;
    },
  },
});

export const {
  initializeEmptyState,
  setRootName,
  clearRootRecord,
  addFile,
  addFolder,
  deleteFile,
  updateFileContent,
  updateFileName,
  setFiles,
  loadLocalFiles,
  clearLocalFiles,
  loadFolderChildren,
  setFolderLoaded,
} = fileSlice.actions;

export default fileSlice.reducer;