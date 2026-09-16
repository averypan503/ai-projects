import { useState, useRef, useEffect, FormEvent, memo, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { toggleRightPanelCollapsed } from '@/store/uiSlice';
import './index.scss';
import MarkdownRenderer from './MarkdownRenderer';
import StreamingMarkdownLite from './StreamingMarkdownLite';

interface ChatMessage {
  id: number;
  role: 'user' | 'ai' | 'error';
  content: string;
  timestamp: Date;
}

const MAX_HISTORY = 5;
const STREAM_API = 'http://localhost:8080/api/v1/ai/stream-chat';
const RAG_API = 'http://localhost:8080/api/v1/rag/answer';
const DEBOUNCE_MS = 50;

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
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamAIMsgIdRef = useRef<number | null>(null);
  const streamingMsgIdsRef = useRef<Set<number>>(new Set());
  // —— 流式防抖（最佳实践 50ms 合并 delta，减少长文本渲染次数）
  const pendingBufferRef = useRef<Record<number, string>>({});
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPending = useCallback(() => {
    flushTimerRef.current = null;
    const buf = pendingBufferRef.current;
    const ids = Object.keys(buf);
    if (ids.length === 0) return;
    pendingBufferRef.current = {};
    setMessages((prev) =>
      prev.map((m) => {
        const delta = buf[m.id];
        if (!delta) return m;
        return { ...m, content: m.content + delta };
      }),
    );
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current != null) return;
    flushTimerRef.current = setTimeout(flushPending, DEBOUNCE_MS);
  }, [flushPending]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 组件卸载清理：如果有正在进行的流式请求，直接 abort，防止内存泄漏 & unmounted setState 警告
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (abortControllerRef.current) {
        try { abortControllerRef.current.abort(); } catch (_) { /* ignore */ }
        abortControllerRef.current = null;
      }
    };
  }, []);

  const addMessage = (role: ChatMessage['role'], content: string): number => {
    const id = Date.now() + Math.random();
    setMessages((prev) => [
      ...prev,
      { id, role, content, timestamp: new Date() },
    ]);
    return id;
  };

  const appendToMessage = (targetId: number, delta: string) => {
    if (!delta) return;
    const d = String(delta);
    if (!d) return;
    if (/^\s*(`{1,3}\s*)?(undefined|null|\[object Object\]|NaN|Infinity)(\s*`{1,3})?\s*$/.test(d)) return;
    // —— 先合并到 50ms 防抖缓冲，最后一次性 setState（避免每个 token → 整棵列表 re-render）
    pendingBufferRef.current[targetId] = (pendingBufferRef.current[targetId] ?? '') + d;
    scheduleFlush();
  };

  /** 强制立刻把防抖 buffer 落地（流式结束后必须调用，避免最后几个字延迟 50ms 才出现） */
  const forceFlushAllPending = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    flushPending();
  }, [flushPending]);

  const setMessageContent = (targetId: number, content: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === targetId ? { ...m, content } : m)),
    );
  };

  const markMessageAsError = (targetId: number, message: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === targetId
          ? { id: m.id, role: 'error', content: message, timestamp: new Date() }
          : m,
      ),
    );
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

  const handleStop = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.preventDefault?.();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput('');
    sendInternal(trimmed, messages);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (loading) {
        handleStop(e);
      } else {
        handleSend();
      }
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (loading) {
      handleStop();
    } else {
      handleSend();
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) handleStop(e);
    setMessages([]);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(toggleRightPanelCollapsed());
  };

  const handleHeaderClick = (e: React.MouseEvent) => {
    if (isCollapsed) return;
    e.stopPropagation();
    dispatch(toggleRightPanelCollapsed());
  };

  // —— 重新生成最后一条 AI 回复（用于 [已停止] / [请求失败] 场景）
  //    策略：找到最后一条 user 消息，保留它和之前的所有历史，删除后面所有 AI 回复（包括失败的），再重发
  const handleRetry = () => {
    if (loading) return;
    let lastUserIdx = -1;
    const snap = messages;
    for (let i = snap.length - 1; i >= 0; i--) {
      if (snap[i].role === 'user') { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return;
    const userMessage = snap[lastUserIdx].content;
    const newMessages = snap.slice(0, lastUserIdx + 1);
    setMessages(newMessages);
    // 异步发送（先确保 setMessages 生效，避免和新的 addMessage 撞）
    setTimeout(() => sendInternal(userMessage, newMessages), 0);
  };

  // —— 内部发送核心逻辑（handleSend 和 handleRetry 共用）
  const sendInternal = async (userMessage: string, historyUptoLastUser: ChatMessage[]) => {
    const trimmed = (userMessage ?? '').trim();
    if (!trimmed || loading) return;

    setLoading(true);
    // 如果用户消息还没加（handleRetry 场景已经加了），先补一条 user 消息
    let workingHistory = historyUptoLastUser ?? [];
    let targetUserMessageAlreadyIn =
      workingHistory.length > 0 &&
      workingHistory[workingHistory.length - 1].role === 'user' &&
      workingHistory[workingHistory.length - 1].content === trimmed;
    if (!targetUserMessageAlreadyIn) {
      const uid = Date.now() + Math.random();
      workingHistory = [
        ...workingHistory,
        { id: uid, role: 'user', content: trimmed, timestamp: new Date() },
      ];
      setMessages(workingHistory);
    }

    const aiMsgId = Date.now() + Math.random();
    const emptyAIMsg: ChatMessage = { id: aiMsgId, role: 'ai', content: '', timestamp: new Date() };
    setMessages((prev) => [...prev, emptyAIMsg]);
    streamAIMsgIdRef.current = aiMsgId;
    streamingMsgIdsRef.current.add(aiMsgId);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const payload = (() => {
        // —— 根据 workingHistory 构造连续对话 payload（最多 MAX_HISTORY=5 条）
        const recent = [...workingHistory];
        const windowMsgs = recent.slice(-MAX_HISTORY).map((m) => ({
          role: m.role === 'ai' ? 'assistant' : m.role,
          content: m.content,
        }));
        return { message: trimmed, messages: windowMsgs };
      })();
      const response = await fetch(RAG_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream, application/json, text/plain, */*',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      if (!response.body) throw new Error('响应体为空（后端未返回流）');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let rawBuffer = '';
      let sseMode = false;
      let textSinceLastCheck = '';

      const flushPendingText = () => {
        if (textSinceLastCheck) {
          appendToMessage(aiMsgId, textSinceLastCheck);
          textSinceLastCheck = '';
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        if (!sseMode) {
          const probe = rawBuffer + chunk;
          if (/(\r?\n|^)data:\s*/m.test(probe) || /\[DONE\]/.test(probe) || /\bchoices\b/.test(probe)) {
            sseMode = true;
            rawBuffer = probe;
          } else {
            flushPendingText();
            textSinceLastCheck += chunk;
            rawBuffer = probe;
            flushPendingText();
            continue;
          }
        } else {
          rawBuffer += chunk;
        }

        const lines = rawBuffer.split(/\r?\n/);
        rawBuffer = lines.pop() || '';

        for (let i = 0; i < lines.length; i++) {
          const rawLine = lines[i];
          const hasDataPrefix = rawLine.startsWith('data:');
          const line = hasDataPrefix ? rawLine.substring(5).trimStart() : rawLine;

          if (hasDataPrefix) {
            if (!line) continue;
            if (line === '[DONE]') continue;

            let delta = '';
            if ((line.startsWith('{') && line.endsWith('}')) || (line.startsWith('[') && line.endsWith(']'))) {
              try {
                const json = JSON.parse(line);
                if (typeof json === 'string') {
                  delta = json;
                } else if (json?.error) {
                  throw new Error(json.error);
                } else if (typeof json?.code === 'number') {
                  if (json.code !== 200) throw new Error(json.msg || '请求失败');
                  const d = json.data ?? {};
                  delta = typeof d === 'string'
                    ? d
                    : String(d.delta ?? d.content ?? d.answer ?? d.message ?? d.chunk ?? '');
                } else {
                  delta = String(
                    json?.choices?.[0]?.delta?.content ??
                      json?.choices?.[0]?.message?.content ??
                        json?.delta?.content ??
                          json?.delta ??
                            json?.content ??
                              json?.answer ??
                                json?.message ??
                                  json?.chunk ??
                                    '',
                  );
                }
              } catch (e) {
                if (e instanceof Error && e.message === '请求失败') throw e;
                delta = line;
              }
            } else {
              delta = line;
            }
            if (delta) appendToMessage(aiMsgId, delta);
            continue;
          }

          if (rawLine !== '') appendToMessage(aiMsgId, rawLine + '\n');
        }
      }

      flushPendingText();
      if (rawBuffer) {
        const hasDataPrefix = rawBuffer.startsWith('data:');
        if (hasDataPrefix) {
          const line = rawBuffer.substring(5).trimStart();
          if (line && line !== '[DONE]') {
            try {
              let tail = '';
              if ((line.startsWith('{') && line.endsWith('}')) || (line.startsWith('[') && line.endsWith(']'))) {
                const json = JSON.parse(line);
                if (typeof json === 'string') {
                  tail = json;
                } else if (typeof json?.code === 'number') {
                  if (json.code !== 200) throw new Error(json.msg || '请求失败');
                  const d = json.data ?? {};
                  tail = typeof d === 'string' ? d : String(d.answer ?? d.message ?? d.delta ?? d.content ?? '');
                } else {
                  tail = String(json?.choices?.[0]?.delta?.content ?? json?.delta ?? json?.content ?? json?.answer ?? json?.message ?? '');
                }
              } else {
                tail = line;
              }
              if (tail) appendToMessage(aiMsgId, tail);
            } catch (e) {
              if (e instanceof Error && e.message === '请求失败') throw e;
              appendToMessage(aiMsgId, line);
            }
          }
        } else {
          appendToMessage(aiMsgId, rawBuffer);
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        appendToMessage(aiMsgId, '\n\n[已停止生成]');
      } else if (err?.name === 'TypeError' && /Failed to fetch|network|fetch failed/i.test(err?.message || '')) {
        markMessageAsError(aiMsgId, '网络连接断开，请检查网络或后端服务是否启动后点击「重新生成」');
      } else {
        const msg = err?.message || '请求失败';
        markMessageAsError(aiMsgId, '[请求失败] ' + msg);
      }
    } finally {
      forceFlushAllPending();
      setLoading(false);
      abortControllerRef.current = null;
      streamAIMsgIdRef.current = null;
      streamingMsgIdsRef.current.delete(aiMsgId);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

const formatTime = (date: Date): string =>
  new Date(date).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });

