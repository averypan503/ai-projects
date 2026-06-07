import { useState, useRef, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setSidebarWidth, setConsoleHeight } from '@/store/uiSlice';
import type { ReactNode } from 'react';
import './index.scss';

interface LayoutProps {
  topBar: ReactNode;
  fileTree: ReactNode;
  tabs: ReactNode;
  editor: ReactNode;
  console: ReactNode;
}

function Layout({ topBar, fileTree, tabs, editor, console: consoleContent }: LayoutProps) {
  const dispatch = useAppDispatch();
  const sidebarWidth = useAppSelector((state) => state.ui.sidebarWidth);
  const consoleHeight = useAppSelector((state) => state.ui.consoleHeight);

  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  const [isConsoleDragging, setIsConsoleDragging] = useState(false);

  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsSidebarDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startXRef.current;
      const newWidth = startWidthRef.current + deltaX;

      const clampedWidth = Math.max(200, Math.min(450, newWidth));
      dispatch(setSidebarWidth(clampedWidth));
    };

    const handleMouseUp = () => {
      setIsSidebarDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth, dispatch]);

  const handleConsoleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsConsoleDragging(true);
    startYRef.current = e.clientY;
    startHeightRef.current = consoleHeight;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startYRef.current - e.clientY;
      const newHeight = startHeightRef.current + deltaY;

      const clampedHeight = Math.max(80, Math.min(400, newHeight));
      dispatch(setConsoleHeight(clampedHeight));
    };

    const handleMouseUp = () => {
      setIsConsoleDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [consoleHeight, dispatch]);

  return (
    <div className="ide-layout">
      {/* 顶部导航栏 */}
      <div className="ide-layout__top-bar">
        {topBar}
      </div>

      {/* 主体区域 */}
      <div className="ide-layout__body">
        {/* 左侧文件树区域 */}
        <div
          className="ide-layout__sidebar"
          style={{ width: `${sidebarWidth}px` }}
        >
          {fileTree}
        </div>

        {/* 侧边栏分割线 */}
        <div
          className={`ide-layout__sidebar-resizer ${isSidebarDragging ? 'ide-layout__sidebar-resizer--active' : ''}`}
          onMouseDown={handleSidebarMouseDown}
        />

        {/* 右侧主区域 */}
        <div className="ide-layout__main">
          {/* 标签栏区域 */}
          <div className="ide-layout__tabs">
            {tabs}
          </div>

          {/* 编辑器区域 */}
          <div className="ide-layout__editor">
            {editor}
          </div>

          {/* 控制台分割线 */}
          <div
            className={`ide-layout__console-resizer ${isConsoleDragging ? 'ide-layout__console-resizer--active' : ''}`}
            onMouseDown={handleConsoleMouseDown}
          />

          {/* 控制台区域 */}
          <div
            className="ide-layout__console"
            style={{ height: `${consoleHeight}px` }}
          >
            {consoleContent}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Layout;