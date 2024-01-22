import { useEffect } from 'react';
import { PAGE_MAP } from './content';
import { useHashRoute } from './router';
import { Layout } from './components/Layout';
import { Markdown } from './components/Markdown';
import { HomePage } from './components/HomePage';

const SITE_NAME = 'mpbuild';

/**
 * 正文首个 h1 与 frontmatter title 同名时去掉：
 * 页面 header 已渲染标题，避免重复。md 文件里的 h1 保留（对纯 markdown 阅读者有意义）。
 */
function stripDuplicateH1(body: string, title: string): string {
  const m = body.match(/^\s*#\s+(.+?)(?:\s+#+)?\s*(?:\r?\n|$)/);
  if (m && m[1].trim() === title) {
    return body.slice(m[0].length);
  }
  return body;
}

export default function App() {
  const { path, anchor } = useHashRoute();
  const isHome = path === '';
  const page = isHome ? undefined : PAGE_MAP.get(path);

  // 页面标题：首页用站点名，文档页「标题 - mpbuild」
  useEffect(() => {
    if (isHome) {
      document.title = `${SITE_NAME} - 图驱动的微信小程序构建工具`;
    } else if (page) {
      document.title = `${page.title} - ${SITE_NAME}`;
    } else {
      document.title = `页面不存在 - ${SITE_NAME}`;
    }
  }, [isHome, page]);

  // 路由变化：回到顶部；带锚点则滚动到锚点（等渲染完成后）
  useEffect(() => {
    if (!anchor) {
      window.scrollTo(0, 0);
      return;
    }
    const t = window.setTimeout(() => {
      document.getElementById(anchor)?.scrollIntoView();
    }, 0);
    return () => window.clearTimeout(t);
  }, [path, anchor]);

  return (
    <Layout currentId={path} withSidebar={!isHome}>
      {isHome ? (
        <HomePage />
      ) : page ? (
        <article className="markdown-body">
          <h1>{page.title}</h1>
          <Markdown source={stripDuplicateH1(page.body, page.title)} currentId={page.id} />
        </article>
      ) : (
        <div className="not-found">
          <h1>页面不存在</h1>
          <p>
            没有找到 <code>#/{path}</code> 对应的页面。
          </p>
          <p>
            <a href="#/">返回首页</a>
          </p>
        </div>
      )}
    </Layout>
  );
}
