import { useMemo } from 'react';
import type { Activity } from '@/types';
import {
  activityKm,
  activitySeconds,
  activityYear,
  bySport,
  formatInt,
  localDate,
  paceSecPerKm,
  fmtPace,
  sportColor,
  sportOf,
  SPORTS,
  totalsOf,
} from '../lib/data';
import { bestRunForDistance } from '../lib/track';
import { RouteThumb as Thumb } from '../components/SessionTile';

const fmtDuration = (seconds: number): string => {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const DISTANCE_TARGETS = [
  { label: '1 KM', meters: 1000 },
  { label: '5 KM', meters: 5000 },
  { label: '10 KM', meters: 10000 },
  { label: '半马', meters: 21097.5 },
  { label: '全马', meters: 42195 },
];

export function Records({
  activities,
  navigate,
}: {
  activities: Activity[];
  navigate: (path: string) => void;
}) {
  const totals = useMemo(() => totalsOf(activities), [activities]);
  const earliest = useMemo(() => {
    let min: Activity | null = null;
    for (const a of activities) {
      if (!min || localDate(a) < localDate(min)) min = a;
    }
    return min;
  }, [activities]);

  const bests = useMemo(
    () =>
      DISTANCE_TARGETS.map((t) => ({
        ...t,
        best: bestRunForDistance(activities, t.meters),
      })),
    [activities]
  );

  const biggest = useMemo(() => {
    if (!activities.length) return null;
    let longestRun: Activity | null = null;
    let mostClimb: Activity | null = null;
    let longestSession: Activity | null = null;
    for (const a of activities) {
      if (
        (a.type === 'Run' || a.type === 'TrailRun') &&
        (!longestRun || a.distance > longestRun.distance)
      )
        longestRun = a;
      if (
        !mostClimb ||
        (a.elevation_gain ?? 0) > (mostClimb.elevation_gain ?? 0)
      )
        mostClimb = a;
      if (
        !longestSession ||
        activitySeconds(a) > activitySeconds(longestSession)
      )
        longestSession = a;
    }
    return { longestRun, mostClimb, longestSession };
  }, [activities]);

  const sportTable = useMemo(() => {
    const order = bySport(activities);
    const ranges = new Map<string, [number, number]>();
    for (const { sport } of order) {
      const ds = activities
        .filter((a) => sportOf(a) === sport)
        .map((a) => activityYear(a));
      ranges.set(sport, [Math.min(...ds), Math.max(...ds)]);
    }
    return order.map((s) => ({ ...s, range: ranges.get(s.sport)! }));
  }, [activities]);

  const openDay = (a: Activity) => navigate(`a/${a.run_id}`);

  return (
    <>
      <section className="ed-fade-up" aria-label="Records">
        <h1
          className="ed-hero-title"
          style={{ fontSize: 'clamp(56px, 8vw, 112px)' }}
        >
          Records
        </h1>

        <div className="ed-stats-row">
          <div className="ed-stat-cell">
            <span className="ed-stat-num">
              {earliest
                ? `${localDate(earliest).getFullYear()}.${localDate(earliest).getMonth() + 1}`
                : '—'}
            </span>
            <span className="ed-stat-label">始于</span>
          </div>
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
          <div className="ed-stat-cell">
            <span className="ed-stat-num">{bySport(activities).length}</span>
            <span className="ed-stat-label">种运动</span>
          </div>
        </div>
      </section>

      {/* 跑步最快 */}
      <section className="ed-section" aria-label="跑步最快">
        <div className="ed-section-head">
          <h2 className="ed-section-title">跑步最快</h2>
          <span className="ed-section-note">
            数据无逐点配速流 · 取「距离 ≥ 该目标」活动中平均配速最快的一次
          </span>
        </div>
        <div className="ed-best-grid">
          {bests.map(({ label, best }) => (
            <button
              key={label}
              className="ed-best-card"
              style={{
                textAlign: 'left',
                color: 'inherit',
                font: 'inherit',
                cursor: best ? 'pointer' : 'default',
              }}
              onClick={() => best && openDay(best.activity)}
              disabled={!best}
            >
              <div className="top">
                <span className="dist">{label}</span>
                {best && (
                  <span className="thumb">
                    <Thumb activity={best.activity} width={72} height={56} />
                  </span>
                )}
              </div>
              {best ? (
                <>
                  <div className="time">
                    {fmtPace(best.secPerKm)}{' '}
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: '#8c8b85',
                      }}
                    >
                      /km
                    </span>
                  </div>
                  <div className="pace">
                    {activityKm(best.activity.distance).toFixed(1)} km ·{' '}
                    {fmtDuration(activitySeconds(best.activity))}
                  </div>
                  <div className="name">{best.activity.name || '跑步'}</div>
                  <div className="date">
                    {localDate(best.activity).toLocaleDateString('zh-CN')}
                  </div>
                </>
              ) : (
                <>
                  <div className="time" style={{ color: '#3a3b40' }}>
                    —
                  </div>
                  <div className="date" style={{ marginTop: 10 }}>
                    还没有达到这个距离
                  </div>
                </>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* 最大的一天 */}
      <section className="ed-section" aria-label="最大的一天">
        <div className="ed-section-head">
          <h2 className="ed-section-title">最大的一天</h2>
        </div>
        <div className="ed-latest-grid">
          {biggest?.longestRun && (
            <BigDayCard
              label="最长的一次跑步"
              value={`${activityKm(biggest.longestRun.distance).toFixed(1)} km`}
              activity={biggest.longestRun}
              onOpen={() => openDay(biggest.longestRun!)}
            />
          )}
          {biggest?.mostClimb && (
            <BigDayCard
              label="爬升最多"
              value={`${formatInt(biggest.mostClimb.elevation_gain ?? 0)} m`}
              activity={biggest.mostClimb}
              onOpen={() => openDay(biggest.mostClimb!)}
            />
          )}
          {biggest?.longestSession && (
            <BigDayCard
              label="时长最长"
              value={fmtDuration(activitySeconds(biggest.longestSession))}
              activity={biggest.longestSession}
              onOpen={() => openDay(biggest.longestSession!)}
            />
          )}
        </div>
      </section>

      {/* 按运动 */}
      <section className="ed-section" aria-label="按运动统计">
        <div className="ed-section-head">
          <h2 className="ed-section-title">按运动</h2>
        </div>
        <table className="ed-table">
          <thead>
            <tr>
              <th>运动</th>
              <th className="num">次数</th>
              <th className="num">小时</th>
              <th className="num">公里</th>
              <th className="num">最长</th>
              <th className="num">活跃期</th>
            </tr>
          </thead>
          <tbody>
            {sportTable.map((s) => {
              const longest = activities
                .filter((a) => sportOf(a) === s.sport)
                .reduce<Activity | null>(
                  (best, a) =>
                    !best || activitySeconds(a) > activitySeconds(best)
                      ? a
                      : best,
                  null
                );
              return (
                <tr key={s.sport}>
                  <td>
                    <span
                      className="ed-dot"
                      style={{ background: sportColor(s.sport) }}
                    />
                    <span className="sport-name">{SPORTS[s.sport].zh}</span>
                  </td>
                  <td className="num">{s.sessions}</td>
                  <td className="num">{formatInt(s.hours)}</td>
                  <td className="num">{s.km >= 1 ? formatInt(s.km) : '—'}</td>
                  <td className="num">
                    {longest ? fmtDuration(activitySeconds(longest)) : '—'}
                  </td>
                  <td className="num">
                    {s.range[0] === s.range[1]
                      ? s.range[0]
                      : `${s.range[0]}–${s.range[1]}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}

function BigDayCard({
  label,
  value,
  activity,
  onOpen,
}: {
  label: string;
  value: string;
  activity: Activity;
  onOpen: () => void;
}) {
  const sport = sportOf(activity);
  return (
    <button
      className="ed-latest-card"
      style={{
        textAlign: 'left',
        cursor: 'pointer',
        color: 'inherit',
        font: 'inherit',
      }}
      onClick={onOpen}
    >
      <span className="thumb">
        <Thumb activity={activity} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="tag">
          <span className="ed-dot" style={{ background: sportColor(sport) }} />
          {label}
        </span>
        <span
          className="name"
          style={{ display: 'block', fontSize: 26, letterSpacing: '-0.02em' }}
        >
          {value}
        </span>
        <span
          className="meta"
          style={{
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {activity.name} · {localDate(activity).toLocaleDateString('zh-CN')} ·{' '}
          {paceOrTime(activity)}
        </span>
      </span>
    </button>
  );
}

function paceOrTime(a: Activity): string {
  const pace = paceSecPerKm(a);
  return pace ? `${fmtPace(pace)} /km` : SPORTS[sportOf(a)].zh;
}
