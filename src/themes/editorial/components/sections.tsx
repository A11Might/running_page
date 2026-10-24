import type { ReactNode } from 'react';

/**
 * 页脚推荐模块 —— 结构对齐参考站 "MORE FROM GEEKPLUX"：
 * 上边线 + 眉标 + 项目卡片网格 + 社交链接。
 * 链接按本站实际情况配置（参考站是作者本人的项目）。
 */
const SITES: { name: string; note: string; href: string }[] = [
  {
    name: 'GitHub ↗',
    note: '本站的源码仓库（running_page）',
    href: 'https://github.com/A11Might/running_page',
  },
  {
    name: 'Strava ↗',
    note: '数据来源，我的运动主页',
    href: 'https://www.strava.com/athletes/a11might',
  },
];

const SOCIAL: { name: string; href: string }[] = [
  { name: 'Strava ↗', href: 'https://www.strava.com/athletes/a11might' },
  { name: 'GitHub ↗', href: 'https://github.com/A11Might' },
];

export function SiteFooter() {
  return (
    <footer className="ed-site-footer">
      <div className="head">
        <h2 className="label">更多</h2>
        <span className="since">数据来自 Strava · 用 running_page 构建</span>
      </div>
      <ul className="sites">
        {SITES.map((s) => (
          <li key={s.href}>
            <a href={s.href} target="_blank" rel="noreferrer">
              <span className="name">{s.name}</span>
              <span className="note">{s.note}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="social">
        {SOCIAL.map((s) => (
          <a key={s.href} href={s.href} target="_blank" rel="noreferrer">
            {s.name}
          </a>
        ))}
      </div>
    </footer>
  );
}

/** 统计格 —— 参考站 stat tile：mono 标签 / 大数字 / 变化行 */
export function StatTile({
  label,
  value,
  delta,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
}) {
  return (
    <div className="ed-stat-tile">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {delta != null && <dd className="delta">{delta}</dd>}
    </div>
  );
}

/** 变化行："▲ 38% 对比去年" / "新增"（参考站 delta 组件） */
export function Delta({
  now,
  before,
  suffix = '对比去年',
}: {
  now: number;
  before: number;
  suffix?: string;
}) {
  if (before <= 0)
    return <span>{now > 0 ? '新增' : '—'}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  return (
    <span>
      {pct >= 0 ? '▲' : '▼'} {Math.abs(pct)}% {suffix}
    </span>
  );
}
