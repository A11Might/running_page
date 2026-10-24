import type { ReactNode } from 'react';
import type { Activity } from '@/types';
import {
  activitySeconds,
  sportColor,
  sportOf,
  SPORTS,
  type SportKey,
} from '../lib/data';

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

/**
 * 按运动的小时占比条（参考站 1qwcl）：
 * 8px 高堆叠条（段宽 = 小时 flex）+ mono 图例「运动 N h」
 */
export function SportMixBar({ activities }: { activities: Activity[] }) {
  const tally = new Map<SportKey, number>();
  let total = 0;
  for (const a of activities) {
    const s = sportOf(a);
    const h = activitySeconds(a) / 3600;
    tally.set(s, (tally.get(s) ?? 0) + h);
    total += h;
  }
  const segs = [...tally.entries()].sort((x, y) => y[1] - x[1]);
  if (!segs.length) return null;
  void total;
  const aria = `${new Date().getFullYear()} 年按运动的小时：${segs
    .map(([s, h]) => `${SPORTS[s].zh} ${Math.round(h)} h`)
    .join('，')}`;
  return (
    <div className="ed-mixbar-wrap">
      <div className="ed-mixbar" role="img" aria-label={aria}>
        {segs.map(([s, h]) => (
          <span
            key={s}
            className="seg"
            title={`${SPORTS[s].zh} ${Math.round(h)} h`}
            style={{
              flex: `${h.toFixed(3)} 1 0`,
              background: sportColor(s),
            }}
          />
        ))}
      </div>
      <ul className="ed-mixbar-legend" aria-hidden>
        {segs.map(([s, h]) => (
          <li key={s}>
            <span
              className="ed-dot"
              style={{ background: sportColor(s) }}
            />
            {SPORTS[s].zh} {Math.round(h)} h
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 胶囊链接（参考站 pill：细边框圆角、hover 边框加深） */
export function PillLink({
  href,
  children,
  onClick,
}: {
  href?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const cls = 'ed-pill-link';
  if (href) {
    return (
      <a
        className={cls}
        href={href}
        onClick={(e) => {
          if (onClick) {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * 响应式统计条（参考站 stat strip）：
 * 一行 N 格，空间不足时自动换行；figure 大小可调。
 */
export function StatStrip({
  tiles,
  figure = 40,
  min = 170,
  label,
}: {
  tiles: { label: string; value: ReactNode; delta?: ReactNode }[];
  figure?: number;
  min?: number;
  label?: string;
}) {
  return (
    <dl
      className="ed-stat-strip"
      aria-label={label}
      style={{
        ['--stat-min' as string]: `${min}px`,
        ['--stat-fig' as string]: `${figure}px`,
      }}
    >
      {tiles.map((t) => (
        <div key={t.label} className="ed-stat-tile">
          <dt>{t.label}</dt>
          <dd>{t.value}</dd>
          {t.delta != null && <dd className="delta">{t.delta}</dd>}
        </div>
      ))}
    </dl>
  );
}
