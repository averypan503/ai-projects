import { useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setActiveTab, closeTab } from '@/store/tabSlice';
import { addLog } from '@/store/consoleSlice';
import type { Tab } from '@/store/tabSlice';
import './index.scss';

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
}

function TabItem({ tab, isActive }: TabItemProps) {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector((state) => state.tabs.tabs);

  const handleClick = useCallback(() => {
    dispatch(setActiveTab(tab.id));
  }, [tab.id, dispatch]);

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(closeTab(tab.id));
    dispatch(addLog({ type: 'info', message: `Closed file: ${tab.fileName}` }));
  }, [tab.id, tab.fileName, tabs.length, dispatch]);

  const getFileIcon = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase();
    const icons: Record<string, string> = {
      html: '📄',
      js: '📦',
      ts: '📘',
      tsx: '🔷',
      jsx: '🔷',
      css: '🎨',
      scss: '🎨',
      json: '📋',
      md: '📝',
      txt: '📄',
    };
    return icons[ext || ''] || '📄';
  };

  return (
    <div
      className={`tabs__item ${isActive ? 'tabs__item--active' : ''}`}
      onClick={handleClick}
    >
      <span className="tabs__icon">{getFileIcon(tab.fileName)}</span>
      <span className="tabs__name">{tab.fileName}</span>
      {tab.isModified && <span className="tabs__modified" />}
      <span className="tabs__close" onClick={handleClose}>
        ×
      </span>
    </div>
  );
}

function Tabs() {
  const tabs = useAppSelector((state) => state.tabs.tabs);
  const activeTabId = useAppSelector((state) => state.tabs.activeTabId);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
        />
      ))}
    </div>
  );
}

export default Tabs;