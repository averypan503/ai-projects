import { useState, useRef, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import {
  setSidebarWidth,
  setConsoleHeight,
  setRightPanelWidth,
  toggleRightPanelCollapsed,
} from '@/store/uiSlice';
import type { ReactNode } from 'react';
import './index.scss';

const COLLAPSED_WIDTH = 28;

interface LayoutProps {
  topBar: ReactNode;
  fileTree: ReactNode;
  tabs: ReactNode;
  editor: ReactNode;
  console: ReactNode;
  rightPanel: ReactNode;
}

function Layout({
  topBar,
  fileTree,
  tabs,
  editor,
  console: consoleContent,
  rightPanel,
}: LayoutProps) {
  const dispatch = useAppDispatch();
  const sidebarWidth = Math.max(200, Math.min(450, useAppSelector((state) => state.ui.sidebarWidth)));
  const consoleHeight = Math.max(80, Math.min(400, useAppSelector((state) => state.ui.consoleHeight)));
  const rightPanelWidth = Math.max(200, Math.min(600, useAppSelector((state) => state.ui.rightPanelWidth)));
  const rightPanelCollapsed = useAppSelector(
    (state) => state.ui.rightPanelCollapsed,
  );

  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  const [isConsoleDragging, setIsConsoleDragging] = useState(false);
  const [isRightPanelDragging, setIsRightPanelDragging] = useState(false);

  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const rightPanelStartXRef = useRef(0);
  const rightPanelStartWidthRef = useRef(0);

  const handleSidebarMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsSidebarDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = sidebarWidth;

      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
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
    },
    [sidebarWidth, dispatch],
  );

  const handleConsoleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsConsoleDragging(true);
      startYRef.current = e.clientY;
      startHeightRef.current = consoleHeight;

      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
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
    },
    [consoleHeight, dispatch],
  );

  const handleRightPanelMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 如果面板已收起，单击分隔线直接展开，不启用拖动
      if (rightPanelCollapsed) {
        e.preventDefault();
        dispatch(toggleRightPanelCollapsed());
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      setIsRightPanelDragging(true);
      rightPanelStartXRef.current = e.clientX;
      rightPanelStartWidthRef.current = rightPanelWidth;

      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        const deltaX = rightPanelStartXRef.current - e.clientX;
        const newWidth = rightPanelStartWidthRef.current + deltaX;

        const clampedWidth = Math.max(200, Math.min(600, newWidth));
        dispatch(setRightPanelWidth(clampedWidth));
      };

      const handleMouseUp = () => {
        setIsRightPanelDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [rightPanelWidth, rightPanelCollapsed, dispatch],
  );

  const effectiveRightPanelWidth = rightPanelCollapsed
    ? COLLAPSED_WIDTH
    : rightPanelWidth;

  return (
    <div className="ide-layout">
      {/* 顶部导航栏 */}
      <div className="ide-layout__top-bar">{topBar}</div>

      {/* 主体区域 */}
      <div className="ide-layout__body">
        {/* 左侧文件树区域 */}
        <div
          className="ide-layout__sidebar"
          style={{
            flex: `0 0 ${sidebarWidth}px`,
            width: `${sidebarWidth}px`,
            maxWidth: `${sidebarWidth}px`,
          }}
        >
          {fileTree}
        </div>

        {/* 侧边栏分割线 */}
        <div
          className={`ide-layout__sidebar-resizer ${isSidebarDragging ? 'ide-layout__sidebar-resizer--active' : ''}`}
          onMouseDown={handleSidebarMouseDown}
        />

        {/* 中间主区域（Tabs + Editor + Console） */}
        <div className="ide-layout__main">
          <div className="ide-layout__tabs">{tabs}</div>
          <div className="ide-layout__editor">{editor}</div>
          <div
            className={`ide-layout__console-resizer ${isConsoleDragging ? 'ide-layout__console-resizer--active' : ''}`}
            onMouseDown={handleConsoleMouseDown}
          />
          <div
            className="ide-layout__console"
            style={{ height: `${consoleHeight}px` }}
          >
            {consoleContent}
          </div>
        </div>

        {/* 右侧面板分割线 */}
        <div
          className={`ide-layout__right-panel-resizer ${isRightPanelDragging ? 'ide-layout__right-panel-resizer--active' : ''} ${rightPanelCollapsed ? 'ide-layout__right-panel-resizer--collapsed' : ''}`}
          onMouseDown={handleRightPanelMouseDown}
          title={rightPanelCollapsed ? '点击展开' : '拖动调整宽度，双击收起'}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dispatch(toggleRightPanelCollapsed());
          }}
        />

        {/* 右侧面板 */}
        <div
          className={`ide-layout__right-panel ${rightPanelCollapsed ? 'ide-layout__right-panel--collapsed' : ''}`}
          style={{
            flex: `0 0 ${effectiveRightPanelWidth}px`,
            width: `${effectiveRightPanelWidth}px`,
            maxWidth: `${effectiveRightPanelWidth}px`,
          }}
          onClick={() => {
            if (rightPanelCollapsed) {
              dispatch(toggleRightPanelCollapsed());
            }
          }}
        >
          {rightPanel}
        </div>
      </div>
    </div>
  );
}

export default Layout;