interface MessageItemProps {
  msg: ChatMessage;
  showStreamingCursor: boolean;
  isStreaming: boolean;
  isLoadingSkeleton: boolean;
  showRetry: boolean;
  onRetry?: () => void;
}

const MessageItem = memo(({ msg, showStreamingCursor, isStreaming, isLoadingSkeleton, showRetry, onRetry }: MessageItemProps) => {
  return (
    <div
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
      <div className="ai-chat__msg-body">
        {msg.role === 'ai' && isLoadingSkeleton ? (
          <span className="ai-chat__msg-body--loading">
            思考中
            <span className="ai-chat__dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </span>
        ) : msg.role === 'ai' ? (
          <>
            {isStreaming ? (
              <StreamingMarkdownLite content={msg.content} />
            ) : (
              <MarkdownRenderer content={msg.content} />
            )}
            {showStreamingCursor && (
              <span className="ai-chat__cursor" aria-hidden>▋</span>
            )}
            {showRetry && (
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-start', gap: 8 }}>
                <button
                  type="button"
                  onClick={onRetry}
                  style={{
                    padding: '4px 14px',
                    fontSize: 12,
                    lineHeight: 1.6,
                    background: '#2d2d2d',
                    color: '#e6e6e6',
                    border: '1px solid #555',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                  className="ai-chat__retry-btn"
                >
                  重新生成
                </button>
              </div>
            )}
          </>
        ) : (
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
            {msg.content}
          </span>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.msg.id === next.msg.id &&
    prev.msg.role === next.msg.role &&
    prev.msg.content === next.msg.content &&
    prev.msg.timestamp.getTime() === next.msg.timestamp.getTime() &&
    prev.showStreamingCursor === next.showStreamingCursor &&
    prev.isStreaming === next.isStreaming &&
    prev.isLoadingSkeleton === next.isLoadingSkeleton &&
    prev.showRetry === next.showRetry
  );
});
MessageItem.displayName = 'MessageItem';

  const isStreamingLastAIMessage = (msgId: number): boolean =>
    loading && streamAIMsgIdRef.current === msgId &&
    messages[messages.length - 1]?.id === msgId;

  const isMessageStreaming = (msgId: number): boolean =>
    streamingMsgIdsRef.current.has(msgId);

  // 判断某条 AI 消息是否需要显示「重新生成」：最后一条 AI + 非 loading + 包含失败/停止标记
  const shouldShowRetryFor = (msg: ChatMessage, idx: number): boolean => {
    if (loading) return false;
    if (msg.role !== 'ai') return false;
    // 必须是最末尾（或末尾之后没新消息）
    if (idx !== messages.length - 1) return false;
    const c = msg.content ?? '';
    return c.includes('[已停止生成]') || c.includes('[请求失败]') || c.includes('网络连接断开');
  };

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
              messages.map((msg, idx) => (
                <MessageItem
                  key={msg.id}
                  msg={msg}
                  showStreamingCursor={isStreamingLastAIMessage(msg.id)}
                  isStreaming={isMessageStreaming(msg.id)}
                  isLoadingSkeleton={isStreamingLastAIMessage(msg.id) && !msg.content}
                  showRetry={shouldShowRetryFor(msg, idx)}
                  onRetry={handleRetry}
                />
              ))
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
              placeholder={loading ? '生成中... 按 Enter 停止' : '输入问题... (Enter 发送，Shift+Enter 换行)'}
              rows={2}
              disabled={false}
            />
            {loading ? (
              <button
                type="button"
                className="ai-chat__send-btn ai-chat__send-btn--stop"
                onClick={handleStop}
              >
                停止
              </button>
            ) : (
              <button
                type="submit"
                className="ai-chat__send-btn"
                disabled={!input.trim()}
              >
                发送
              </button>
            )}
          </form>
        </>
      )}
    </div>
  );
}

export default AIChat;