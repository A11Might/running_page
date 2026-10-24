import { useMemo, useState } from 'react';
import type { Activity } from '@/types';
import {
  activityKm,
  activitySeconds,
  availableYears,
  formatInt,
  localDate,
  sportColor,
  sportOf,
  SPORTS,
  streaks,
  totalsOf,
  type SportKey,
} from '../lib/data';
import { SiteFooter } from '../components/sections';

interface DayCell {
  dateKey: string; // YYYY-MM-DD
  weekCol: number;
  dayRow: number; // 0=周一 .. 6=周日
  activities: Activity[];
  /** 当天占比最高的运动（按时长） */
  sport: ReturnType<typeof sportOf> | null;
  hours: number;
}

const WEEKDAY_LABELS = ['一', '三', '五', '日'];

function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  m.setHours(0, 0, 0, 0);
  return m;
}

export function CalendarPage({
  activities,
  navigate,
}: {
  activities: Activity[];
  navigate: (path: string) => void;
}) {
  const years = useMemo(() => availableYears(activities), [activities]);
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(
    years.includes(thisYear) ? thisYear : years[0]
  );
  const [selected, setSelected] = useState<string | null>(null);

  const yearActs = useMemo(
    () => activities.filter((a) => localDate(a).getFullYear() === year),
    [activities, year]
  );
  const totals = useMemo(() => totalsOf(yearActs), [yearActs]);
  const { longestStreak } = useMemo(() => streaks(yearActs), [yearActs]);

  // 运动构成（按小时占比）
  const mixRows = useMemo(() => {
    const tally = new Map<SportKey, number>();
    const counts = new Map<SportKey, number>();
    for (const a of yearActs) {
      const s = sportOf(a);
      tally.set(s, (tally.get(s) ?? 0) + activitySeconds(a) / 3600);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const rows = [...tally.entries()]
      .map(([sport, hours]) => ({
        sport,
        hours,
        sessions: counts.get(sport) ?? 0,
      }))
      .sort((x, y) => y.hours - x.hours);
    const max = Math.max(...rows.map((r) => r.hours), 0.01);
    return rows.map((r) => ({ ...r, pct: (r.hours / max) * 100 }));
  }, [yearActs]);

  const weeks = useMemo<DayCell[][]>(() => {
    const byDay = new Map<string, Activity[]>();
    for (const a of yearActs) {
      const key = a.start_date_local.slice(0, 10);
      byDay.set(key, [...(byDay.get(key) ?? []), a]);
    }
    const start = mondayOf(new Date(year, 0, 1));
    const end = new Date(year, 11, 31);
    const cols: DayCell[][] = [];
    const cursor = new Date(start);
    const todayKey = new Date().toISOString().slice(0, 10);
    void todayKey;
    while (cursor <= end) {
      const col: DayCell[] = [];
      for (let row = 0; row < 7; row++) {
        const date = new Date(cursor);
        date.setDate(cursor.getDate() + row);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const dayActs = byDay.get(dateKey) ?? [];
        const hours = dayActs.reduce(
          (s, a) => s + activitySeconds(a) / 3600,
          0
        );
        let sport: DayCell['sport'] = null;
        if (dayActs.length) {
          const tally = new Map<string, number>();
          for (const a of dayActs) {
            const s = sportOf(a) as string;
            tally.set(s, (tally.get(s) ?? 0) + activitySeconds(a) / 3600);
          }
          sport = [...tally.entries()].sort(
            (x, y) => y[1] - x[1]
          )[0][0] as DayCell['sport'];
        }
        col.push({
          dateKey,
          weekCol: cols.length,
          dayRow: row,
          activities: dayActs,
          sport,
          hours,
        });
      }
      cols.push(col);
      cursor.setDate(cursor.getDate() + 7);
    }
    return cols;
  }, [yearActs, year]);

  // 月份标签位置：在聚焦年份里第一次出现某月的那一列打标签
  const monthMarks = useMemo(() => {
    const marks: { month: number; col: number }[] = [];
    const seen = new Set<number>();
    weeks.forEach((col, i) => {
      for (const cell of col) {
        const d = new Date(cell.dateKey + 'T00:00:00');
        if (d.getFullYear() !== year) continue;
        if (seen.has(d.getMonth())) continue;
        seen.add(d.getMonth());
        marks.push({ month: d.getMonth(), col: i });
      }
    });
    return marks;
  }, [weeks, year]);

  const selectedCell = selected
    ? weeks.flat().find((c) => c.dateKey === selected)
    : null;
  const selectedDate = selected ? new Date(selected + 'T00:00:00') : null;

  const stepDay = (dir: -1 | 1) => {
    if (!selected) return;
    const d = new Date(selected + 'T00:00:00');
    d.setDate(d.getDate() + dir);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (d.getFullYear() === year) setSelected(key);
  };

  return (
    <>
      <section className="ed-fade-up" aria-label="Calendar">
        <h1
          className="ed-hero-title"
          style={{ fontSize: 'clamp(56px, 9vw, 128px)', maxWidth: 700 }}
        >
          {year}, day by day
        </h1>
        <div className="ed-pills" style={{ marginTop: 18 }}>
          {years.map((y) => (
            <button
              key={y}
              className={`ed-pill ${y === year ? 'is-on' : ''}`}
              onClick={() => {
                setYear(y);
                setSelected(null);
              }}
            >
              {y}
            </button>
          ))}
        </div>

        <div className="ed-stats-row">
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{totals.sessions}</span>
            <span className="ed-stat-label">次数</span>
          </div>
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{totals.activeDays}</span>
            <span className="ed-stat-label">活跃天</span>
          </div>
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{formatInt(totals.hours)}</span>
            <span className="ed-stat-label">小时</span>
          </div>
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{longestStreak} 天</span>
            <span className="ed-stat-label">最长连续</span>
          </div>
        </div>
      </section>

      <section className="ed-section" aria-label="全年每一天">
        <div className="ed-chart-card">
          <div className="ed-section-head" style={{ marginBottom: 16 }}>
            <h3 className="ed-chart-title">全年的每一天</h3>
            <span className="ed-section-note">悬停查看 · 点击选中某天</span>
          </div>

          <div className="ed-heatmap-wrap">
            <div style={{ position: 'relative' }}>
              <div
                className="ed-heatmap-months"
                style={{
                  gridTemplateColumns: `repeat(${weeks.length}, 15px)`,
                  marginBottom: 6,
                }}
              >
                {weeks.map((_, i) => {
                  const mark = monthMarks.find((m) => m.col === i);
                  return (
                    <span
                      key={i}
                      style={{ gridColumn: i + 1, whiteSpace: 'nowrap' }}
                    >
                      {mark ? `${mark.month + 1}月` : ''}
                    </span>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateRows: 'repeat(7, 13px)',
                    gap: 2,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9.5,
                    color: '#55565c',
                  }}
                  aria-hidden
                >
                  {WEEKDAY_LABELS.map((l, i) => (
                    <span
                      key={l}
                      style={{ gridRow: i * 2 + 1, lineHeight: '13px' }}
                    >
                      {l}
                    </span>
                  ))}
                </div>
                <div className="ed-heatmap">
                  {weeks.flatMap((col) =>
                    col.map((cell) => {
                      const title = cell.activities.length
                        ? `${cell.dateKey} · ${cell.activities.length} 次 · ${cell.hours.toFixed(1)} h\n${cell.activities
                            .map(
                              (a) =>
                                `· ${a.name || SPORTS[sportOf(a)].zh} ${activityKm(a.distance).toFixed(1)}km`
                            )
                            .join('\n')}`
                        : cell.dateKey;
                      return (
                        <button
                          key={cell.dateKey}
                          className={`cell ${selected === cell.dateKey ? 'is-selected' : ''}`}
                          style={{
                            background: cell.sport
                              ? sportColor(cell.sport)
                              : undefined,
                            opacity: cell.sport
                              ? 0.28 + 0.72 * Math.min(cell.hours / 2, 1)
                              : 1,
                          }}
                          title={title}
                          onClick={() => setSelected(cell.dateKey)}
                          aria-label={title}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="ed-day-panel">
            <span className="ed-control">
              <button
                className="ed-btn ed-btn--ghost"
                onClick={() => stepDay(-1)}
              >
                ← 前一天
              </button>
              <button
                className="ed-btn ed-btn--ghost"
                onClick={() => stepDay(1)}
              >
                后一天 →
              </button>
            </span>
            {selectedDate ? (
              selectedCell && selectedCell.activities.length ? (
                selectedCell.activities.map((a) => (
                  <button
                    key={a.run_id}
                    className="ed-day-session"
                    style={{
                      color: 'inherit',
                      font: 'inherit',
                      textAlign: 'left',
                    }}
                    onClick={() => navigate(`a/${a.run_id}`)}
                  >
                    <span
                      className="ed-dot"
                      style={{ background: sportColor(sportOf(a)) }}
                    />
                    <span className="name">
                      {a.name || SPORTS[sportOf(a)].zh}
                    </span>
                    <span className="meta">
                      {activityKm(a.distance) >= 0.1
                        ? `${activityKm(a.distance).toFixed(1)} km · `
                        : ''}
                      {Math.floor(activitySeconds(a) / 3600)}:
                      {String(
                        Math.floor((activitySeconds(a) % 3600) / 60)
                      ).padStart(2, '0')}
                      {a.average_heartrate
                        ? ` · ${Math.round(a.average_heartrate)} bpm`
                        : ''}
                    </span>
                  </button>
                ))
              ) : (
                <span className="ed-chart-sub">
                  {selectedDate.toLocaleDateString('zh-CN')} · 休息日
                </span>
              )
            ) : (
              <span className="ed-chart-sub">选一天看看做了什么</span>
            )}
          </div>
        </div>
      </section>
      {/* ── 我何时运动（When I move：按开始小时的环形时钟）────────── */}
      <section className="ed-section" aria-label="我何时运动">
        <div className="ed-half-row">
          <div className="ed-half-card">
            <div className="ed-card-head">
              <h2 className="ed-h2">我何时运动</h2>
              <p className="ed-sub">按开始小时统计，本地时间</p>
            </div>
            <WhenClock activities={yearActs} year={year} />
          </div>

          {/* ── 运动构成（Sport mix：小时占比条）────────────────── */}
          <div className="ed-half-card">
            <div className="ed-card-head">
              <h2 className="ed-h2">运动构成</h2>
              <p className="ed-sub">各运动的小时</p>
            </div>
            <ul className="ed-mix">
              {mixRows.map((r) => (
                <li key={r.sport} className="mix-row">
                  <span className="mix-label">
                    <span
                      className="ed-dot"
                      style={{ background: sportColor(r.sport) }}
                    />
                    {SPORTS[r.sport].zh}
                  </span>
                  <span className="track" aria-hidden>
                    <span
                      className="bar"
                      style={{
                        width: `${r.pct}%`,
                        background: sportColor(r.sport),
                      }}
                    />
                  </span>
                  <span className="mix-value">
                    {Math.round(r.hours)} h · {r.sessions} 次
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

/**
 * 我何时运动 —— 24 小时环形时钟（参考站 When I move）：
 * 圆环 r56–150（360 坐标系），每小时一个 clip-path 楔形按钮，
 * 悬停/聚焦更新读数；空心底圈与外圈为 hairline 参考圆。
 */
function WhenClock({
  activities,
  year,
}: {
  activities: Activity[];
  year: number;
}) {
  const [readout, setReadout] = useState('悬停一个小时');

  // 每小时：总数 + 各运动次数
  const hours = useMemo(() => {
    const slots = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      total: 0,
      by: new Map<SportKey, number>(),
    }));
    for (const a of activities) {
      const h = new Date(
        a.start_date_local.replace(' ', 'T')
      ).getHours();
      const slot = slots[h];
      slot.total += 1;
      const s = sportOf(a);
      slot.by.set(s, (slot.by.get(s) ?? 0) + 1);
    }
    return slots;
  }, [activities]);

  const peak = useMemo(
    () => hours.reduce((b, s) => (s.total > b.total ? s : b), hours[0]),
    [hours]
  );

  // 楔形 clip-path（参考站 ae：外弧 r150 内弧 r56，各 7 个插值点）
  const wedge = (h: number): string => {
    const R_OUT = 150;
    const R_IN = 56;
    const a0 = (h / 24) * Math.PI * 2;
    const a1 = ((h + 1) / 24) * Math.PI * 2;
    const p = (a: number, r: number) =>
      `${(((180 + r * Math.sin(a)) / 360) * 100).toFixed(2)}% ${(((180 - r * Math.cos(a)) / 360) * 100).toFixed(2)}%`;
    const pts: string[] = [];
    for (let i = 0; i <= 6; i++) pts.push(p(a0 + ((a1 - a0) * i) / 6, R_OUT));
    for (let i = 6; i >= 0; i--) pts.push(p(a0 + ((a1 - a0) * i) / 6, R_IN));
    return `polygon(${pts.join(', ')})`;
  };

  return (
    <div className="ed-when">
      <p className="readout">{readout}</p>
      <div className="clock">
        <svg viewBox="0 0 360 360" role="img" aria-label={`按开始小时统计，${year} 年：最忙的小时是 ${peak.hour}:00，共 ${peak.total} 次。`}>
          <circle cx={180} cy={180} r={150} className="guide" />
          <circle cx={180} cy={180} r={56} className="guide" />
        </svg>
        {hours.map((s) => {
          const label = `${String(s.hour).padStart(2, '0')}:00`;
          const parts = [...s.by.entries()]
            .sort((x, y) => y[1] - x[1])
            .map(([sp, n]) => `${SPORTS[sp].zh} ${n}`)
            .join('，');
          const tip = s.total
            ? `${label} · ${s.total} 次${parts ? ` · ${parts}` : ''}`
            : `${label} · 无运动`;
          return (
            <button
              key={s.hour}
              type="button"
              className="wedge"
              style={{ clipPath: wedge(s.hour) }}
              title={tip}
              aria-label={tip}
              onMouseEnter={() => setReadout(tip)}
              onFocus={() => setReadout(tip)}
              onMouseLeave={() => setReadout('悬停一个小时')}
              onBlur={() => setReadout('悬停一个小时')}
            />
          );
        })}
      </div>
    </div>
  );
}
