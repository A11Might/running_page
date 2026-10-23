import { useMemo, useState } from 'react';
import type { Activity } from '@/types';
import {
  activitySeconds,
  activityYear,
  availableYears,
  localDate,
  samePeriodOf,
  SPORTS,
  streaks,
  totalsOf,
  type SportKey,
} from '../lib/data';
import { MonthlyBarsChart, PaceScatterChart } from '../components/charts';
import { sportColor, sportOf } from '../lib/data';

export function Progress({ activities }: { activities: Activity[] }) {
  const years = useMemo(() => availableYears(activities), [activities]);
  const thisYear = new Date().getFullYear();
  const [focus, setFocus] = useState<number>(
    years.includes(thisYear) ? thisYear : years[0]
  );

  const period = useMemo(
    () =>
      focus === thisYear
        ? samePeriodOf(activities, focus)
        : activities.filter((a) => activityYear(a) === focus),
    [activities, focus, thisYear]
  );
  const prevPeriod = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(focus - 1, now.getMonth(), now.getDate() + 1);
    return activities.filter((a) => {
      const d = localDate(a);
      return (
        d.getFullYear() === focus - 1 &&
        new Date(focus - 1, 0, 1) <= d &&
        d < cutoff
      );
    });
  }, [activities, focus]);

  const totals = useMemo(() => totalsOf(period), [period]);
  const prevTotals = useMemo(() => totalsOf(prevPeriod), [prevPeriod]);
  const { longestStreak, longestGap } = useMemo(
    () => streaks(period),
    [period]
  );

  // 近 12 个月月均
  const avg12 = useMemo(() => {
    const cutoff = new Date(
      focus === thisYear ? thisYear - 1 : focus - 1,
      new Date().getMonth(),
      1
    );
    const last12 = activities.filter((a) => {
      const d = localDate(a);
      return focus === thisYear ? d >= cutoff : d.getFullYear() === focus;
    });
    const hours = last12.reduce((s, a) => s + activitySeconds(a) / 3600, 0);
    const months = focus === thisYear ? 12 : 12;
    return hours / months;
  }, [activities, focus, thisYear]);

  // 有记录的周数
  const weeksInfo = useMemo(() => {
    const weeks = new Set<string>();
    for (const a of period) {
      const d = localDate(a);
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      weeks.add(monday.toISOString().slice(0, 10));
    }
    const yearStart = new Date(focus, 0, 1);
    const now = focus === thisYear ? new Date() : new Date(focus, 11, 31);
    const totalWeeks = Math.max(
      1,
      Math.floor((now.getTime() - yearStart.getTime()) / (7 * 86400000)) + 1
    );
    return { withSession: weeks.size, totalWeeks };
  }, [period, focus, thisYear]);

  const delta = (now: number, before: number): string => {
    if (before <= 0) return now > 0 ? 'new' : '—';
    const pct = Math.round(((now - before) / before) * 100);
    return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs ${focus - 1}`;
  };

  const sportsInBars = useMemo(() => {
    const set = new Set<SportKey>();
    for (const a of activities) set.add(sportOf(a));
    return [...set];
  }, [activities]);

  const dateNote =
    focus === thisYear
      ? `截至 ${new Date().getMonth() + 1} 月 ${new Date().getDate()} 日`
      : '全年';

  return (
    <>
      <section className="ed-fade-up" aria-label="Progress">
        <div
          className="ed-section-head"
          style={{ marginBottom: 0, alignItems: 'flex-end' }}
        >
          <div style={{ paddingBottom: 10 }}>
            <h1
              className="ed-hero-title"
              style={{ fontSize: 'clamp(56px, 8vw, 112px)' }}
            >
              Progress
            </h1>
            <p className="ed-hero-sub" style={{ fontSize: 16, marginTop: 14 }}>
              真正让人坚持下来的问题：我比一年前做得更多吗？我还在出现吗。
              这里不需要实验室，一切都来自手表。
            </p>
          </div>
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
            <span className="ed-stat-num">{Math.round(totals.hours)}</span>
            <span className="ed-stat-label">小时</span>
            <span className="ed-stat-delta">
              <span className="up">
                {delta(totals.hours, prevTotals.hours)}
              </span>
              <br />
              {dateNote}
            </span>
          </div>
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{totals.sessions}</span>
            <span className="ed-stat-label">次数</span>
            <span className="ed-stat-delta">
              <span className="up">
                {delta(totals.sessions, prevTotals.sessions)}
              </span>
            </span>
          </div>
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{totals.activeDays}</span>
            <span className="ed-stat-label">活跃天</span>
            <span className="ed-stat-delta">
              <span className="up">
                {delta(totals.activeDays, prevTotals.activeDays)}
              </span>
            </span>
          </div>
          <div className="ed-stat-cell">
            <span className="ed-stat-num">
              {weeksInfo.withSession} / {weeksInfo.totalWeeks}
            </span>
            <span className="ed-stat-label">有运动的周</span>
            <span className="ed-stat-delta">
              {Math.round((weeksInfo.withSession / weeksInfo.totalWeeks) * 100)}
              % 的周
            </span>
          </div>
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{longestStreak} 天</span>
            <span className="ed-stat-label">最长连续</span>
            <span className="ed-stat-delta">最长间隔 {longestGap} 天</span>
          </div>
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{avg12.toFixed(1)} h/月</span>
            <span className="ed-stat-label">12 个月平均</span>
          </div>
        </div>
      </section>

      <section className="ed-section" aria-label="我做得更多吗">
        <div className="ed-chart-card">
          <h3 className="ed-chart-title">我做得更多吗？</h3>
          <p className="ed-chart-sub">
            开始以来的每个月小时数 · 白线为 12 个月滚动均值 ·
            聚焦年份全彩，往年变暗
          </p>
          <div className="ed-legend" style={{ marginTop: 14 }}>
            {sportsInBars.map((s) => (
              <span key={s}>
                <span className="dot" style={{ background: sportColor(s) }} />
                {SPORTS[s].zh}
              </span>
            ))}
            <span>
              <span
                className="dot"
                style={{
                  background: 'transparent',
                  border: '1.5px solid #f0efec',
                  width: 6,
                  height: 6,
                  verticalAlign: 2,
                }}
              />
              12 个月均值
            </span>
          </div>
          <MonthlyBarsChart activities={activities} focusYear={focus} />
        </div>
      </section>

      <section className="ed-section" aria-label="距离与配速">
        <div className="ed-chart-card">
          <h3 className="ed-chart-title">我跑得怎么样？</h3>
          <p className="ed-chart-sub">
            每次跑步的距离与平均配速 · 距离为对数刻度 ·
            聚焦年份为跑步行，往年是灰点 · 虚线为典型值
          </p>
          <PaceScatterChart activities={activities} focusYear={focus} />
          <p className="ed-chart-sub" style={{ marginTop: 16 }}>
            力量、攀岩这类运动没有配速信号，所以它们只计入上面的问题。诚实胜过取巧。
          </p>
        </div>
      </section>
    </>
  );
}
