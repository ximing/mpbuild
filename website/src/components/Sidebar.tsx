import { groupLabel, type NavGroup } from '../content';

interface SidebarProps {
  nav: NavGroup[];
  currentId: string;
  open: boolean;
  onClose: () => void;
}

/** 左侧边栏：按分组展示当前分区页面。<1024px 时由 Layout 抽屉化控制。 */
export function Sidebar({ nav, currentId, open, onClose }: SidebarProps) {
  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="文档导航">
        <nav>
          {nav.map((g) => (
            <section className="sidebar-group" key={g.group}>
              <h2 className="sidebar-group-title">{groupLabel(g.group)}</h2>
              <ul>
                {g.items.map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.path}
                      className={item.id === currentId ? 'active' : undefined}
                      aria-current={item.id === currentId ? 'page' : undefined}
                      onClick={onClose}
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </aside>
    </>
  );
}
