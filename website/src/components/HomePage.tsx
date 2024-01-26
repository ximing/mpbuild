import type { ReactNode } from 'react';
import { NAV } from '../content';
import { Pipeline } from './Pipeline';

const FEATURES: { title: string; desc: string }[] = [
  { title: '图驱动架构', desc: '建图 → 归属分析 → Output Plan → 变换写盘，四段流水线职责清晰' },
  { title: 'SWC + Lightning CSS', desc: '无 Babel/PostCSS 负担，原生级速度' },
  { title: '精准分包', desc: '多源染色归属模型，shared 模块复制或提主包可配' },
  { title: '增量 watch + 磁盘缓存', desc: '内容 hash 增量建图，差量写盘' },
  { title: '条件编译', desc: '文件级多态 infix + 块级 @ifdef，编译时拆分多端代码' },
  { title: 'npm 支持', desc: '内置 npmCompat 变换，海量 npm 包开箱即用' },
  { title: '插件体系', desc: 'load/generate 两段钩子 + 官方 SCSS / copy / projectConfig 插件' },
  { title: '可观测', desc: 'mpb analyze 产物分析 + mpb inspect graph 逐节点图检查 + 16 个语义化诊断码' },
];

interface TermSeg {
  t: string;
  c?: 'term-comment' | 'term-cmd' | 'term-str';
}

/** 终端块内容（结构化数据，避免在 JSX 文本里转义花括号）。 */
const TERM_LINES: TermSeg[][] = [
  [{ t: '# 安装', c: 'term-comment' }],
  [{ t: 'npm i -D @mpbuild/cli', c: 'term-cmd' }],
  [],
  [{ t: '# mpbuild.config.mjs', c: 'term-comment' }],
  [{ t: 'export default {', c: 'term-cmd' }],
  [{ t: '  src: ' }, { t: "'src'", c: 'term-str' }, { t: ',' }],
  [{ t: '  entry: ' }, { t: "'./entry.js'", c: 'term-str' }, { t: ',' }],
  [{ t: '  output: { dir: ' }, { t: "'dist'", c: 'term-str' }, { t: ' },' }],
  [{ t: '}', c: 'term-cmd' }],
  [],
  [{ t: '# 构建', c: 'term-comment' }],
  [{ t: 'mpb build', c: 'term-cmd' }],
];

function renderLine(line: TermSeg[], lineIdx: number): ReactNode {
  return (
    <div key={lineIdx}>
      {line.length === 0
        ? ' '
        : line.map((seg, segIdx) =>
            seg.c ? (
              <span key={segIdx} className={seg.c}>
                {seg.t}
              </span>
            ) : (
              <span key={segIdx}>{seg.t}</span>
            ),
          )}
    </div>
  );
}

/** 首页：hero + 终端风格快速开始 + features 网格。 */
export function HomePage() {
  // 内容就绪后指向真实快速开始页；为空时回退到首页（B 组内容合入后自然生效）
  const startPath = NAV.find((g) => g.group === '指南')?.items[0]?.path ?? '#/';

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-text">
          <h1 className="hero-title">mpbuild</h1>
          <p className="hero-tagline">图驱动的微信小程序构建工具</p>
          <p className="hero-sub">先建图，再染色，再写盘。<br />SWC + Lightning CSS · 精准分包 · 增量缓存</p>
          <div className="hero-actions">
            <a className="btn btn-primary" href={startPath}>
              快速开始 →
            </a>
            <a className="btn" href="https://github.com/ximing/mpbuild" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </div>
        <div className="hero-terminal" aria-label="快速开始示例">
          <div className="terminal-bar">
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-dot" />
          </div>
          <pre className="terminal-body">
            <code>{TERM_LINES.map(renderLine)}</code>
          </pre>
        </div>
      </section>

      <Pipeline />

      <section className="how">
        <div className="how-copy">
          <h2>小程序是一张图，不是一条 loader 链</h2>
          <p>
            页面、组件、模板、样式、JSON、npm 互相引用。mpbuild 先把这张网建成模块图，在图上决定谁属于主包 / 分包 / shared，再生成确定性的 Output Plan，最后才做变换写盘。watch 是图上的 patch。
          </p>
          <p>
            <a href="#/guide/architecture">看四段流水线如何工作 →</a>
          </p>
        </div>
        <img
          className="how-img"
          src={`${import.meta.env.BASE_URL}assets/graph.png`}
          alt="模块图按 main / subpackage / shared 染色"
        />
      </section>

      <section className="commands">
        <h2>命令</h2>
        <ul>
          <li>
            <code>mpb build</code>
            <span>全量构建</span>
          </li>
          <li>
            <code>mpb dev</code>
            <span>构建 + watch</span>
          </li>
          <li>
            <code>mpb analyze</code>
            <span>写出图与 plan 的 JSON</span>
          </li>
          <li>
            <code>mpb inspect graph</code>
            <span>打印每个节点的 owner 与出边</span>
          </li>
        </ul>
      </section>

      <section className="features">
        <div className="features-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
