import { memo } from 'react';

interface Props {
  content: string;
}

interface Segment {
  type: 'text' | 'code';
  lang?: string;
  text: string;
}

/**
 * 流式半渲染器（性能优先，只做"肉眼可见的低成本格式"，不解析完整 Markdown）
 * - 识别成对/不成对的 fenced code block → 套深色背景 + 等宽字体
 * - 识别 ### xxx 行 → 加粗放大（不重绘整棵树）
 * - 识别行内 `xxx` → 行内高亮
 * - 识别 - / 数字. → 加列表缩进
 * - 换行完全靠 pre-wrap，绝不凭空加字符
 *
 * 设计原则：不做任何字符串"修复/重写"，流式内容原封不动，只做分区套壳。
 */
const StreamingMarkdownLite = memo(({ content }: Props) => {
  const raw = String(content ?? '');
  if (!raw) return null;

  // 1. 按 fence 分段（支持不成对的开 fence → 把剩余全部当 code）
  //    关键点：fence 分 text→code→text 三段循环，每段用 {type,lang,text} 对象累计，
  //    避免"fence 后语言名被误吞、正文接不上 codeBuf"这种错位
  const segments: Segment[] = [];
  const pushText = (t: string) => {
    if (!t) return;
    if (segments.length > 0 && segments[segments.length - 1].type === 'text') {
      segments[segments.length - 1].text += t;
    } else {
      segments.push({ type: 'text', text: t });
    }
  };
  const ensureCode = (lang?: string) => {
    if (segments.length === 0 || segments[segments.length - 1].type !== 'code') {
      segments.push({ type: 'code', lang: lang || 'text', text: '' });
    } else if (lang && !segments[segments.length - 1].lang) {
      segments[segments.length - 1].lang = lang;
    }
    return segments[segments.length - 1];
  };

  let mode: 'text' | 'code' = 'text';
  let i = 0;
  while (i < raw.length) {
    if (raw.startsWith('```', i)) {
      // —— fence 切换模式 ——
      // 先跳到 fence 尾，跳过同音字提语言
      let j = i + 3;
      while (j < raw.length && j < i + 3 + 20 && /[A-Za-z0-9_-]/.test(raw[j])) j++;
      const lang = raw.substring(i + 3, j).toLowerCase();
      // 跳过 fence + 语言 后面到换行之前的空白/剩余字符（防止语言后面的 comment/字符留在当前行干扰）
      let k = j;
      while (k < raw.length && raw[k] !== '\n' && raw[k] !== '\r') k++;
      // 推进 i：跳过 fence+lang+本行剩余，再吞掉本行结尾换行符（\r\n / \n / \r）
      let next = k;
      if (next < raw.length) {
        if (raw[next] === '\r' && raw[next + 1] === '\n') next += 2;
        else next += 1;
      }
      i = next;

      if (mode === 'text') {
        mode = 'code';
        ensureCode(lang);
      } else {
        // 闭合 fence：切回 text；code 段保留已有内容（即使为空也不删，空代码块也要显示框）
        mode = 'text';
      }
      continue;
    }

    const ch = raw[i];
    if (mode === 'text') {
      // text 模式：按单字符累积（通过 pushText 合并段）
      // 换行单独走，避免字符串拆分过慢
      let end = i;
      while (end < raw.length && !raw.startsWith('```', end)) end++;
      const slice = raw.substring(i, end);
      pushText(slice);
      i = end;
    } else {
      const codeSeg = ensureCode();
      // code 模式：累积到下次 fence 之前
      let end = i;
      while (end < raw.length && !raw.startsWith('```', end)) end++;
      codeSeg.text += raw.substring(i, end);
      i = end;
    }
    // 防止空串死循环
    if (ch === undefined) break;
  }

  return (
    <div className="markdown-body streaming-markdown-lite">
      {segments.map((seg, idx) => {
        if (seg.type === 'code') {
          return (
            <div key={idx} className="markdown-code-block markdown-code-block--streaming">
              {seg.lang && (
                <div className="markdown-code-block__lang-tag">{seg.lang}</div>
              )}
              <pre className="markdown-code-block__pre">
                <code className="markdown-code-block__code">{seg.text}</code>
              </pre>
            </div>
          );
        }
        return <StreamingTextBlock key={idx} text={seg.text} />;
      })}
    </div>
  );
});

StreamingMarkdownLite.displayName = 'StreamingMarkdownLite';
export default StreamingMarkdownLite;

/** 把普通文字段落里的行内格式（标题/加粗/列表/行内反引号）用低成本正则替换出来 */
const StreamingTextBlock = memo(({ text }: { text: string }) => {
  if (!text) return null;
  const lines = String(text).split(/(\r?\n)/);
  return (
    <div className="streaming-text">
      {lines.map((ln, i) => {
        if (/^\r?\n$/.test(ln)) return <br key={i} />;
        return <StreamingLine key={i} raw={ln} />;
      })}
    </div>
  );
});
StreamingTextBlock.displayName = 'StreamingTextBlock';

const StreamingLine = memo(({ raw }: { raw: string }) => {
  // 空行
  if (!raw) return <div className="streaming-line streaming-line--empty">&nbsp;</div>;

  // 识别 ### #/等标题行
  const h = /^(#{1,6})\s*(.*)$/.exec(raw);
  if (h) {
    const level = h[1].length;
    const cls = `streaming-line streaming-line--h${level}`;
    return <div className={cls}><InlineContent raw={h[2]} /></div>;
  }

  // 识别有序列表
  const ol = /^(\d+\.)\s+(.*)$/.exec(raw);
  if (ol) {
    return (
      <div className="streaming-line streaming-line--ol">
        <span className="streaming-line__bullet">{ol[1]}</span>
        <span className="streaming-line__content"><InlineContent raw={ol[2]} /></span>
      </div>
    );
  }
  // 无序列表
  const ul = /^([-*+])\s+(.*)$/.exec(raw);
  if (ul) {
    return (
      <div className="streaming-line streaming-line--ul">
        <span className="streaming-line__bullet">•</span>
        <span className="streaming-line__content"><InlineContent raw={ul[2]} /></span>
      </div>
    );
  }

  return <div className="streaming-line"><InlineContent raw={raw} /></div>;
});
StreamingLine.displayName = 'StreamingLine';

/** 行内：`xxx` 反引号 + **加粗** + 普通文字 */
const InlineContent = memo(({ raw }: { raw: string }) => {
  if (!raw) return null;
  const tokens: Array<{ t: 'code' | 'bold' | 'text'; v: string }> = [];
  let buf = '';
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '`') {
      const end = raw.indexOf('`', i + 1);
      if (buf) { tokens.push({ t: 'text', v: buf }); buf = ''; }
      if (end !== -1) {
        tokens.push({ t: 'code', v: raw.substring(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (ch === '*' && raw[i + 1] === '*') {
      const end = raw.indexOf('**', i + 2);
      if (buf) { tokens.push({ t: 'text', v: buf }); buf = ''; }
      if (end !== -1) {
        tokens.push({ t: 'bold', v: raw.substring(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  if (buf) tokens.push({ t: 'text', v: buf });

  return (
    <>
      {tokens.map((tk, idx) => {
        switch (tk.t) {
          case 'code': return <code key={idx} className="markdown-inline-code">{tk.v}</code>;
          case 'bold': return <strong key={idx}>{tk.v}</strong>;
          default: return <span key={idx}>{tk.v}</span>;
        }
      })}
    </>
  );
});
InlineContent.displayName = 'InlineContent';