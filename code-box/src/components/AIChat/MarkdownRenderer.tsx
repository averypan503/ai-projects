import { useState, memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const SAFE_LANG_MAP: Record<string, string> = {
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  html: 'markup',
  xml: 'markup',
  md: 'markdown',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  cjs: 'javascript',
  mjs: 'javascript',
  vue: 'markup',
  json: 'json',
  css: 'css',
  scss: 'scss',
  less: 'less',
  py: 'python',
  java: 'java',
  go: 'go',
  rs: 'rust',
  rb: 'ruby',
  php: 'php',
  sql: 'sql',
};
const normalizeLang = (lang?: string | null): string => {
  const raw = (lang || '').trim().toLowerCase();
  if (!raw) return 'text';
  if (SAFE_LANG_MAP[raw]) return SAFE_LANG_MAP[raw];
  return raw;
};

interface MarkdownRendererProps {
  content: string;
}

interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock = memo(({ language, code }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const oneWordNoNewline =
    code.trim().length > 0 &&
    !/\s/.test(code.trim()) &&
    code.trim().length <= 64;

  if (oneWordNoNewline) {
    return <code className="markdown-inline-code">{code}</code>;
  }

  const safeLang = normalizeLang(language);

  return (
    <div className="markdown-code-block">
      <button
        type="button"
        className="markdown-code-block__copy"
        onClick={handleCopy}
      >
        {copied ? '已复制' : '复制'}
      </button>
      <SyntaxHighlighter
        style={oneDark}
        language={safeLang}
        PreTag="div"
        customStyle={{
          borderRadius: 8,
          fontSize: '0.85em',
          margin: 0,
          padding: '14px 16px 48px 16px',
          background: '#1e1f1c',
          overflowX: 'auto',
        }}
        codeTagProps={{ style: { fontFamily: 'Consolas, Monaco, "Courier New", monospace', whiteSpace: 'pre' } }}
        wrapLongLines={false}
        useInlineStyles
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';

const formatCodeBody = (raw: string) => {
  let b = String(raw ?? '');
  // 开头可能残留"语言标记+内容粘一起"： "javascriptfunction bubbleSort" → 去掉开头的语言名
  b = b.replace(/^[ \t]*([a-zA-Z0-9_-]{1,20})(?=[ \t]{0,4}\/[\/\*]|[ \t]{0,4}(?:function|const|let|var|class|import|export|return|if|for|while))/, '');
  b = b.trimStart();

  // P1. 注释前强制换行
  b = b.replace(/([};)\]"'`])([ \t]*\/\/)/g, '$1\n$2');
  // P2. 注释内容后如果下一个 token 是关键字也强制换行
  b = b.replace(/(\/\/[^\n]*?)(?=[ \t]*(?:function|const|let|var|class|import|export|return\b|if\b|for\b|while\b|switch\b|console\.))/g, '$1\n');
  // P3. 关键字粘连
  b = b.replace(
    /(import|export|from|const|let|var|function|return|if|else|for|while|switch|case|break|continue|new|class|extends|implements|interface|type|async|await|try|catch|finally|throw)([A-Za-z_$[{(])/g,
    '$1 $2',
  );
  // P4. 语句分隔（分号/右括号/右花括号后立刻跟下一句/下关键字）
  b = b.replace(/\)([ \t]*;)([ \t]*)(?=(?:const|let|var|function|class|import|export|return\b|if\b|for\b|while\b|switch\b|\/\/|console\.|[A-Za-z_$][A-Za-z0-9_$]*\s*=))/g, ')$1\n');
  b = b.replace(/\}([ \t]*)(?=(?:const|let|var|function|class|import|export|return\b|if\b|for\b|while\b|switch\b|\/\/|console\.))/g, '}\n');
  b = b.replace(/;([ \t]*)(?=(?:const|let|var|function|class|import|export|return\b|if\b|for\b|while\b|switch\b|\/\/|console\.))/g, ';\n');
  // P5. 控制流嵌套粘连
  b = b.replace(/\}\{/g, '} {');
  b = b.replace(/\)(if|for|while|switch)\(/g, ') $1(');
  // P6. 箭头函数
  b = b.replace(/=>([\[{])/g, '=> $1');
  // P7. 引号粘连
  b = b.replace(/(from|import|require|of|in)\s*(['"`])/g, '$1 $2');
  // P8. 解构粘连
  b = b.replace(/,\s*(\{)/g, ', $1');
  b = b.replace(/(\})\s*,/g, '$1, ');
  // P9. else/catch/finally
  b = b.replace(/\}(else|catch|finally)/g, '} $1');

  // 避免连续多行空行
  b = b.replace(/\n{3,}/g, '\n\n').trimEnd();
  return b;
};

const MarkdownRenderer = memo(({ content }: MarkdownRendererProps) => {
  const normalized = useMemo(() => {
    let s = String(content ?? '');
    if (!s) return '';

    // Step 0. 全局清污：结尾 undefined/null 脏文本、连续换行压缩
    s = s.replace(/\s*(```\s*)?`?\s*(undefined|null|\[object Object\])\s*`?\s*$/g, '').trimEnd();

    // Step 1. 强粘连修复（在整段字里硬插换行/空格给明显的 Markdown 结构符号）
    // 1a. 任何 ``` 前面如果是中文/字母/数字/标点（没换行），强制断段
    s = s.replace(/([^\n\r\s])(```)/g, '$1\n\n$2');
    // 1b. 任何 ``` 后面如果立刻跟了 ```language关键字粘连 语言+function/const开头 的情况
    //     先让「```jsfunction」→「```js\nfunction」，同时去掉 ``` 后面的空格
    s = s.replace(/```([a-zA-Z0-9_-]{0,20})[ \t]*/g, (m, lang) => '```' + (lang || '') + '\n');
    // 1c. ### 和前字粘连 或 ###后没空格
    s = s.replace(/([^\n\r#])(#{1,6})/g, '$1\n\n$2');
    s = s.replace(/^(#{1,6})([^\s#])/gm, '$1 $2');
    s = s.replace(/\n(#{1,6})([^\s#])/g, '\n$1 $2');
    // 1d. "-冒泡排序" 这种中划线连字变成 "- 冒泡排序"
    s = s.replace(/^([\u4e00-\u9fa5A-Za-z0-9]+)[-_—](?=[\u4e00-\u9fa5A-Za-z])/gm, (m, label) => {
      if (/^(算法原理|复杂度分析|时间复杂度|空间复杂度|稳定性|适用场景|代码实现|总结|对比|结论|备注)$/.test(label)) {
        return '## ' + label + '\n';
      }
      return m;
    });
    // 1e. 行内列表粘连 "-冒泡排序：..." 或 "-选择排序：..."（中文短横线+字）→ 拆成列表
    s = s.replace(/([。！？.!?：:；;。]|\n)\s*-\s*([\u4e00-\u9fa5])/g, '$1\n- $2');
    // 1f. "-冒泡排序:" / "-选择排序:" 中划线前无空行 → 给它单独起行
    s = s.replace(/([^\n])(-[\u4e00-\u9fa5A-Za-z][^：]*：)/g, '$1\n$2');

    // Step 2. 逐行状态机扫描处理 fenced code block（最关键：保证每对 ``` 开闭结构正确，开 fence 后独立行+语言独立行+代码正文换行）
    type State = 'text' | 'code';
    let state: State = 'text';
    let codeLang = '';
    let codeBuf: string[] = [];
    const out: string[] = [];

    const pushCodeBlock = () => {
      const body = formatCodeBody(codeBuf.join('\n'));
      out.push('```' + (codeLang || 'text'));
      out.push(body);
      out.push('```');
      out.push('');
      codeBuf = [];
      codeLang = '';
      state = 'text';
    };

    // 按原换行拆行，然后逐行扫
    const rows = s.split(/\r?\n/);
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];

      if (state === 'code') {
        // —— 状态：代码块内 ——
        // 关键：同一行如果出现"代码 + ``` 结尾 + 后续文字" → 拆开处理
        const closeIdx = raw.indexOf('```');
        if (closeIdx !== -1) {
          const before = raw.substring(0, closeIdx);
          const after = raw.substring(closeIdx + 3);
          if (before.trim()) codeBuf.push(before);
          pushCodeBlock();
          // 本行剩下的内容退回 text 模式，从 "剩余" 再扫一次（可能还有 ``` 开块）
          if (after.trim()) rows.splice(i + 1, 0, after);
          continue;
        }
        codeBuf.push(raw);
        continue;
      }

      // —— 状态：正文 ——
      // 1. 一行可能多次出现 ```（冒泡排序```javascriptfunctionbubbleSort：这种"字+```+lang+code"混一行）
      //    用 while 连续处理每一处 ```
      let work = raw;
      let consumedHead = '';

      while (work) {
        const fenceIdx = work.indexOf('```');
        if (fenceIdx === -1) {
          consumedHead += work;
          work = '';
          break;
        }

        // fence 之前的文字（可能是"冒泡排序"这样的小标题）
        const before = work.substring(0, fenceIdx);
        const after = work.substring(fenceIdx + 3);

        if (before) {
          if (consumedHead) consumedHead += before;
          else consumedHead = before;
        }

        // after 是 ``` 后面紧跟的："javascriptfunctionbubbleSort(arr)..."
        // 提取最多 20 字符的语言标识符（字母数字下划线）
        const langMatch = /^([a-zA-Z0-9_-]{0,20})([\s\S]*)$/.exec(after);
        let lang = '';
        let restAfter = after;
        if (langMatch) {
          lang = langMatch[1];
          restAfter = langMatch[2];
        }

        // 进入 code 状态
        if (consumedHead) {
          out.push(consumedHead.trimEnd());
          consumedHead = '';
        }
        state = 'code';
        codeLang = lang;
        codeBuf = [];

        // restAfter 是这行 fence 后面紧贴的代码正文（function bubbleSort...）
        // 同时 restAfter 这一行可能还包含"```"作为结尾 fence
        const closeIdx = restAfter.indexOf('```');
        if (closeIdx !== -1) {
          const cb = restAfter.substring(0, closeIdx);
          if (cb.trim()) codeBuf.push(cb);
          pushCodeBlock();
          work = restAfter.substring(closeIdx + 3);
        } else {
          if (restAfter) codeBuf.push(restAfter);
          work = '';
        }
      }

      if (consumedHead) {
        out.push(consumedHead);
      } else if (state === 'text') {
        // 维持空行（段落分隔）
        if (i > 0 && raw === '' && out[out.length - 1] !== '') out.push('');
      }
    }

    // 扫完所有行，如果仍停留在 code 状态（没闭合 fence 是流式常见情况），手动闭合
    if (state === 'code') pushCodeBlock();

    // Step 3. 再做一遍结构清理（段落分隔连续换行压缩、列表项补换行）
    let finalStr = out.join('\n').trimStart();
    finalStr = finalStr.replace(/\n{3,}/g, '\n\n');
    // - 列表项独占行保障
    finalStr = finalStr.replace(/(^|[^\n])(\n- )/g, (m, before, dash) => (before.endsWith('\n') ? m : before + '\n' + dash));
    finalStr = finalStr.replace(/(^|[^\n])(\n\d+\. )/g, (m, before, dash) => (before.endsWith('\n') ? m : before + '\n' + dash));

    return finalStr;
  }, [content]);

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');

            if (inline) {
              return (
                <code className="markdown-inline-code" {...props}>
                  {children}
                </code>
              );
            }

            const codeText = String(children ?? '').replace(/\n$/, '');
            const safeLang = match ? normalizeLang(match[1]) : 'text';

            return <CodeBlock language={safeLang} code={codeText} />;
          },
          a: ({ href, children, ...props }: any) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          ),
          table: ({ children, ...props }: any) => (
            <div className="markdown-table-wrap">
              <table {...props}>{children}</table>
            </div>
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';

export default MarkdownRenderer;