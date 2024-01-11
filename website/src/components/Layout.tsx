import { useEffect, useState, type ReactNode } from 'react';
import { groupLabel, NAV } from '../content';
import { Sidebar } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';

interface LayoutProps {
  /** 当前文档路由 id；空串为首页 */
  currentId: string;
  /** 是否展示文档侧栏（首页不展示） */
  withSidebar: boolean;
  children: ReactNode;
}

/**
 * 站壳：顶栏（品牌 / 分区导航 / GitHub / 主题切换 / 汉堡按钮）
 * + 侧栏（文档页，>=1024px 常驻，<1024px 抽屉）+ 内容区 + 页脚。
 */
export function Layout({ currentId, withSidebar, children }: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 路由变化时收起抽屉
  useEffect(() => {
    setDrawerOpen(false);
  }, [currentId]);

  // 抽屉打开时：锁 body 滚动；Escape 关闭
  useEffect(() => {
    if (!drawerOpen) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  return (
    <div className="site">
      <header className="topbar">
        <div className="topbar-inner">
          {withSidebar && (
            <button
              type="button"
              className="menu-button"
              aria-label="打开导航菜单"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen((v) => !v)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
          )}
          <a className="brand" href="#/">
            mpbuild
          </a>
          <nav className="topnav" aria-label="分区导航">
            {NAV.map((g) => (
              <a
                key={g.group}
                href={g.items[0].path}
                className={
                  NAV.find((x) => x.items.some((i) => i.id === currentId))?.group === g.group
                    ? 'active'
                    : undefined
                }
              >
                {groupLabel(g.group)}
              </a>
            ))}
          </nav>
          <div className="topbar-right">
            <a
              className="github-link"
              href="https://github.com/ximing/mpbuild"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub 仓库"
              title="GitHub 仓库"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
              </svg>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className={`site-body${withSidebar ? ' with-sidebar' : ''}`}>
        {withSidebar && (
          <Sidebar nav={NAV} currentId={currentId} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        )}
        <main className="content">{children}</main>
      </div>

      <footer className="site-footer">
        <p>
          MIT License · Copyright (c) 2019-present, ximing ·{' '}
          <a href="https://github.com/ximing/mpbuild" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
