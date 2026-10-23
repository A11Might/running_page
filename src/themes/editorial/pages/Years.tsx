import { useMemo, useState } from 'react';
import type { Activity } from '@/types';
import {
  activitySeconds,
  activityYear,
  availableYears,
  bySport,
  formatInt,
  localDate,
  sportColor,
  sportOf,
  SPORTS,
  totalsOf,
} from '../lib/data';
import { YearToDateChart } from '../components/charts';
import { SportBar, SportLegend } from '../components/charts';

const fmtHm = (seconds: number): string => {
  const total = Math.round(seconds / 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export function Years({
  activities,
  navigate,
}: {
  activities: Activity[];
  navigate: (path: string) => void;
}) {
  const years = useMemo(() => availableYears(activities), [activities]);
  const thisYear = new Date().getFullYear();
  const [focus, setFocus] = useState<number>(
    years.includes(thisYear) ? thisYear : years[0]
  );

  const totals = useMemo(() => totalsOf(activities), [activities]);

  const focusActs = useMemo(
    () => activities.filter((a) => activityYear(a) === focus),
    [activities, focus]
  );
  const focusTotals = useMemo(() => totalsOf(focusActs), [focusActs]);
  const prevTotals = useMemo(
    () => totalsOf(activities.filter((a) => activityYear(a) === focus - 1)),
    [activities, focus]
  );
  // 与去年同期比较（进行中的年份）
  const prevSamePeriod = useMemo(() => {
    if (focus !== thisYear) return prevTotals;
    const now = new Date();
    const cutoff = new Date(focus - 1, now.getMonth(), now.getDate() + 1);
    return totalsOf(
      activities.filter((a) => {
        const d = localDate(a);
        return (
          d.getFullYear() === focus - 1 &&
          new Date(focus - 1, 0, 1) <= d &&
          d < cutoff
        );
      })
    );
  }, [activities, focus, prevTotals, thisYear]);

  const stats = useMemo(() => bySport(focusActs), [focusActs]);
  const mainSport = stats[0];

  const longest = useMemo(() => {
    if (!focusActs.length) return null;
    return focusActs.reduce((best, a) =>
      activitySeconds(a) > activitySeconds(best) ? a : best
    );
  }, [focusActs]);

  const busiestMonth = useMemo(() => {
    const byMonth = new Map<number, number>();
    for (const a of focusActs) {
      const m = localDate(a).getMonth();
      byMonth.set(m, (byMonth.get(m) ?? 0) + activitySeconds(a) / 3600);
    }
    let best: { month: number; hours: number } | null = null;
    for (const [month, hours] of byMonth) {
      if (!best || hours > best.hours) best = { month, hours };
    }
    return best;
  }, [focusActs]);

  const delta = (now: number, before: number): string => {
    if (before <= 0) return now > 0 ? 'new' : '—';
    const pct = Math.round(((now - before) / before) * 100);
    return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}%`;
  };

  const yearOverYear = useMemo(() => {
    const metrics = [
      {
        label: '小时',
        get: (t: ReturnType<typeof totalsOf>) => Math.round(t.hours),
      },
      { label: '次数', get: (t: ReturnType<typeof totalsOf>) => t.sessions },
      {
        label: '活跃天',
        get: (t: ReturnType<typeof totalsOf>) => t.activeDays,
      },
      {
        label: '公里',
        get: (t: ReturnType<typeof totalsOf>) => Math.round(t.km),
      },
      {
        label: '爬升 m',
        get: (t: ReturnType<typeof totalsOf>) => Math.round(t.climb),
      },
    ];
    const perYear = years
      .slice()
      .sort((a, b) => a - b)
      .map((y) => ({
        year: y,
        totals: totalsOf(activities.filter((a) => activityYear(a) === y)),
      }));
    return metrics.map((m) => ({
      label: m.label,
      values: perYear.map((p) => ({ year: p.year, value: m.get(p.totals) })),
    }));
  }, [activities, years]);

  return (
    <>
      <section className="ed-fade-up" aria-label="Years">
        <div
          className="ed-section-head"
          style={{ marginBottom: 0, alignItems: 'flex-end' }}
        >
          <h1
            className="ed-hero-title"
            style={{ fontSize: 'clamp(56px, 8vw, 112px)' }}
          >
            Years
          </h1>
          <div className="ed-pills" style={{ paddingBottom: 14 }}>
            {years.map((y) => (
              <button
                key={y}
                className={`ed-pill ${y === focus ? 'is-on' : ''}`}
                onClick={() => setFocus(y)}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <div className="ed-stats-row">
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{formatInt(totals.sessions)}</span>
            <span className="ed-stat-label">次数</span>
          </div>
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{formatInt(totals.hours)}</span>
            <span className="ed-stat-label">小时</span>
          </div>
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{formatInt(totals.activeDays)}</span>
            <span className="ed-stat-label">活跃天</span>
          </div>
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{formatInt(totals.km)}</span>
            <span className="ed-stat-label">公里</span>
          </div>
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{formatInt(totals.climb)}</span>
            <span className="ed-stat-label">累计爬升 m</span>
          </div>
          <div className="ed-stat-cell">
            <span className="ed-stat-num">
              {years.length} · {bySport(activities).length}
            </span>
            <span className="ed-stat-label">年 · 运动</span>
          </div>
        </div>
      </section>

      {/* 聚焦年份 */}
      <section className="ed-section" aria-label="年份聚焦">
        <div className="ed-focus-card">
          <div className="ed-focus-left">
            <span className="ed-focus-tag">聚焦年份</span>
            <p className="ed-focus-year">{focus}</p>
            <p className="ed-focus-note">
              对比 {focus - 1} 年{focus === thisYear ? '同期' : '全年'}
            </p>
          </div>
          <div>
            <div className="ed-focus-grid ed-focus-grid--row">
              <div className="ed-focus-stat">
                <span className="num">{Math.round(focusTotals.hours)}</span>
                <span className="label">小时</span>
                <span className="delta">
                  {delta(focusTotals.hours, prevSamePeriod.hours)}
                </span>
              </div>
              <div className="ed-focus-stat">
                <span className="num">{focusTotals.sessions}</span>
                <span className="label">次数</span>
                <span className="delta">
                  {delta(focusTotals.sessions, prevSamePeriod.sessions)}
                </span>
              </div>
              <div className="ed-focus-stat">
                <span className="num">{focusTotals.activeDays}</span>
                <span className="label">活跃天</span>
                <span className="delta">
                  {delta(focusTotals.activeDays, prevSamePeriod.activeDays)}
                </span>
              </div>
              <div className="ed-focus-stat">
                <span className="num">{formatInt(focusTotals.km)}</span>
                <span className="label">公里</span>
                <span className="delta">
                  {delta(focusTotals.km, prevSamePeriod.km)}
                </span>
              </div>
              <div className="ed-focus-stat">
                <span className="num">{formatInt(focusTotals.climb)}</span>
                <span className="label">爬升 m</span>
                <span className="delta">
                  {delta(focusTotals.climb, prevSamePeriod.climb)}
                </span>
              </div>
            </div>

            <div className="ed-focus-facts">
              {mainSport && (
                <div className="ed-focus-fact">
                  <span className="label">主要运动</span>
                  <div className="value">
                    <span
                      className="ed-dot"
                      style={{ background: sportColor(mainSport.sport) }}
                    />
                    {SPORTS[mainSport.sport].zh}
                  </div>
                  <div className="sub">
                    {Math.round(mainSport.hours)} h ·{' '}
                    {focusTotals.hours
                      ? Math.round((mainSport.hours / focusTotals.hours) * 100)
                      : 0}
                    % 的时间
                  </div>
                </div>
              )}
              {longest && (
                <div className="ed-focus-fact">
                  <span className="label">最长的一次</span>
                  <div
                    className="value"
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {longest.name || SPORTS[sportOf(longest)].zh}
                  </div>
                  <div className="sub">
                    {fmtHm(activitySeconds(longest))} ·{' '}
                    {localDate(longest).toLocaleDateString('zh-CN')} ·{' '}
                    {SPORTS[sportOf(longest)].zh}
                  </div>
                </div>
              )}
              {busiestMonth && (
                <div className="ed-focus-fact">
                  <span className="label">最忙的月份</span>
                  <div className="value">{busiestMonth.month + 1} 月</div>
                  <div className="sub">{Math.round(busiestMonth.hours)} h</div>
                </div>
              )}
            </div>

            <div className="ed-focus-bottom">
              <div className="ed-focus-bargroup">
                <SportBar activities={focusActs} />
                <SportLegend activities={focusActs} />
              </div>
              <button
                className="ed-btn ed-btn--outline"
                onClick={() => navigate('calendar')}
              >
                打开日历 →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 年初至今 */}
      <section className="ed-section" aria-label="年初至今">
        <div className="ed-chart-card">
          <h3 className="ed-chart-title">年初至今</h3>
          <p className="ed-chart-sub">
            自 1 月 1 日起的累计小时 · 聚焦年份为白色
          </p>
          <YearToDateChart activities={activities} focusYear={focus} />
        </div>
      </section>

      {/* 逐年对比 */}
      <section className="ed-section" aria-label="逐年对比">
        <div className="ed-section-head">
          <h2 className="ed-section-title">逐年对比</h2>
          <span className="ed-section-note">白色为聚焦年份</span>
        </div>
        <div className="ed-best-grid">
          {yearOverYear.map((metric) => {
            const max = Math.max(...metric.values.map((v) => v.value), 1);
            return (
              <div
                key={metric.label}
                className="ed-chart-card"
                style={{ padding: 18 }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span
                    className="ed-focus-tag"
                    style={{ textTransform: 'none', letterSpacing: '0.1em' }}
                  >
                    {metric.label}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 17 }}>
                    {metric.values.find((v) => v.year === focus)?.value ?? 0}{' '}
                    <span
                      style={{
                        fontSize: 12,
                        color: '#8c8b85',
                        fontWeight: 500,
                      }}
                    >
                      {focus}
                    </span>
                  </span>
                </div>
                <svg
                  viewBox="0 0 220 120"
                  className="ed-chart-svg"
                  style={{ marginTop: 12 }}
                  role="img"
                  aria-label={`${metric.label}逐年对比`}
                >
                  {metric.values.map(({ year, value }) => {
                    const slot = 220 / metric.values.length;
                    const cx =
                      slot * metric.values.findIndex((v) => v.year === year) +
                      slot / 2;
                    const barW = Math.min(slot * 0.5, 22);
                    const h = Math.max((value / max) * 96, 2);
                    const isFocus = year === focus;
                    return (
                      <g key={year}>
                        <rect
                          x={cx - barW / 2}
                          y={104 - h}
                          width={barW}
                          height={h}
                          rx={2}
                          fill={isFocus ? '#f0efec' : '#3a3b40'}
                        />
                        <text
                          x={cx}
                          y={104 - h - 5}
                          textAnchor="middle"
                          fontSize={8.5}
                          fill={isFocus ? '#f0efec' : '#55565c'}
                          fontWeight={isFocus ? 700 : 400}
                        >
                          {formatInt(value)}
                        </text>
                        <text
                          x={cx}
                          y={116}
                          textAnchor="middle"
                          fontSize={8.5}
                          fill="#55565c"
                        >
                          {String(year).slice(2)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
