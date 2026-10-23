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
} from '../lib/data';

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
    </>
  );
}
