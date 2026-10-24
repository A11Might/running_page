import { useMemo, useState } from 'react';
import type { Activity } from '@/types';
import {
  activityKm,
  activitySeconds,
  activityYear,
  availableYears,
  bySport,
  formatInt,
  localDate,
  samePeriodOf,
  sportColor,
  sportOf,
  SPORTS,
  totalsOf,
  type SportKey,
} from '../lib/data';
import { sortedByDate } from '../lib/track';
import { RouteThumb, SessionGlyph } from '../components/SessionTile';
import { SportBar, SportLegend } from '../components/charts';

const zhDate = (d: Date) =>
  `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;

export function Home({
  activities,
  navigate,
}: {
  activities: Activity[];
  navigate: (path: string) => void;
}) {
  const allYears = useMemo(() => availableYears(activities), [activities]);
  const thisYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<number | 'all'>(
    allYears.includes(thisYear) ? thisYear : 'all'
  );
  const [sportFilter, setSportFilter] = useState<SportKey | 'all'>('all');
  const [tileSize, setTileSize] = useState(84);
  const [glow, setGlow] = useState(true);

  const totals = useMemo(() => totalsOf(activities), [activities]);
  const years = allYears;

  // 今年至今 vs 去年同期
  const thisPeriod = useMemo(
    () => samePeriodOf(activities, thisYear),
    [activities, thisYear]
  );
  const lastPeriod = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(
      now.getFullYear() - 1,
      now.getMonth(),
      now.getDate() + 1
    );
    return activities.filter((a) => {
      const d = localDate(a);
      return (
        d.getFullYear() === thisYear - 1 &&
        new Date(thisYear - 1, 0, 1) <= d &&
        d < cutoff
      );
    });
  }, [activities, thisYear]);
  const thisTotals = useMemo(() => totalsOf(thisPeriod), [thisPeriod]);
  const lastTotals = useMemo(() => totalsOf(lastPeriod), [lastPeriod]);
  const lastSportCount = useMemo(
    () => new Set(lastPeriod.map((a) => sportOf(a))).size,
    [lastPeriod]
  );

  const latest = useMemo(
    () => sortedByDate(activities).slice(-3).reverse(),
    [activities]
  );

  const sportStats = useMemo(() => bySport(activities), [activities]);
  const sportCounts = useMemo(() => {
    const map = new Map<SportKey, number>();
    for (const a of activities) {
      const s = sportOf(a);
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    return map;
  }, [activities]);

  const gridActivities = useMemo(() => {
    let list = sortedByDate(activities);
    if (yearFilter !== 'all')
      list = list.filter((a) => activityYear(a) === yearFilter);
    if (sportFilter !== 'all')
      list = list.filter((a) => sportOf(a) === sportFilter);
    return list.reverse(); // 最新在前
  }, [activities, yearFilter, sportFilter]);

  const gridHours = useMemo(
    () => gridActivities.reduce((s, a) => s + activitySeconds(a) / 3600, 0),
    [gridActivities]
  );

  const delta = (now: number, before: number): string | null => {
    if (before <= 0) return now > 0 ? 'new' : null;
    const pct = Math.round(((now - before) / before) * 100);
    return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs 去年同期`;
  };

  const yearHeadingLabel =
    yearFilter === 'all'
      ? `${years[years.length - 1]}–${years[0]}`
      : String(yearFilter);

  return (
    <>
      {/* Hero */}
      <section className="ed-fade-up" aria-label="Activities">
        <p className="ed-kicker">
          {years[years.length - 1]} — {years[0]} · {totals.sessions} 次 ·{' '}
          {sportStats.length} 种运动
        </p>
        <h1 className="ed-hero-title">Activities</h1>
        <p className="ed-hero-sub">
          每一次运动，都留下它自己的形状。有 GPS 的记录画出轨迹轮廓；
          没有轨迹的，画成一枚会话时钟——外圈是时长，圆心是心跳。
        </p>
        <div className="ed-stats-row">
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{formatInt(totals.sessions)}</span>
            <span className="ed-stat-label">次数</span>
          </div>
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{formatInt(totals.km)}</span>
            <span className="ed-stat-label">公里</span>
          </div>
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{formatInt(totals.hours)}</span>
            <span className="ed-stat-label">小时</span>
          </div>
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{formatInt(totals.climb)}</span>
            <span className="ed-stat-label">累计爬升 m</span>
          </div>
        </div>
      </section>

      {/* 今年至今 */}
      {thisTotals.sessions > 0 && (
        <section className="ed-section" aria-label="今年至今">
          <div className="ed-focus-card">
            <div className="ed-focus-left">
              <span className="ed-focus-tag">今年至今</span>
              <p className="ed-focus-year">{thisYear}</p>
              <p className="ed-focus-note">
                对比 {thisYear - 1} 年同期
                <br />
                （1 月 1 日 – {new Date().getMonth() + 1} 月{' '}
                {new Date().getDate()} 日）
              </p>
            </div>
            <div className="ed-focus-grid">
              <div className="ed-focus-stat">
                <span className="num">{Math.round(thisTotals.hours)}</span>
                <span className="label">小时</span>
                {lastTotals.hours > 0 && (
                  <span className="delta">
                    {delta(thisTotals.hours, lastTotals.hours)}
                  </span>
                )}
              </div>
              <div className="ed-focus-stat">
                <span className="num">{thisTotals.sessions}</span>
                <span className="label">次数</span>
                {lastTotals.sessions > 0 && (
                  <span className="delta">
                    {delta(thisTotals.sessions, lastTotals.sessions)}
                  </span>
                )}
              </div>
              <div className="ed-focus-stat">
                <span className="num">{thisTotals.activeDays}</span>
                <span className="label">活跃天</span>
                {lastTotals.activeDays > 0 && (
                  <span className="delta">
                    {delta(thisTotals.activeDays, lastTotals.activeDays)}
                  </span>
                )}
              </div>
              <div className="ed-focus-stat">
                <span className="num">
                  {new Set(thisPeriod.map((a) => sportOf(a))).size}
                </span>
                <span className="label">种运动</span>
                {lastSportCount > 0 && (
                  <span className="delta">
                    {delta(
                      new Set(thisPeriod.map((a) => sportOf(a))).size,
                      lastSportCount
                    )}
                  </span>
                )}
              </div>
            </div>
            <div className="ed-focus-bottom">
              <div className="ed-focus-bargroup">
                <SportBar activities={thisPeriod} />
                <SportLegend activities={thisPeriod} />
              </div>
              <button
                className="ed-btn ed-btn--outline"
                onClick={() => navigate('years')}
              >
                对比历年 →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Latest */}
      <section className="ed-section" aria-label="最近">
        <div className="ed-section-head">
          <h2 className="ed-section-title">最近</h2>
          <span className="ed-section-note">
            最近导入：
            {latest.length ? latest[0].start_date_local.slice(0, 10) : '—'}
          </span>
        </div>
        <div className="ed-latest-grid">
          {latest.map((a) => {
            const sport = sportOf(a);
            const bits = [
              `${activityKm(a.distance).toFixed(a.distance % 1000 ? 1 : 0)} km`,
              `${Math.floor(activitySeconds(a) / 3600)}:${String(
                Math.floor((activitySeconds(a) % 3600) / 60)
              ).padStart(2, '0')}`,
            ];
            if (a.average_heartrate)
              bits.push(`${Math.round(a.average_heartrate)} bpm`);
            return (
              <button
                key={a.run_id}
                className="ed-latest-card"
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'inherit',
                  font: 'inherit',
                }}
                onClick={() => navigate(`a/${a.run_id}`)}
              >
                <span className="thumb">
                  <RouteThumb activity={a} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="tag">
                    <span
                      className="ed-dot"
                      style={{ background: sportColor(sport) }}
                    />
                    {SPORTS[sport].en}
                  </span>
                  <span
                    className="name"
                    style={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.name || SPORTS[sport].zh}
                  </span>
                  <span className="meta" style={{ display: 'block' }}>
                    {zhDate(localDate(a))} · {bits.join(' · ')}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Every session */}
      <section className="ed-section" aria-label="每一次运动">
        <div className="ed-section-head">
          <h2 className="ed-section-title">每一次运动</h2>
          <span className="ed-section-note">
            {yearHeadingLabel} · {gridActivities.length} 次 ·{' '}
            {gridHours.toFixed(0)} h
          </span>
        </div>

        <div className="ed-pills" role="group" aria-label="按年份筛选">
          <button
            className={`ed-pill ${yearFilter === 'all' ? 'is-on' : ''}`}
            onClick={() => setYearFilter('all')}
          >
            全部年份
          </button>
          {years.map((y) => (
            <button
              key={y}
              className={`ed-pill ${yearFilter === y ? 'is-on' : ''}`}
              onClick={() => setYearFilter(y)}
            >
              {y}
            </button>
          ))}
        </div>

        <div
          className="ed-pills"
          style={{ marginTop: 10 }}
          role="group"
          aria-label="按运动筛选"
        >
          <button
            className={`ed-pill ${sportFilter === 'all' ? 'is-on' : ''}`}
            onClick={() => setSportFilter('all')}
          >
            全部运动
            <span className="count">{activities.length}</span>
          </button>
          {sportStats.map(({ sport }) => (
            <button
              key={sport}
              className={`ed-pill ${sportFilter === sport ? 'is-on' : ''}`}
              onClick={() =>
                setSportFilter(sportFilter === sport ? 'all' : sport)
              }
            >
              <span
                className="ed-dot"
                style={{ background: sportColor(sport) }}
              />
              {SPORTS[sport].zh}
              <span className="count">{sportCounts.get(sport) ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="ed-controls">
          <label className="ed-control">
            图块大小
            <input
              type="range"
              className="ed-slider"
              min={52}
              max={132}
              value={tileSize}
              onChange={(e) => setTileSize(+e.target.value)}
              style={{
                ['--slider-fill' as string]: `${((tileSize - 52) / 80) * 100}%`,
              }}
            />
            {tileSize} px
          </label>
          <span className="ed-control">
            <button
              className={`ed-switch ${glow ? 'is-on' : ''}`}
              role="switch"
              aria-checked={glow}
              aria-label="发光"
              onClick={() => setGlow((v) => !v)}
            />
            发光
          </span>
        </div>

        <div className="ed-glyph-legend">
          {/* 图例图标直接取自参考站原版 SVG（28×28，muted 灰，起点点用主墨色） */}
          <div className="row">
            <svg className="glyph-example" viewBox="0 0 28 28" aria-hidden="true">
              <path
                d="M5 21C8 12 11 9 14 12C17 15 19 18 23 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="5" cy="21" r="2" fill="var(--ink)" />
            </svg>
            <span className="text">
              <span className="term">路线形状</span> 有 GPS
              的会话，画出轨迹留下的形状（点是起点）。
            </span>
          </div>
          <div className="row">
            <svg className="glyph-example" viewBox="0 0 28 28" aria-hidden="true">
              <circle
                cx="14"
                cy="14"
                r="11"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray="2.6 1"
                strokeLinecap="butt"
                opacity="0.6"
              />
              <circle
                cx="14"
                cy="14"
                r="5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.9"
              />
              <circle
                cx="14"
                cy="14"
                r="2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.9"
              />
            </svg>
            <span className="text">
              <span className="term">会话时钟</span> 没有 GPS
              的会话：一圈是整场活动，柱越高越亮 = 心率越高，内曲线是心率。
            </span>
          </div>
        </div>

        {years.map((y) => {
          const yearActs =
            yearFilter === 'all'
              ? gridActivities.filter((a) => activityYear(a) === y)
              : gridActivities;
          if (yearFilter === 'all' && !yearActs.length) return null;
          if (yearFilter !== 'all' && y !== yearFilter) return null;
          const hours = yearActs.reduce(
            (s, a) => s + activitySeconds(a) / 3600,
            0
          );
          return (
            <div key={y}>
              <div className="ed-year-heading">
                <span className="year">{y}</span>
                <span className="meta">
                  {yearActs.length} 次 · {Math.round(hours)} h
                </span>
              </div>
              <div
                className="ed-tile-grid"
                style={{ ['--tile' as string]: `${tileSize}px` }}
              >
                {yearActs.map((a) => (
                  <button
                    key={a.run_id}
                    className="ed-tile"
                    onClick={() => navigate(`a/${a.run_id}`)}
                    title={`${localDate(a).toLocaleDateString('zh-CN')} · ${a.name || SPORTS[sportOf(a)].zh}`}
                  >
                    <SessionGlyph activity={a} glow={glow} />
                    <span className="date">
                      {a.start_date_local.slice(2, 10).replace(/-/g, '.')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
