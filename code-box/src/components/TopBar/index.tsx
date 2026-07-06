import { useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addLog } from '@/store/consoleSlice';
import { openTab, closeAllTabs } from '@/store/tabSlice';
import { loadLocalFiles, initializeEmptyState, type File } from '@/store/fileSlice';
import './index.scss';

export const rootDirectoryHandleRef = { current: null as FileSystemDirectoryHandle | null };

const safePathToId = (path: string): string => {
  return btoa(encodeURIComponent(path));
};

const loadRootDirectory = async (directoryHandle: FileSystemDirectoryHandle) => {
  const rootName = directoryHandle.name;
  const firstLevelFiles: File[] = [];

  for await (const handle of directoryHandle.values()) {
    const fullPath = `/${handle.name}`;
    const fileId = safePathToId(fullPath);
    firstLevelFiles.push({
      id: fileId,
      name: handle.name,
      path: fullPath,
      content: '',
      type: handle.kind === 'file' ? 'file' : 'folder',
      children: handle.kind === 'directory' ? [] : undefined,
      isLoaded: false,
      fileHandle: handle.kind === 'file' ? handle : undefined,
      directoryHandle: handle.kind === 'directory' ? handle : undefined,
    });
  }

  firstLevelFiles.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return { firstLevelFiles, rootName };
};

function buildFileMapFromTree(files: File[]): Record<string, File> {
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

function TopBar() {
  const dispatch = useAppDispatch();
  const fileTree = useAppSelector((state) => state.files.tree);
  const [showMenu, setShowMenu] = useState(false);

  const handleOpenFile = useCallback(async () => {
    setShowMenu(false);
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        multiple: false,
      });

      const file = await fileHandle.getFile();
      const content = await file.text();
      const filePath = `/${fileHandle.name}`;
      const fileId = safePathToId(filePath);

      const newFile: File = {
        id: fileId,
        name: fileHandle.name,
        path: filePath,
        content,
        type: 'file',
        isLoaded: true,
      };

      dispatch({
        type: 'files/addFile',
        payload: { name: newFile.name, content: newFile.content },
      });
      dispatch(openTab({ fileId: newFile.id, fileName: newFile.name }));
      dispatch(addLog({ type: 'success', message: `Opened file: ${fileHandle.name}` }));
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        dispatch(addLog({ type: 'error', message: `Failed to open file: ${error}` }));
      }
    }
  }, [dispatch]);

  const handleOpenFolder = useCallback(async () => {
    setShowMenu(false);
    try {
      const directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });

      rootDirectoryHandleRef.current = directoryHandle;

      const { firstLevelFiles, rootName } = await loadRootDirectory(directoryHandle);
      const filesMap = buildFileMapFromTree(firstLevelFiles);

      dispatch(closeAllTabs());
      dispatch(loadLocalFiles({ tree: firstLevelFiles, files: filesMap }));
      dispatch(addLog({ type: 'success', message: `Successfully loaded folder: ${rootName}` }));
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        dispatch(addLog({ type: 'error', message: `Failed to open folder: ${error}` }));
        console.error(error);
      }
    }
  }, [dispatch]);

  const handleReset = useCallback(() => {
    setShowMenu(false);
    rootDirectoryHandleRef.current = null;
    dispatch(closeAllTabs());
    dispatch(initializeEmptyState());
    dispatch(addLog({ type: 'info', message: 'Reset to empty state' }));
  }, [dispatch]);

  const handleMenuClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  }, [showMenu]);

  const handleDocumentClick = useCallback(() => {
    setShowMenu(false);
  }, []);

  return (
    <>
      <div className="top-bar">
        <div className="top-bar__left">
          <h1 className="top-bar__title">
            <span className="top-bar__logo">⌘</span>
            CodeBox
          </h1>
        </div>
        <div className="top-bar__center" />
        <div className="top-bar__right">
          <button
            className="top-bar__menu-btn"
            onClick={handleMenuClick}
            title="Menu"
          >
            ⋮⋮⋮
          </button>
        </div>
      </div>

      {showMenu && (
        <>
          <div className="top-bar__menu-backdrop" onClick={handleDocumentClick} />
          <div className="top-bar__menu">
            <button className="top-bar__menu-item" onClick={handleOpenFile}>
              📄 Open File
            </button>
            <button className="top-bar__menu-item" onClick={handleOpenFolder}>
              📂 Open Folder
            </button>
            {fileTree.length > 0 && (
              <button className="top-bar__menu-item top-bar__menu-item--secondary" onClick={handleReset}>
                ↺ Reset
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default TopBar;
export { loadRootDirectory, buildFileMapFromTree };