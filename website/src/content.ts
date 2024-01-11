/**
 * 内容管线：import.meta.glob 加载 content/ 下全部 markdown，
 * 解析 frontmatter（title/group/order 平铺字段），导出导航模型。
 * content/ 为空时 PAGES/NAV 为空数组，站点照常运行。
 */

export interface DocPage {
  /** 路由 id，由文件路径推导：content/guide/entry.md → 'guide/entry' */
  id: string;
  title: string;
  group: string;
  order: number;
  body: string;
}

export interface NavItem {
  id: string;
  title: string;
  path: string;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

/** 侧边栏分组顺序（显式定义，不依赖文件系统顺序）。 */
export const GROUP_ORDER = ['指南', '插件', '参考', '迁移', '其他'] as const;

/** 分组显示名：frontmatter 的 group 是固定取值，展示层允许别名（其他 → FAQ）。 */
export function groupLabel(group: string): string {
  return group === '其他' ? 'FAQ' : group;
}

const modules = import.meta.glob('../content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** 极简 frontmatter 解析：仅支持 `key: value` 平铺字段，无嵌套无数组。 */
function parseFrontmatter(source: string): { data: Record<string, string>; body: string } {
  const m = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: source };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+)\s*:\s*(.+?)\s*$/);
    if (kv) data[kv[1]] = kv[2];
  }
  return { data, body: source.slice(m[0].length) };
}

export const PAGES: DocPage[] = Object.entries(modules)
  .map(([file, source]) => {
    const id = file.replace(/^\.\.\/content\//, '').replace(/\.md$/, '');
    const { data, body } = parseFrontmatter(source);
    return {
      id,
      title: data.title ?? id,
      group: data.group ?? '其他',
      order: Number(data.order ?? 0),
      body,
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

export const PAGE_MAP: ReadonlyMap<string, DocPage> = new Map(PAGES.map((p) => [p.id, p]));

export const NAV: NavGroup[] = GROUP_ORDER.map((group) => ({
  group,
  items: PAGES.filter((p) => p.group === group)
    .sort((a, b) => a.order - b.order)
    .map((p) => ({ id: p.id, title: p.title, path: `#/${p.id}` })),
})).filter((g) => g.items.length > 0);
