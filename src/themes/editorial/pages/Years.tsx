import { useMemo, useState } from 'react';
import type { Activity } from '@/types';
import {
  activitySeconds,
  activityYear,
  availableYears,
  formatInt,
  localDate,
  sportColor,
  sportOf,
  SPORTS,
  totalsOf,
  type SportKey,
} from '../lib/data';
import { YearToDateChart } from '../components/charts';
import { Delta, SiteFooter, StatTile } from '../components/sections';

/** 运动固定顺序（参考站常量表顺序） */
const SPORT_ORDER: SportKey[] = [
  'swim',
  'run',
  'ride',
  'hike',
  'climb',
  'tennis',
  'strength',
  'other',
];

interface Totals {
  sessions: number;
  activeDays: number;
  hours: number;
  km: number;
  climb: number;
}

const METRICS: {
  key: keyof Totals;
  label: string;
  fmt: (t: Totals) => number;
}[] = [
  { key: 'hours', label: '小时', fmt: (t) => Math.round(t.hours) },
  { key: 'sessions', label: '次数', fmt: (t) => t.sessions },
  { key: 'activeDays', label: '活跃天', fmt: (t) => t.activeDays },
  { key: 'km', label: '公里', fmt: (t) => Math.round(t.km) },
  { key: 'climb', label: '爬升 m', fmt: (t) => Math.round(t.climb) },
];

