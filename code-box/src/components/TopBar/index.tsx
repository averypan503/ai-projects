import { useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addLog } from '@/store/consoleSlice';
import { openTab, closeAllTabs } from '@/store/tabSlice';
import { loadLocalFiles, clearLocalFiles, type File } from '@/store/fileSlice';
import './index.scss';

export const rootDirectoryHandleRef = { current: null as FileSystemDirectoryHandle | null };

async function loadDirectoryLevel(directoryHandle: FileSystemDirectoryHandle, parentPath: string = ''): Promise<File[]> {
  const files: File[] = [];

  for await (const handle of directoryHandle.values()) {
    const name = handle.name;
    const currentPath = parentPath === '' ? name : `${parentPath}/${name}`;

    if (handle.kind === 'file') {
      files.push({
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        path: `/${currentPath}`,
        content: '',
        type: 'file',
        isLoaded: false,
      });
    } else if (handle.kind === 'directory') {
      files.push({
        id: `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        path: `/${currentPath}`,
        content: '',
        type: 'folder',
        children: [],
        isLoaded: false,
      });
    }
  }

  return files.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

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
  const isLoadedFromLocal = useAppSelector((state) => state.files.isLoadedFromLocal);
  const [showMenu, setShowMenu] = useState(false);

  const handleOpenFile = useCallback(async () => {
    setShowMenu(false);
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        multiple: false,
      });

      const file = await fileHandle.getFile();
      const content = await file.text();

      const newFile: File = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: fileHandle.name,
        path: `/${fileHandle.name}`,
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
      if (error instanceof Error && error.name === 'AbortError') {
        dispatch(addLog({ type: 'info', message: 'File selection cancelled' }));
      } else {
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

      const tree = await loadDirectoryLevel(directoryHandle, '');
      const filesMap = buildFileMapFromTree(tree);

      dispatch(closeAllTabs());
      dispatch(loadLocalFiles({ tree, files: filesMap }));
      dispatch(addLog({ type: 'success', message: `Successfully loaded folder: ${directoryHandle.name}` }));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        dispatch(addLog({ type: 'info', message: 'Folder selection cancelled' }));
      } else {
        dispatch(addLog({ type: 'error', message: `Failed to open folder: ${error}` }));
      }
    }
  }, [dispatch]);

  const handleReset = useCallback(() => {
    setShowMenu(false);
    rootDirectoryHandleRef.current = null;
    dispatch(closeAllTabs());
    dispatch(clearLocalFiles());
    dispatch(addLog({ type: 'info', message: 'Reset to default files' }));
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
            {isLoadedFromLocal && (
              <button className="top-bar__menu-item top-bar__menu-item--secondary" onClick={handleReset}>
                ↺ Reset to Default
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default TopBar;