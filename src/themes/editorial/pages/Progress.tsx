import { useMemo, useState } from 'react';
import type { Activity } from '@/types';
import { SiteFooter, StatStrip } from '../components/sections';
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

  // 再往前一个 12 个月窗口的月均（做 "vs 前一年" 对比，对齐参考站）
  const avg12Prev = useMemo(() => {
    const endCutoff = new Date(
      focus === thisYear ? thisYear - 1 : focus - 1,
      new Date().getMonth(),
      1
    );
    const startCutoff = new Date(endCutoff);
    startCutoff.setFullYear(endCutoff.getFullYear() - 1);
    const prev12 = activities.filter((a) => {
      const d = localDate(a);
      return d >= startCutoff && d < endCutoff;
    });
    return prev12.reduce((s, a) => s + activitySeconds(a) / 3600, 0) / 12;
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

  // 「我还在出现吗？」逐年出勤：活跃天 / 出勤周 / 最长连续 / 最长间隔
  const showup = useMemo(() => {
    const today = new Date();
    return years
      .slice()
      .sort((a, b) => b - a)
      .map((year) => {
        const acts = activities.filter((a) => activityYear(a) === year);
        const t = totalsOf(acts);
        const daysInYear =
          year === today.getFullYear()
            ? Math.floor(
                (today.getTime() - new Date(year, 0, 1).getTime()) / 86400000
              ) + 1
            : Math.round(
                (new Date(year + 1, 0, 1).getTime() -
                  new Date(year, 0, 1).getTime()) /
                  86400000
              );
        const weeks = new Set<string>();
        for (const a of acts) {
          const d = localDate(a);
          const monday = new Date(d);
          monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
          weeks.add(monday.toISOString().slice(0, 10));
        }
        const yearStart = new Date(year, 0, 1);
        const end = year === thisYear ? today : new Date(year, 11, 31);
        const weeksTotal = Math.max(
          1,
          Math.floor((end.getTime() - yearStart.getTime()) / (7 * 86400000)) + 1
        );
        const s = streaks(acts);
        return {
          year,
          activeDays: t.activeDays,
          daysInYear,
          weeksOn: weeks.size,
          weeksTotal,
          streak: s.longestStreak,
          gap: s.longestGap,
        };
      });
  }, [activities, years, thisYear]);

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
          <div className="ed-tabs" role="group" aria-label="聚焦年份">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                aria-pressed={y === focus}
                className={`ed-tab ${y === focus ? 'is-on' : ''}`}
                onClick={() => setFocus(y)}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <StatStrip
          label="今年累计"
          figure={36}
          min={170}
          tiles={[
            {
              label: '小时',
              value: Math.round(totals.hours),
              delta: (
                <>
                  {delta(totals.hours, prevTotals.hours)} · {dateNote}
                </>
              ),
            },
            {
              label: '次数',
              value: totals.sessions,
              delta: delta(totals.sessions, prevTotals.sessions),
            },
            {
              label: '活跃天',
              value: totals.activeDays,
              delta: delta(totals.activeDays, prevTotals.activeDays),
            },
            {
              label: '有运动的周',
              value: `${weeksInfo.withSession} / ${weeksInfo.totalWeeks}`,
              delta: `${Math.round((weeksInfo.withSession / weeksInfo.totalWeeks) * 100)}% 的周`,
            },
            {
              label: '最长连续',
              value: `${longestStreak} 天`,
              delta: `最长间隔 ${longestGap} 天`,
            },
            {
              label: '12 个月平均',
              value: `${avg12.toFixed(1)} h/月`,
              delta: avg12Prev > 0 ? delta(avg12, avg12Prev) : 'new',
            },
          ]}
        />
      </section>

      <section className="ed-section" aria-label="我做得更多吗">
        <div className="ed-chart-card">
          <div className="ed-card-head">
            <h2 className="ed-h2">我做得更多吗？</h2>
            <p className="ed-sub">
              开始以来的每个月小时数 · 白线为 12 个月滚动均值 ·
              聚焦年份全彩，往年变暗
            </p>
          </div>
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

      <section className="ed-section" aria-label="我还在出现吗">
        <div className="ed-chart-card">
          <div className="ed-card-head">
            <h2 className="ed-h2">我还在出现吗？</h2>
            <p className="ed-sub">坚持比强度重要 · 当前年份计到今天为止</p>
          </div>
          <div className="ed-showup-table" style={{ marginTop: 18 }}>
            <div className="ed-showup-head">
              <span>年份</span>
              <span>活跃天数</span>
              <span>出勤周数</span>
              <span>连续</span>
              <span>最长间隔</span>
            </div>
            {showup.map(
              ({
                year,
                activeDays,
                daysInYear,
                weeksOn,
                weeksTotal,
                streak,
                gap,
              }) => {
                const isFocus = year === focus;
                return (
                  <button
                    key={year}
                    className={`ed-showup-row ${isFocus ? 'is-focus' : ''}`}
                    style={{ color: 'inherit', font: 'inherit' }}
                    onClick={() => setFocus(year)}
                    aria-pressed={isFocus}
                  >
                    <span className="ed-showup-year">{year}</span>
                    <span className="ed-showup-barcell">
                      <span className="ed-showup-bar">
                        <i
                          style={{
                            width: `${(activeDays / daysInYear) * 100}%`,
                          }}
                        />
                      </span>
                      <span className="ed-showup-num">
                        {activeDays} / {daysInYear}
                      </span>
                    </span>
                    <span className="ed-showup-num">
                      {weeksOn} / {weeksTotal}
                    </span>
                    <span className="ed-showup-num">{streak} 天</span>
                    <span className="ed-showup-num">{gap} 天</span>
                  </button>
                );
              }
            )}
          </div>
        </div>
      </section>

      <section className="ed-section" aria-label="距离与配速">
        <div className="ed-chart-card">
          <div className="ed-card-head">
            <h2 className="ed-h2">我跑得怎么样？</h2>
            <p className="ed-sub">
              每次跑步的距离与平均配速 · 距离为对数刻度 ·
              聚焦年份为跑步行，往年是灰点 · 虚线为典型值
            </p>
          </div>
          <PaceScatterChart activities={activities} focusYear={focus} />
        </div>
        <p className="ed-chart-sub" style={{ marginTop: 16 }}>
          力量、攀岩这类运动没有配速信号，所以它们只计入上面的问题。诚实胜过取巧。
        </p>
      </section>

      <SiteFooter />
    </>
  );
}
