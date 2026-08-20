import { useState, useRef, useEffect, FormEvent } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { toggleRightPanelCollapsed } from '@/store/uiSlice';
import './index.scss';

interface ChatMessage {
  id: number;
  role: 'user' | 'ai' | 'error';
  content: string;
  timestamp: Date;
}

const MAX_HISTORY = 5;

function AIChat() {
  const dispatch = useAppDispatch();
  const isCollapsed = useAppSelector(
    (state) => state.ui.rightPanelCollapsed,
  );

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role: ChatMessage['role'], content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), role, content, timestamp: new Date() },
    ]);
  };

  const buildHistoryPayload = (latestUserMessage: string): { message: string; messages: { role: string; content: string }[] } => {
    const filtered = messages.filter((m) => m.role === 'user' || m.role === 'ai');
    const historySlice = filtered.slice(-(MAX_HISTORY - 1)).map((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content,
    }));
    const full = [
      ...historySlice,
      { role: 'user', content: latestUserMessage },
    ].slice(-MAX_HISTORY);
    return {
      message: latestUserMessage,
      messages: full,
    };
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage = trimmed;
    setInput('');
    setLoading(true);
    addMessage('user', userMessage);

    try {
      const payload = buildHistoryPayload(userMessage);
      const res = await fetch('http://localhost:8080/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.code !== 200) {
        addMessage('error', result.msg || '请求失败');
        return;
      }
      const chatData = result.data ?? {};
      const answer = chatData.answer ?? chatData.message ?? '（无应答内容）';
      addMessage('ai', String(answer));
    } catch {
      addMessage('error', '请求失败，请检查后端服务是否启动');
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMessages([]);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(toggleRightPanelCollapsed());
  };

  const handleHeaderClick = (e: React.MouseEvent) => {
    // 折叠状态下由外层 right-panel 的 onClick 统一处理，
    // 避免与外部重复派发 toggle 导致“展开后立即收起”的问题
    if (isCollapsed) return;
    e.stopPropagation();
    dispatch(toggleRightPanelCollapsed());
  };

  const formatTime = (date: Date): string =>
    new Date(date).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className={`ai-chat ${isCollapsed ? 'ai-chat--collapsed' : ''}`}>
      <div className="ai-chat__header" onClick={handleHeaderClick}>
        <div className="ai-chat__title">
          <span className="ai-chat__icon">✦</span>
          <span>AI Chat</span>
          <span className="ai-chat__count">({messages.length})</span>
        </div>
        <div className="ai-chat__actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="ai-chat__action-btn"
            onClick={handleClear}
            title="清空对话"
          >
            🗑
          </button>
          <button
            className="ai-chat__action-btn"
            onClick={handleToggle}
            title={isCollapsed ? '展开' : '收起'}
          >
            {isCollapsed ? '◀' : '▶'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="ai-chat__messages">
            {messages.length === 0 ? (
              <div className="ai-chat__empty">
                欢迎使用 AI 助手，输入问题开始对话～
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`ai-chat__msg ai-chat__msg--${msg.role}`}
                >
                  <div className="ai-chat__msg-header">
                    <span className="ai-chat__msg-role">
                      {msg.role === 'user' ? '我' : msg.role === 'ai' ? 'AI' : '错误'}
                    </span>
                    <span className="ai-chat__msg-time">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <div className="ai-chat__msg-body">{msg.content}</div>
                </div>
              ))
            )}
            {loading && (
              <div className="ai-chat__msg ai-chat__msg--ai">
                <div className="ai-chat__msg-header">
                  <span className="ai-chat__msg-role">AI</span>
                </div>
                <div className="ai-chat__msg-body ai-chat__msg-body--loading">
                  思考中
                  <span className="ai-chat__dots">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="ai-chat__input" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              className="ai-chat__textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入问题... (Enter 发送，Shift+Enter 换行)"
              rows={2}
              disabled={loading}
            />
            <button
              type="submit"
              className="ai-chat__send-btn"
              disabled={loading || !input.trim()}
            >
              发送
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default AIChat;