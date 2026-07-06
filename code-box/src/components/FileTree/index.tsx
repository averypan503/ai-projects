import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { addFile, addFolder, deleteFile, updateFileName, loadLocalFiles, loadFolderChildren, setFolderLoaded, safePathToId, type File } from '@/store/fileSlice';
import { openTab, setActiveTab, closeTabByFileId, updateTabFileName, closeAllTabs } from '@/store/tabSlice';
import { addLog } from '@/store/consoleSlice';
import { rootDirectoryHandleRef } from '@/components/TopBar';
import './index.scss';

interface FileTreeItemProps {
  file: File;
  depth?: number;
}

function FileTreeItem({ file, depth = 0 }: FileTreeItemProps) {
  const dispatch = useAppDispatch();
  const activeTabId = useAppSelector((state) => state.tabs.activeTabId);
  const tabs = useAppSelector((state) => state.tabs.tabs);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(file.name);

  useEffect(() => {
    setRenameValue(file.name);
  }, [file.name]);

  const isActive = useMemo(() => {
    return tabs.some((tab) => tab.id === activeTabId && tab.fileId === file.id);
  }, [tabs, activeTabId, file.id]);

  // 每次都从全局 ref 拿最新的，不会失效
  const getRootHandle = () => rootDirectoryHandleRef.current;

  const getDirectoryHandleByPath = useCallback(async (path: string): Promise<FileSystemDirectoryHandle | null> => {
    const rootDirectoryHandle = getRootHandle();
    if (!rootDirectoryHandle) return null;

    const parts = path.split('/').filter(Boolean);
    let currentHandle: FileSystemDirectoryHandle = rootDirectoryHandle;

    for (const part of parts) {
      try {
        currentHandle = await currentHandle.getDirectoryHandle(part);
      } catch {
        return null;
      }
    }
    return currentHandle;
  }, []);

  const getParentDirectoryHandle = useCallback(async (filePath: string): Promise<FileSystemDirectoryHandle | null> => {
    const parentPath = filePath.substring(0, filePath.lastIndexOf('/'));
    return getDirectoryHandleByPath(parentPath);
  }, [getDirectoryHandleByPath]);

  const handleClick = useCallback(async () => {
    if (file.type === 'file') {
      dispatch(openTab({ fileId: file.id, fileName: file.name }));
      dispatch(addLog({ type: 'info', message: `Opened file: ${file.name}` }));
    } else {
      if (!file.isLoaded) {
        try {
          const dirHandle = await getDirectoryHandleByPath(file.path);
          if (!dirHandle) {
            dispatch(addLog({ type: 'error', message: `Failed to access folder: ${file.name}` }));
            return;
          }

          const children: File[] = [];
          for await (const handle of dirHandle.values()) {
            const name = handle.name;
            const currentPath = `${file.path}/${name}`;

            if (handle.kind === 'file') {
              children.push({
                id: safePathToId(currentPath),
                name,
                path: currentPath,
                content: '',
                type: 'file',
                isLoaded: false,
                fileHandle: handle,
                directoryHandle: undefined,
              });
            } else if (handle.kind === 'directory') {
              children.push({
                id: safePathToId(currentPath),
                name,
                path: currentPath,
                content: '',
                type: 'folder',
                children: [],
                isLoaded: false,
                fileHandle: undefined,
                directoryHandle: handle,
              });
            }
          }

          children.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            return a.name.localeCompare(b.name);
          });

          dispatch(loadFolderChildren({ folderId: file.id, children }));
          dispatch(addLog({ type: 'info', message: `Loaded folder: ${file.name}` }));
        } catch (error) {
          dispatch(addLog({ type: 'error', message: `Failed to load folder: ${error}` }));
        }
      }
      dispatch(setFolderLoaded({ folderId: file.id }));
      setIsExpanded((prev) => !prev);
    }
  }, [file.id, file.name, file.type, file.isLoaded, file.children, dispatch, getDirectoryHandleByPath]);

  const handleDoubleClick = useCallback(() => {
    if (file.type === 'file') {
      const tab = tabs.find((t) => t.fileId === file.id);
      if (tab) {
        dispatch(setActiveTab(tab.id));
      } else {
        dispatch(openTab({ fileId: file.id, fileName: file.name }));
        dispatch(addLog({ type: 'info', message: `Opened file: ${file.name}` }));
      }
    }
  }, [file.id, file.name, file.type, dispatch, tabs]);

  // ------------------------------
  // ✅ 创建文件（真正写入磁盘）
  // ------------------------------
  const handleAddFile = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const root = getRootHandle();

    if (!root) {
      dispatch(addLog({ type: 'error', message: 'Please open a folder first' }));
      return;
    }

    try {
      const parentDirHandle = await getDirectoryHandleByPath(file.path);
      if (!parentDirHandle) return;

      const newFileHandle = await parentDirHandle.getFileHandle('new-file.txt', { create: true });
      const writable = await newFileHandle.createWritable();
      await writable.write('');
      await writable.close();

      dispatch(addFile({ parentId: file.id, name: 'new-file.txt', content: '' }));
      dispatch(addLog({ type: 'success', message: `Created new file: ${file.name}/new-file.txt` }));
    } catch (error) {
      dispatch(addLog({ type: 'error', message: `Failed to create file: ${error}` }));
    }
  }, [file.id, file.path, dispatch, getDirectoryHandleByPath]);

  // ------------------------------
  // ✅ 创建文件夹（真正写入磁盘）
  // ------------------------------
  const handleAddFolder = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const root = getRootHandle();

    if (!root) {
      dispatch(addLog({ type: 'error', message: 'Please open a folder first' }));
      return;
    }

    try {
      const parentDirHandle = await getDirectoryHandleByPath(file.path);
      if (!parentDirHandle) return;

      await parentDirHandle.getDirectoryHandle('new-folder', { create: true });

      dispatch(addFolder({ parentId: file.id, name: 'new-folder' }));
      dispatch(addLog({ type: 'success', message: `Created new folder: ${file.name}/new-folder` }));
    } catch (error) {
      dispatch(addLog({ type: 'error', message: `Failed to create folder: ${error}` }));
    }
  }, [file.id, file.path, dispatch, getDirectoryHandleByPath]);

  // ------------------------------
  // ✅ 删除（真正磁盘删除）
  // ------------------------------
  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const root = getRootHandle();

    if (!root) {
      dispatch(deleteFile(file.id));
      dispatch(closeTabByFileId(file.id));
      dispatch(addLog({ type: 'warning', message: `Deleted: ${file.name}` }));
      return;
    }

    try {
      const parentDirHandle = await getParentDirectoryHandle(file.path);
      if (!parentDirHandle) return;

      await parentDirHandle.removeEntry(file.name, { recursive: true });
      dispatch(deleteFile(file.id));
      dispatch(closeTabByFileId(file.id));
      dispatch(addLog({ type: 'warning', message: `Deleted: ${file.name}` }));
    } catch (error) {
      dispatch(addLog({ type: 'error', message: `Failed to delete: ${error}` }));
    }
  }, [file.id, file.name, file.type, file.path, dispatch, getParentDirectoryHandle]);

  const handleRenameStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(true);
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    const newName = renameValue.trim();
    if (!newName || newName === file.name) {
      setIsRenaming(false);
      return;
    }

    const root = getRootHandle();
    const parentPath = file.path.substring(0, file.path.lastIndexOf('/'));
    const newFullPath = parentPath + '/' + newName;

    if (!root) {
      dispatch(updateFileName({ id: file.id, name: newName, path: newFullPath }));
      dispatch(updateTabFileName({ fileId: file.id, fileName: newName }));
      dispatch(addLog({ type: 'info', message: `Renamed: ${file.name} -> ${newName}` }));
      setRenameValue(newName);
      setIsRenaming(false);
      return;
    }

    try {
      const parentDirHandle = await getParentDirectoryHandle(file.path);
      if (!parentDirHandle) return;

      if (file.type === 'file') {
        const oldFile = await parentDirHandle.getFileHandle(file.name);
        const newFile = await parentDirHandle.getFileHandle(newName, { create: true });
        const data = await oldFile.getFile();
        const writable = await newFile.createWritable();
        await writable.write(await data.arrayBuffer());
        await writable.close();
        await parentDirHandle.removeEntry(file.name);
      } else {
        const newDir = await parentDirHandle.getDirectoryHandle(newName, { create: true });
        const oldDir = await parentDirHandle.getDirectoryHandle(file.name);

        const copy = async (s: FileSystemDirectoryHandle, t: FileSystemDirectoryHandle) => {
          for await (const h of s.values()) {
            if (h.kind === 'file') {
              const sf = await s.getFileHandle(h.name);
              const tf = await t.getFileHandle(h.name, { create: true });
              const d = await sf.getFile();
              const w = await tf.createWritable();
              await w.write(await d.arrayBuffer());
              await w.close();
            } else {
              const sd = await s.getDirectoryHandle(h.name);
              const td = await t.getDirectoryHandle(h.name, { create: true });
              await copy(sd, td);
            }
          }
        };
        await copy(oldDir, newDir);
        await parentDirHandle.removeEntry(file.name, { recursive: true });
      }

      dispatch(updateFileName({ id: file.id, name: newName, path: newFullPath }));
      dispatch(updateTabFileName({ fileId: file.id, fileName: newName }));
      dispatch(addLog({ type: 'success', message: `Renamed: ${file.name} -> ${newName}` }));
      setRenameValue(newName);
    } catch (error) {
      dispatch(addLog({ type: 'error', message: `Failed to rename: ${error}` }));
    }

    setIsRenaming(false);
  }, [renameValue, file, dispatch, getParentDirectoryHandle]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setRenameValue(file.name);
      setIsRenaming(false);
    }
  }, [handleRenameSubmit, file.name]);

  const getFileIcon = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase();
    const icons: Record<string, string> = {
      html: '📄', js: '📦', ts: '📘', tsx: '🔷', jsx: '🔷', css: '🎨', scss: '🎨', json: '📋', md: '📝', txt: '📄',
    };
    return icons[ext || ''] || '📄';
  };

  return (
    <div>
      <div
        className={`file-tree__item ${isActive ? 'file-tree__item--active' : ''} ${file.type === 'folder' ? 'file-tree__item--folder' : ''}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {file.type === 'folder' && (
          <span className={`file-tree__expand-icon ${isExpanded ? 'file-tree__expand-icon--expanded' : ''}`}>▶</span>
        )}
        <span className="file-tree__icon">{file.type === 'folder' ? '📁' : getFileIcon(file.name)}</span>

        {isRenaming ? (
          <input
            className="file-tree__input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameSubmit}
            autoFocus
          />
        ) : (
          <>
            <span className="file-tree__name">{file.name}</span>
            <div className="file-tree__actions">
              {file.type === 'folder' && (
                <>
                  <button className="file-tree__action-btn" onClick={handleAddFile}>+</button>
                  <button className="file-tree__action-btn" onClick={handleAddFolder}>⊕</button>
                </>
              )}
              <button className="file-tree__action-btn" onClick={handleRenameStart}>✎</button>
              <button className="file-tree__action-btn" onClick={handleDelete}>×</button>
            </div>
          </>
        )}
      </div>

      {file.type === 'folder' && isExpanded && file.children ? (
        <div className="file-tree__children">
          {file.children.length > 0 ? (
            file.children.map((child) => <FileTreeItem key={child.id} file={child} depth={depth + 1} />)
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function buildFileMapFromTree(files: File[]): Record<string, File> {
  const map: Record<string, File> = {};
  const build = (items: File[]) => {
    items.forEach((file) => {
      map[file.id] = file;
      if (file.children) build(file.children);
    });
  };
  build(files);
  return map;
}

function FileTree() {
  const dispatch = useAppDispatch();
  const fileTree = useAppSelector((state) => state.files.tree);
  const isLoadedFromLocal = useAppSelector((state) => state.files.isLoadedFromLocal);

  const handleOpenLocalFolder = useCallback(async () => {
    try {
      const directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      rootDirectoryHandleRef.current = directoryHandle;

      const tree: File[] = [];
      for await (const handle of directoryHandle.values()) {
        tree.push({
          id: safePathToId(`/${handle.name}`),
          name: handle.name,
          path: `/${handle.name}`,
          content: '',
          type: handle.kind === 'file' ? 'file' : 'folder',
          children: handle.kind === 'directory' ? [] : undefined,
          isLoaded: false,
          fileHandle: handle.kind === 'file' ? handle : undefined,
          directoryHandle: handle.kind === 'directory' ? handle : undefined,
        });
      }

      tree.sort((a, b) => (a.type !== b.type ? a.type === 'folder' ? -1 : 1 : a.name.localeCompare(b.name)));
      const filesMap = buildFileMapFromTree(tree);

      dispatch(closeAllTabs());
      dispatch(loadLocalFiles({ tree, files: filesMap }));
      dispatch(addLog({ type: 'success', message: `Loaded folder: ${directoryHandle.name}` }));
    } catch (error) {
      dispatch(addLog({ type: 'error', message: `Failed to open folder: ${error}` }));
    }
  }, [dispatch]);

  const handleRefresh = useCallback(async () => {
    const root = rootDirectoryHandleRef.current;
    if (!root) return;

    try {
      const tree: File[] = [];
      for await (const handle of root.values()) {
        tree.push({
          id: safePathToId(`/${handle.name}`),
          name: handle.name,
          path: `/${handle.name}`,
          content: '',
          type: handle.kind === 'file' ? 'file' : 'folder',
          children: handle.kind === 'directory' ? [] : undefined,
          isLoaded: false,
          fileHandle: handle.kind === 'file' ? handle : undefined,
          directoryHandle: handle.kind === 'directory' ? handle : undefined,
        });
      }
      tree.sort((a, b) => (a.type !== b.type ? a.type === 'folder' ? -1 : 1 : a.name.localeCompare(b.name)));
      const filesMap = buildFileMapFromTree(tree);

      dispatch(closeAllTabs());
      dispatch(loadLocalFiles({ tree, files: filesMap }));
      dispatch(addLog({ type: 'success', message: 'Refreshed' }));
    } catch (error) {
      dispatch(addLog({ type: 'error', message: `Refresh failed: ${error}` }));
    }
  }, [dispatch]);

  const handleAddRootFile = useCallback(async () => {
    const root = rootDirectoryHandleRef.current;
    if (!root) {
      dispatch(addLog({ type: 'error', message: 'Please open a folder first' }));
      return;
    }

    try {
      const fh = await root.getFileHandle('new-file.txt', { create: true });
      const w = await fh.createWritable();
      await w.write('');
      await w.close();
      dispatch(addFile({ name: 'new-file.txt', content: '' }));
      dispatch(addLog({ type: 'success', message: 'Created new-file.txt' }));
    } catch (error) {
      dispatch(addLog({ type: 'error', message: `Failed: ${error}` }));
    }
  }, [dispatch]);

  const handleAddRootFolder = useCallback(async () => {
    const root = rootDirectoryHandleRef.current;
    if (!root) {
      dispatch(addLog({ type: 'error', message: 'Please open a folder first' }));
      return;
    }

    try {
      await root.getDirectoryHandle('new-folder', { create: true });
      dispatch(addFolder({ name: 'new-folder' }));
      dispatch(addLog({ type: 'success', message: 'Created new-folder' }));
    } catch (error) {
      dispatch(addLog({ type: 'error', message: `Failed: ${error}` }));
    }
  }, [dispatch]);

  return (
    <div className="file-tree">
      <div className="file-tree__header">
        Explorer
        <div className="file-tree__actions" style={{ display: 'flex', gap: 4 }}>
          <button className="file-tree__action-btn" onClick={() => window.showOpenFilePicker()}>📄</button>
          <button className="file-tree__action-btn" onClick={handleOpenLocalFolder}>📂</button>
          {isLoadedFromLocal && <button className="file-tree__action-btn" onClick={handleRefresh}>↻</button>}
          <button className="file-tree__action-btn" onClick={handleAddRootFile}>+</button>
          <button className="file-tree__action-btn" onClick={handleAddRootFolder}>⊕</button>
        </div>
      </div>
      <div className="file-tree__content">
        {fileTree.length === 0 ? (
          <div className="file-tree__empty">
            <div className="file-tree__empty-text">暂无文件</div>
            <div className="file-tree__empty-hint">点击右上角按钮打开本地文件夹</div>
          </div>
        ) : (
          fileTree.map((file) => <FileTreeItem key={file.id} file={file} />)
        )}
      </div>
    </div>
  );
}

export default FileTree;