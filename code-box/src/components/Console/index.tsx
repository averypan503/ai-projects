import { useRef, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { clearLogs, setVisibility } from '@/store/consoleSlice';
import type { LogEntry } from '@/store/consoleSlice';
import './index.scss';

function Console() {
  const dispatch = useAppDispatch();
  const logs = useAppSelector((state) => state.console.logs);
  const isVisible = useAppSelector((state) => state.console.isVisible);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleClear = () => {
    dispatch(clearLogs());
  };

  const handleToggle = () => {
    dispatch(setVisibility(!isVisible));
  };

  const formatTime = (date: Date): string => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getLogStyle = (type: LogEntry['type']): string => {
    const styles: Record<LogEntry['type'], string> = {
      info: 'console__log--info',
      success: 'console__log--success',
      warning: 'console__log--warning',
      error: 'console__log--error',
    };
    return styles[type];
  };

  const getLogIcon = (type: LogEntry['type']): string => {
    const icons: Record<LogEntry['type'], string> = {
      info: 'ℹ',
      success: '✓',
      warning: '⚠',
      error: '✗',
    };
    return icons[type];
  };

  return (
    <div className={`console ${isVisible ? 'console--visible' : 'console--hidden'}`}>
      <div className="console__header">
        <div className="console__title">
          <span className="console__icon">⌘</span>
          <span>Console</span>
          <span className="console__count">({logs.length})</span>
        </div>
        <div className="console__actions">
          <button className="console__action-btn" onClick={handleClear} title="Clear Console">
            🗑
          </button>
          <button className="console__action-btn" onClick={handleToggle} title="Toggle Console">
            {isVisible ? '▲' : '▼'}
          </button>
        </div>
      </div>

      <div ref={logsContainerRef} className="console__content">
        {logs.length === 0 ? (
          <div className="console__empty">No logs yet.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={`console__log ${getLogStyle(log.type)}`}>
              <span className="console__time">{formatTime(log.timestamp)}</span>
              <span className="console__log-icon">{getLogIcon(log.type)}</span>
              <span className="console__message">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Console;