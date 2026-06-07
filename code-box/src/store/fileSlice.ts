import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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

const defaultFiles: File[] = [
  {
    id: '1',
    name: 'index.html',
    path: '/index.html',
    content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>CodeBox</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div id="app"></div>\n  <script src="app.js"></script>\n</body>\n</html>',
    type: 'file',
    isLoaded: true,
  },
  {
    id: '2',
    name: 'src',
    path: '/src',
    content: '',
    type: 'folder',
    children: [
      {
        id: '2-1',
        name: 'app.js',
        path: '/src/app.js',
        content: '// CodeBox Application\nconst app = {\n  name: "CodeBox",\n  version: "1.0.0",\n  description: "A lightweight web-based IDE",\n};\n\nconsole.log("Welcome to CodeBox!");\n\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n\nexport default app;',
        type: 'file',
        isLoaded: true,
      },
      {
        id: '2-2',
        name: 'style.css',
        path: '/src/style.css',
        content: '* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\n  background-color: #1e1e1e;\n  color: #d4d4d4;\n  min-height: 100vh;\n}\n\n#app {\n  padding: 20px;\n}',
        type: 'file',
        isLoaded: true,
      },
    ],
    isLoaded: true,
  },
];

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
  tree: defaultFiles,
  files: buildFileMap(defaultFiles),
  isLoadedFromLocal: false,
};

const fileSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    addFile: (state, action: PayloadAction<{ parentId?: string; name: string; content?: string; fileHandle?: FileSystemFileHandle }>) => {
      const { parentId, name, content = '', fileHandle } = action.payload;
      const newFile: File = {
        id: `file-${Date.now()}`,
        name,
        path: parentId ? `${state.files[parentId]?.path || ''}/${name}` : `/${name}`,
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
      const newFolder: File = {
        id: `folder-${Date.now()}`,
        name,
        path: parentId ? `${state.files[parentId]?.path || ''}/${name}` : `/${name}`,
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

        // 递归更新所有子节点路径和文件映射
        const updateChildPaths = (children: File[], oldParentPath: string, newParentPath: string) => {
          children.forEach((child) => {
            // 更新子节点路径
            child.path = child.path.replace(oldParentPath, newParentPath);
            // 更新文件映射中的子节点
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

        // 更新树结构中的节点
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
      const folder = state.files[folderId];
      if (folder && folder.type === 'folder') {
        folder.children = children;
        folder.isLoaded = true;
        children.forEach((child) => {
          state.files[child.id] = child;
        });
      }
    },

    setFolderLoaded: (state, action: PayloadAction<{ folderId: string }>) => {
      const { folderId } = action.payload;
      const folder = state.files[folderId];
      if (folder && folder.type === 'folder') {
        folder.isLoaded = true;
      }
    },

    clearLocalFiles: (state) => {
      state.tree = defaultFiles;
      state.files = buildFileMap(defaultFiles);
      state.isLoadedFromLocal = false;
    },

    setFiles: (_state, action: PayloadAction<FileState>) => {
      return action.payload;
    },
  },
});

export const { addFile, addFolder, deleteFile, updateFileContent, updateFileName, setFiles, loadLocalFiles, clearLocalFiles, loadFolderChildren, setFolderLoaded } = fileSlice.actions;

export default fileSlice.reducer;