export function Years({
  activities,
  navigate,
}: {
  activities: Activity[];
  navigate: (path: string) => void;
}) {
  const years = useMemo(
    () => availableYears(activities).slice().sort((a, b) => a - b),
    [activities]
  );
  const thisYear = new Date().getFullYear();
  const [focus, setFocus] = useState<number>(
    years.includes(thisYear) ? thisYear : years[years.length - 1]
  );
  void navigate;

  // 每年全年总量
  const perYearTotals = useMemo(() => {
    const m = new Map<number, Totals>();
    for (const y of years) {
      m.set(
        y,
        totalsOf(activities.filter((a) => activityYear(a) === y))
      );
    }
    return m;
  }, [activities, years]);

  const focusTotals = perYearTotals.get(focus) ?? totalsOf([]);
  // 对比基线：进行中的年份取去年同期，否则取上一年全年
  const baseTotals = useMemo(() => {
    if (focus === thisYear) {
      const now = new Date();
      const cutoff = new Date(thisYear - 1, now.getMonth(), now.getDate() + 1);
      return totalsOf(
        activities.filter((a) => {
          const d = localDate(a);
          return (
            d.getFullYear() === thisYear - 1 &&
            new Date(thisYear - 1, 0, 1) <= d &&
            d < cutoff
          );
        })
      );
    }
    return perYearTotals.get(focus - 1) ?? totalsOf([]);
  }, [activities, focus, perYearTotals, thisYear]);

  const mainSport = useMemo(() => {
    const tally = new Map<SportKey, number>();
    for (const a of activities) {
      if (activityYear(a) !== focus) continue;
      const s = sportOf(a);
      tally.set(s, (tally.get(s) ?? 0) + activitySeconds(a) / 3600);
    }
    let best: SportKey | null = null;
    for (const [s, h] of tally) {
      if (!best || h > (tally.get(best) ?? 0)) best = s;
    }
    return best ? { sport: best, hours: tally.get(best)! } : null;
  }, [activities, focus]);

  // 年初至今：每年截至今天的累计小时（做副标题行）
  const ytdLine = useMemo(() => {
    const now = new Date();
    const parts = years.map((y) => {
      const upto =
        y === thisYear
          ? activities.filter((a) => {
              const d = localDate(a);
              return (
                d.getFullYear() === y &&
                (d.getMonth() < now.getMonth() ||
                  (d.getMonth() === now.getMonth() && d.getDate() <= now.getDate()))
              );
            })
          : activities.filter((a) => activityYear(a) === y);
      const h = Math.round(
        upto.reduce((s, a) => s + activitySeconds(a) / 3600, 0)
      );
      return `${y} ${h} h`;
    });
    const md = `${now.getMonth() + 1} 月 ${now.getDate()} 日`;
    return `截至 ${md} — ${parts.join(' · ')}`;
  }, [activities, years, thisYear]);

  // 每年 × 每运动 的小时矩阵 + 各年合计 + 各运动最大值
  const matrix = useMemo(() => {
    const cell = new Map<string, number>(); // `${sport}|${year}` → hours
    const sportHours = new Map<SportKey, number>();
    const yearTotals = new Map<number, number>();
    const present = new Set<SportKey>();
    for (const a of activities) {
      const s = sportOf(a);
      const y = activityYear(a);
      const h = activitySeconds(a) / 3600;
      cell.set(`${s}|${y}`, (cell.get(`${s}|${y}`) ?? 0) + h);
      sportHours.set(s, (sportHours.get(s) ?? 0) + h);
      yearTotals.set(y, (yearTotals.get(y) ?? 0) + h);
      present.add(s);
    }
    const maxCell = Math.max(...cell.values(), 0.01);
    const maxYear = Math.max(...yearTotals.values(), 0.01);
    return {
      cell,
      sportHours,
      yearTotals,
      present,
      sports: SPORT_ORDER.filter((s) => present.has(s)),
      maxCell,
      maxYear,
    };
  }, [activities]);

  // 每年构成（share 行）
  const shareRows = useMemo(() => {
    return years
      .slice()
      .reverse()
      .map((y) => {
        const tally = new Map<SportKey, number>();
        let total = 0;
        for (const a of activities) {
          if (activityYear(a) !== y) continue;
          const s = sportOf(a);
          const h = activitySeconds(a) / 3600;
          tally.set(s, (tally.get(s) ?? 0) + h);
          total += h;
        }
        const segs = matrix.sports
          .map((s) => ({ sport: s, h: tally.get(s) ?? 0 }))
          .filter((x) => x.h > 0);
        const tip = `${y} · ${Math.round(total)} h · ${segs
          .map(
            (x) =>
              `${SPORTS[x.sport].zh} ${Math.round(x.h)} h (${total ? Math.round((x.h / total) * 100) : 0}%)`
          )
          .join('，')}`;
        return { year: y, segs, total, tip };
      })
      .filter((r) => r.total > 0);
  }, [activities, years, matrix.sports]);

  const [shareReadout, setShareReadout] = useState<string>(
    '悬停色块查看构成'
  );
  const compareNote =
    focus === thisYear
      ? `对比 ${focus - 1} 年同期（1 月 1 日 – ${new Date().getMonth() + 1} 月 ${new Date().getDate()} 日）`
      : `对比 ${focus - 1} 年全年`;

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
      </section>

      {/* ── 聚焦年份（YEAR IN FOCUS：大字年份 + 指标格）────────────── */}
      <section className="ed-section" aria-label="年份聚焦">
        <div className="ed-focus-card2">
          <div className="year-block">
            <span className="eyebrow">聚焦年份</span>
            <span className="big-year">{focus}</span>
            <span className="compare">{compareNote}</span>
          </div>
          <div className="focus-body">
            <dl className="focus-facts">
              {METRICS.map((m) => (
                <StatTile
                  key={m.key}
                  label={m.label}
                  value={formatInt(m.fmt(focusTotals))}
                  delta={
                    <Delta
                      now={m.fmt(focusTotals)}
                      before={m.fmt(baseTotals)}
                    />
                  }
                />
              ))}
              {mainSport && (
                <StatTile
                  label="主要运动"
                  value={
                    <span className="sport-value">
                      <span
                        className="ed-dot"
                        style={{ background: sportColor(mainSport.sport) }}
                      />
                      {SPORTS[mainSport.sport].zh}
                    </span>
                  }
                  delta={
                    <span>
                      {Math.round(mainSport.hours)} h ·{' '}
                      {focusTotals.hours
                        ? Math.round((mainSport.hours / focusTotals.hours) * 100)
                        : 0}
                      % 的时间
                    </span>
                  }
                />
              )}
            </dl>
          </div>
        </div>
      </section>

      {/* ── 年初至今（Year to date）──────────────────────────────── */}
      <section className="ed-section" aria-label="年初至今">
        <div className="ed-chart-card">
          <div className="ed-card-head">
            <h2 className="ed-h2">年初至今</h2>
            <p className="ed-sub">{ytdLine}</p>
          </div>
          <YearToDateChart activities={activities} focusYear={focus} />
        </div>
      </section>

      {/* ── 逐年对比（Year over year：5 指标卡，柱可点击聚焦）────── */}
      <section className="ed-section" aria-label="逐年对比">
        <div className="ed-section-head">
          <h2 className="ed-h2">逐年对比</h2>
          <p className="ed-sub">点击任意柱可聚焦那一年</p>
        </div>
        <ul className="ed-yoy-grid">
          {METRICS.map((m) => {
            const values = years.map((y) => ({
              year: y,
              value: m.fmt(perYearTotals.get(y) ?? totalsOf([])),
            }));
            const max = Math.max(...values.map((v) => v.value), 1);
            const hi = values.find((v) => v.year === focus);
            return (
              <li key={m.key} className="ed-yoy-card">
                <div className="head">
                  <h3>{m.label}</h3>
                  <span className="hi">
                    {hi ? formatInt(hi.value) : 0} in {focus}
                  </span>
                </div>
                <div className="bars" role="toolbar" aria-label={`${m.label}按年`}>
                  {values.map((v) => (
                    <button
                      key={v.year}
                      type="button"
                      title={`${m.label} ${v.year}：${formatInt(v.value)}`}
                      aria-pressed={v.year === focus}
                      className={`bar ${v.year === focus ? 'is-focus' : ''}`}
                      onClick={() => setFocus(v.year)}
                    >
                      <span className="value">{formatInt(v.value)}</span>
                      <span
                        className="fill"
                        style={{
                          ['--h' as string]: (v.value / max).toFixed(4),
                        }}
                      />
                      <span className="yr">{String(v.year).slice(2)}</span>
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── 每年构成（What each year was made of）────────────────── */}
      <section className="ed-section" aria-label="每年构成">
        <div className="ed-chart-card">
          <div className="ed-card-head">
            <h2 className="ed-h2">每年由什么组成</h2>
            <p className="ed-sub">按运动的小时占比 · 右侧是总量</p>
          </div>
          <div className="ed-share-chart">
            <ul className="legend">
              {matrix.sports.map((s) => (
                <li key={s}>
                  <span className="ed-dot" style={{ background: sportColor(s) }} />
                  {SPORTS[s].zh}
                </li>
              ))}
            </ul>
            <p className="readout">{shareReadout}</p>
            <ul className="rows">
              {shareRows.map((r) => (
                <li
                  key={r.year}
                  className={`row ${r.year === focus ? 'is-on' : ''}`}
                >
                  <button
                    type="button"
                    aria-label={`聚焦 ${r.year}`}
                    aria-pressed={r.year === focus}
                    className="yr-btn"
                    onClick={() => setFocus(r.year)}
                  >
                    {r.year}
                  </button>
                  <button
                    type="button"
                    className="bar-btn"
                    title={r.tip}
                    aria-label={r.tip}
                    onClick={() => setFocus(r.year)}
                    onMouseOver={(e) => {
                      const tip = (e.target as HTMLElement)
                        .closest('[title]')
                        ?.getAttribute('title');
                      if (tip) setShareReadout(tip);
                    }}
                    onFocus={() => setShareReadout(r.tip)}
                  >
                    {r.segs.map((x) => (
                      <span
                        key={x.sport}
                        className="seg"
                        title={r.tip}
                        style={{
                          flex: `${x.h.toFixed(3)} 1 0`,
                          background: sportColor(x.sport),
                        }}
                      />
                    ))}
                  </button>
                  <span className="total">{Math.round(r.total)} h</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 运动 × 年份（Hours, sport × year：圆点矩阵）───────────── */}
      <section className="ed-section" aria-label="运动与年份">
        <div className="ed-chart-card">
          <div className="ed-card-head">
            <h2 className="ed-h2">小时，运动 × 年份</h2>
            <p className="ed-sub">圆的面积 = 小时 · 点击年份可聚焦</p>
          </div>
          <div className="ed-matrix-scroll">
            <table className="ed-matrix">
              <caption className="visually-hidden">
                按运动和年份的小时数；圆面积代表小时。聚焦年份：{focus}。
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="corner">
                    运动
                  </th>
                  {years.map((y) => (
                    <th
                      scope="col"
                      key={y}
                      className={`year-head ${y === focus ? 'is-band' : ''}`}
                    >
                      <button
                        type="button"
                        aria-pressed={y === focus}
                        className="yr-btn"
                        onClick={() => setFocus(y)}
                      >
                        {y}
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="total-head">
                    合计
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrix.sports.map((s) => (
                  <tr key={s}>
                    <th scope="row" className="sport-label">
                      <span className="ed-dot" style={{ background: sportColor(s) }} />
                      {SPORTS[s].zh}
                    </th>
                    {years.map((y) => {
                      const h = matrix.cell.get(`${s}|${y}`) ?? 0;
                      const d = 46 * Math.sqrt(h / matrix.maxCell);
                      return (
                        <td
                          key={y}
                          className={`cell ${y === focus ? 'is-band' : ''}`}
                        >
                          <div className="cell-box">
                            <span
                              className={`bubble ${h ? '' : 'is-empty'}`}
                              style={{
                                width: `${d.toFixed(1)}px`,
                                height: `${d.toFixed(1)}px`,
                                ['--c' as string]: sportColor(s),
                              }}
                            />
                            <span className="value">
                              {h ? Math.round(h) : ''}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                    <td className="total-cell">
                      <div className="total-box">
                        <span className="total-value">
                          {Math.round(matrix.sportHours.get(s) ?? 0)}
                        </span>
                        <span className="track">
                          <span
                            className="fill"
                            style={{
                              width: `${((matrix.sportHours.get(s) ?? 0) / matrix.maxYear) * 100}%`,
                              background: sportColor(s),
                            }}
                          />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
