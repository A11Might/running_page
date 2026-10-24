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
import { SiteFooter } from '../components/sections';

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

  // 比赛识别：名字含常见比赛关键词且距离达标（10 km+ 或爬升 500 m+）
  const RACE_KEYWORDS = [
    '比赛',
    '竞赛',
    '越野赛',
    '马拉松',
    '半马',
    '全马',
    'Race',
    'race',
    'RACE',
    'Marathon',
    'marathon',
    'Triathlon',
    'Ironman',
    'Ultra',
    'ultra',
    '100K',
    '100k',
    '50K',
    '50k',
    'TNF',
    'UTMB',
  ];
  const races = useMemo(
    () =>
      activities.filter((a) => {
        const name = a.name ?? '';
        if (!RACE_KEYWORDS.some((k) => name.includes(k))) return false;
        return a.distance >= 10000 || (a.elevation_gain ?? 0) >= 500;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activities]
  );

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
          <h2 className="ed-section-title ed-h2-lg">跑步最快</h2>
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
                    {fmtDuration(best.secPerKm * (best.distanceM / 1000))}
                  </div>
                  <div className="pace">{fmtPace(best.secPerKm)} /km</div>
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
          <h2 className="ed-section-title ed-h2-lg">最大的一天</h2>
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

      {/* 比赛 */}
      {races.length > 0 && (
        <section className="ed-section" aria-label="比赛">
          <div className="ed-section-head">
            <h2 className="ed-section-title ed-h2-lg">比赛</h2>
            <span className="ed-section-note">
              按名字识别的比赛与长距离挑战
            </span>
          </div>
          <div className="ed-races-grid">
            {races.map((a) => {
              const sport = sportOf(a);
              return (
                <button
                  key={a.run_id}
                  className="ed-race-card"
                  style={{ color: 'inherit', font: 'inherit' }}
                  onClick={() => openDay(a)}
                >
                  <span className="ed-race-thumb">
                    <Thumb activity={a} width={210} height={150} />
                  </span>
                  <span
                    className="name"
                    style={{
                      display: 'block',
                      marginTop: 14,
                      fontWeight: 700,
                      fontSize: 16,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.name}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      marginTop: 3,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: '#8c8b85',
                    }}
                  >
                    {localDate(a).toLocaleDateString('zh-CN')} ·{' '}
                    <span
                      className="ed-dot"
                      style={{ background: sportColor(sport) }}
                    />
                    {SPORTS[sport].zh}
                  </span>
                  <span className="ed-race-stats">
                    <span>
                      <b>{activityKm(a.distance).toFixed(1)}</b> km
                    </span>
                    <span>
                      <b>{formatInt(a.elevation_gain ?? 0)}</b> m 爬升
                    </span>
                    <span>
                      <b>{fmtDuration(activitySeconds(a))}</b> 时长
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 按运动 */}
      <section className="ed-section" aria-label="按运动统计">
        <div className="ed-section-head">
          <h2 className="ed-section-title ed-h2-lg">按运动</h2>
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

      <SiteFooter />
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
        <Thumb activity={activity} width={112} height={92} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="tag">
          <span className="ed-dot" style={{ background: sportColor(sport) }} />
          {label}
        </span>
        <span
          className="name"
          style={{
            display: 'block',
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          {value}
        </span>
        <span
          style={{
            display: 'block',
            marginTop: 4,
            fontWeight: 600,
            fontSize: 14,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {activity.name}
        </span>
        <span
          style={{
            display: 'block',
            marginTop: 2,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: '#8c8b85',
          }}
        >
          {localDate(activity).toLocaleDateString('zh-CN')}
        </span>
      </span>
    </button>
  );
}