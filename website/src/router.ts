import { useEffect, useState } from 'react';

export interface HashRoute {
  /** 路由 id，如 'guide/getting-started'；空串表示首页 */
  path: string;
  /** 页内锚点（#/guide/entry#xxx 中的 xxx），无则 null */
  anchor: string | null;
}

function parseHash(): HashRoute {
  const raw = window.location.hash.replace(/^#/, '');
  // 形态：/guide/getting-started 或 /guide/getting-started#anchor
  const [p, a] = raw.split('#');
  const path = p.replace(/^\//, '').replace(/\/+$/, '');
  let anchor: string | null = null;
  if (a) {
    try {
      anchor = decodeURIComponent(a);
    } catch {
      // 畸形百分号编码时回退原始字符串，不白屏
      anchor = a;
    }
  }
  return { path, anchor };
}

/** 极简 hash 路由：解析 location.hash，监听 hashchange。 */
export function useHashRoute(): HashRoute {
  const [route, setRoute] = useState<HashRoute>(parseHash);

  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
