const STAGES: { idx: string; title: string; en: string; desc: string; emit?: boolean }[] = [
  {
    idx: '01',
    title: '建图',
    en: 'graph',
    desc: '从入口 BFS 抽出 script / style / template / json，得到模块图。',
  },
  {
    idx: '02',
    title: '归属',
    en: 'analyze',
    desc: '多源染色：main / 分包 / shared。独立分包越界在图上直接报错。',
  },
  {
    idx: '03',
    title: '计划',
    en: 'plan',
    desc: '每个节点映射到唯一 dest。碰撞加 hash 后缀，产物路径可推理。',
  },
  {
    idx: '04',
    title: '变换',
    en: 'emit',
    desc: 'SWC 处理 JS/TS，Lightning CSS 处理样式，按 plan 差量写盘。',
    emit: true,
  },
];

/** 首页签名件：四段流水线沿一条 compile trace 依次点亮。 */
export function Pipeline() {
  return (
    <section className="pipeline" aria-label="四段流水线">
      <p className="pipeline-kicker">PIPELINE · GRAPH → ANALYZE → PLAN → EMIT</p>
      <div className="pipeline-trace" aria-hidden="true">
        <i />
      </div>
      <ol className="pipeline-row">
        {STAGES.map((s) => (
          <li key={s.idx} className={`pipeline-station${s.emit ? ' emit' : ''}`}>
            <div className="pipeline-idx">{s.idx}</div>
            <h3>{s.title}</h3>
            <div className="pipeline-en">{s.en}</div>
            <p>{s.desc}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
