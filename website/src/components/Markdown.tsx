import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

/**
 * Markdown 渲染封装：
 * - remark-gfm：表格、删除线、任务列表
 * - 内联 remark 插件：把 `> [!WARNING]` 等 GFM alert 语法转成带 class 的提示块
 * - 内联 rehype 插件：给标题补 id（页内锚点用）
 * - rehype-highlight：代码高亮（hljs 主题见 styles/hljs-*.css）
 * - 自定义 a：站内 #/ 链接直通、相对 .md 链接改写为 hash 路由、外链新开标签页
 */

interface MdNode {
  type: string;
  tagName?: string;
  value?: string;
  children?: MdNode[];
  data?: { hProperties?: Record<string, unknown> };
  properties?: Record<string, unknown>;
}

/** 把 > [!NOTE|TIP|IMPORTANT|WARNING|CAUTION] 转成 <blockquote class="alert alert-x">。 */
function remarkAlerts() {
  return (tree: MdNode) => {
    const visit = (node: MdNode) => {
      if (node.type === 'blockquote') {
        const first = node.children?.[0];
        const t = first?.type === 'paragraph' ? first.children?.[0] : undefined;
        if (t?.type === 'text' && typeof t.value === 'string') {
          const m = t.value.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\r?\n?/i);
          if (m) {
            const kind = m[1].toLowerCase();
            t.value = t.value.slice(m[0].length);
            if (t.value === '') first!.children!.shift();
            node.data = node.data ?? {};
            node.data.hProperties = {
              ...node.data.hProperties,
              className: `alert alert-${kind}`,
            };
          }
        }
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

function textOf(node: MdNode): string {
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(textOf).join('');
}

/** 给 h1–h6 补 id，支持中文（保留 CJK 字符，空白转连字符）。 */
function rehypeHeadingIds() {
  return (tree: MdNode) => {
    const visit = (node: MdNode) => {
      if (node.type === 'element' && node.tagName && /^h[1-6]$/.test(node.tagName)) {
        const slug = textOf(node).trim().toLowerCase().replace(/\s+/g, '-');
        if (slug) {
          node.properties = node.properties ?? {};
          if (!node.properties.id) node.properties.id = slug;
        }
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

/** 相对 .md 链接 → hash 路由。'./entry.md#x'（当前页 guide/getting-started）→ '#/guide/entry#x' */
function resolveMdLink(link: string, currentId: string): string {
  const [file, anchor] = link.split('#');
  const dir = currentId.split('/').slice(0, -1);
  for (const seg of file.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') dir.pop();
    else dir.push(seg);
  }
  const id = dir.join('/').replace(/\.md$/, '');
  return `#/${id}${anchor ? `#${anchor}` : ''}`;
}

interface AnchorProps {
  href?: string;
  children?: ReactNode;
  node?: unknown;
}

export function Markdown({ source, currentId }: { source: string; currentId: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkAlerts]}
      rehypePlugins={[rehypeHeadingIds, rehypeHighlight]}
      components={{
        a: ({ href: link, children, node: _node }: AnchorProps) => {
          if (!link) return <a>{children}</a>;
          if (link.startsWith('#/')) {
            // 站内 hash 路由链接原样保留
            return <a href={link}>{children}</a>;
          }
          if (link.startsWith('#')) {
            // 页内锚点（#某标题）：补全为 #/当前页#锚点，
            // 否则 hashchange 会把锚点当路由 id 解析而渲染 404
            return <a href={`#/${currentId}${link}`}>{children}</a>;
          }
          if (/^(https?:)?\/\//.test(link) || link.startsWith('mailto:')) {
            return (
              <a href={link} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          }
          if (/\.md($|#)/.test(link)) {
            return <a href={resolveMdLink(link, currentId)}>{children}</a>;
          }
          return <a href={link}>{children}</a>;
        },
      }}
    >
      {source}
    </ReactMarkdown>
  );
}
