import { useEffect, useRef, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { updateFileContent } from '@/store/fileSlice';
import { markTabModified } from '@/store/tabSlice';
import { addLog } from '@/store/consoleSlice';
import './index.scss';

function Editor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const dispatch = useAppDispatch();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>('');

  const activeTabId = useAppSelector((state) => state.tabs.activeTabId);
  const tabs = useAppSelector((state) => state.tabs.tabs);
  const files = useAppSelector((state) => state.files.files);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const activeFile = activeTab ? files[activeTab.fileId] : null;

  const handleContentChange = useCallback(async (content: string) => {
    if (!activeTab) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      if (content !== lastSavedContentRef.current) {
        dispatch(updateFileContent({ id: activeTab.fileId, content }));
        dispatch(markTabModified(activeTab.fileId));
        lastSavedContentRef.current = content;

        const file = files[activeTab.fileId];
        if (file?.fileHandle) {
          try {
            const writable = await file.fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            dispatch(addLog({ type: 'success', message: `Saved file: ${file.name}` }));
          } catch (error) {
            dispatch(addLog({ type: 'error', message: `Failed to save file: ${error}` }));
          }
        }
      }
    }, 500);
  }, [activeTab, dispatch, files]);

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = monaco.editor.create(containerRef.current, {
      value: activeFile?.content || '',
      language: getLanguage(activeFile?.name),
      theme: 'vs-dark',
      minimap: {
        enabled: true,
      },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      fontWeight: '400',
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'on',
      folding: true,
      foldingHighlight: true,
      bracketPairColorization: {
        enabled: true,
      },
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      padding: {
        top: 16,
        bottom: 16,
      },
    });

    editorRef.current = editor;
    lastSavedContentRef.current = activeFile?.content || '';

    const model = editor.getModel();
    if (model) {
      const changeDisposable = model.onDidChangeContent(() => {
        handleContentChange(model.getValue());
      });

      return () => {
        changeDisposable.dispose();
        editor.dispose();
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
      };
    }

    return () => {
      editor.dispose();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [activeFile?.content, activeFile?.name, handleContentChange]);

  useEffect(() => {
    if (editorRef.current && activeFile) {
      const model = editorRef.current.getModel();
      if (model) {
        const currentValue = model.getValue();
        if (currentValue !== activeFile.content) {
          lastSavedContentRef.current = activeFile.content;
          model.setValue(activeFile.content);
        }

        const currentLanguage = getLanguage(activeFile.name);
        if (model.getLanguageId() !== currentLanguage) {
          monaco.editor.setModelLanguage(model, currentLanguage);
        }
      }
    }
  }, [activeFile]);

  useEffect(() => {
    if (activeFile && !activeFile.isLoaded && activeFile.fileHandle) {
      const loadFileContent = async () => {
        try {
          const file = await activeFile.fileHandle!.getFile();
          const content = await file.text();
          dispatch(updateFileContent({ id: activeFile.id, content }));
          dispatch(addLog({ type: 'info', message: `Loaded file content: ${activeFile.name}` }));
        } catch (error) {
          dispatch(addLog({ type: 'error', message: `Failed to load file content: ${error}` }));
        }
      };
      loadFileContent();
    }
  }, [activeFile, dispatch]);

  useEffect(() => {
    if (activeFile) {
      dispatch(addLog({ type: 'info', message: `Editing file: ${activeFile.name}` }));
    }
  }, [activeFile, dispatch]);

  if (!activeFile) {
    return (
      <div className="editor editor--empty">
        <div className="editor__placeholder">
          <div className="editor__placeholder-icon">📝</div>
          <div className="editor__placeholder-text">Open a file to start editing</div>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="editor" />;
}

function getLanguage(fileName?: string): string {
  if (!fileName) return 'plaintext';

  const ext = fileName.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    html: 'html',
    js: 'javascript',
    jsx: 'javascriptreact',
    ts: 'typescript',
    tsx: 'typescriptreact',
    css: 'css',
    scss: 'scss',
    json: 'json',
    md: 'markdown',
    txt: 'plaintext',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    sh: 'shell',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    php: 'php',
    sql: 'sql',
    gitignore: 'gitignore',
    env: 'env',
  };

  return languageMap[ext || ''] || 'plaintext';
}

export default Editor;