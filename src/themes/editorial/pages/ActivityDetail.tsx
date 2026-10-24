import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { Activity } from '@/types';
import {
  activityKm,
  activitySeconds,
  fmtPace,
  formatInt,
  hrZone,
  localDate,
  paceSecPerKm,
  sportColor,
  sportOf,
  SPORTS,
} from '../lib/data';
import { parseMovingTime } from '@/core/hooks/useActivities';
import { sortedByDate, trackOf } from '../lib/track';
import { HrChart, RoutePoster } from '../components/charts';
import { SessionClockLegend, SessionGlyph } from '../components/SessionTile';
import { useVertScene } from '../components/VertScene';

const VertScene = lazy(() =>
  import('../components/VertScene').then((m) => ({ default: m.VertScene }))
);

const fmtDuration = (seconds: number): string => {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  return `${m}:${String(total % 60).padStart(2, '0')}`;
};

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const RECENT_KEY = 'ed_recent_views';

function readRecent(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'number') : [];
  } catch {
    return [];
  }
}

function pushRecent(runId: number) {
  const next = [runId, ...readRecent().filter((id) => id !== runId)].slice(
    0,
    8
  );
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* 隐私模式下写入失败不影响浏览 */
  }
}

/** 最近浏览药丸行（参照站详情页顶部） */
function RecentPills({
  activities,
  currentId,
  navigate,
}: {
  activities: Activity[];
  currentId: number;
  navigate: (path: string) => void;
}) {
  const recent = useMemo(() => {
    return readRecent()
      .filter((id) => id !== currentId)
      .map((id) => activities.find((a) => a.run_id === id))
      .filter((a): a is Activity => !!a)
      .slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, currentId]);
  if (!recent.length) return null;
  return (
    <div className="ed-recent-pills">
      {recent.map((a) => {
        const sport = sportOf(a);
        return (
          <button
            key={a.run_id}
            className="ed-recent-pill"
            style={{ color: 'inherit', font: 'inherit' }}
            onClick={() => navigate(`a/${a.run_id}`)}
          >
            <span
              className="ed-dot"
              style={{ background: sportColor(sport) }}
            />
            {a.name || SPORTS[sport].zh}
          </button>
        );
      })}
    </div>
  );
}

/** More like this：同运动、时间上最接近的几次 */
function MoreLikeThis({
  activities,
  current,
  navigate,
}: {
  activities: Activity[];
  current: Activity;
  navigate: (path: string) => void;
}) {
  const similar = useMemo(() => {
    const t = localDate(current).getTime();
    return activities
      .filter(
        (a) => a.run_id !== current.run_id && sportOf(a) === sportOf(current)
      )
      .sort(
        (a, b) =>
          Math.abs(localDate(a).getTime() - t) -
          Math.abs(localDate(b).getTime() - t)
      )
      .slice(0, 4);
  }, [activities, current]);
  if (similar.length < 2) return null;
  return (
    <section className="ed-section" aria-label="相似活动">
      <div className="ed-section-head">
        <h2 className="ed-section-title">相似的活动</h2>
        <span className="ed-section-note">
          时间上最接近的几次{SPORTS[sportOf(current)].zh}
        </span>
      </div>
      <div className="ed-similar-grid">
        {similar.map((a) => {
          const sport = sportOf(a);
          return (
            <button
              key={a.run_id}
              className="ed-similar-card"
              style={{ color: 'inherit', font: 'inherit' }}
              onClick={() => navigate(`a/${a.run_id}`)}
            >
              <span className="ed-similar-glyph">
                <SessionGlyph activity={a} size={120} glow />
              </span>
              <span className="ed-similar-text">
                <span className="tag">
                  <span
                    className="ed-dot"
                    style={{ background: sportColor(sport) }}
                  />
                  {SPORTS[sport].en}
                </span>
                <span className="name">{a.name || SPORTS[sport].zh}</span>
                <span className="meta">
                  {localDate(a).toLocaleDateString('zh-CN')} ·{' '}
                  {activityKm(a.distance) >= 0.1
                    ? `${activityKm(a.distance).toFixed(1)} km · `
                    : ''}
                  {fmtDuration(activitySeconds(a))}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ActivityDetail({
  activities,
  runId,
  navigate,
}: {
  activities: Activity[];
  runId: number;
  navigate: (path: string) => void;
}) {
  const activity = useMemo(
    () => activities.find((a) => a.run_id === runId) ?? null,
    [activities, runId]
  );
  const [scrub, setScrub] = useState<number | null>(null);
  const scene = useVertScene(runId);

  useEffect(() => {
    setScrub(null);
  }, [runId]);

  useEffect(() => {
    if (activity) {
      document.title = `${activity.name || SPORTS[sportOf(activity)].zh} · Activities`;
      pushRecent(activity.run_id);
      return () => {
        document.title = 'Activities';
      };
    }
  }, [activity]);

  if (!activity) {
    return (
      <div className="ed-section" style={{ padding: '60px 0' }}>
        <p className="ed-chart-sub">没有找到这条记录。</p>
        <button
          className="ed-btn"
          style={{ marginTop: 18 }}
          onClick={() => navigate('')}
        >
          ← 返回全部活动
        </button>
      </div>
    );
  }

  const sport = sportOf(activity);
  const color = sportColor(sport);
  const ordered = sortedByDate(activities);
  const idx = ordered.findIndex((a) => a.run_id === runId);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx < ordered.length - 1 ? ordered[idx + 1] : null;

  const seconds = activitySeconds(activity);
  const elapsedSeconds = activity.elapsed_time
    ? parseMovingTime(activity.elapsed_time)
    : 0;
  const hrVals = (activity.hr_series ?? []).filter(
    (v): v is number => v != null
  );
  const maxHr = hrVals.length ? Math.max(...hrVals) : null;
  // 心率区间的时间分布：每个桶 = 总时长的 1/72（纯计算，无需 memo）
  const ZONE_COLORS_RGB = [
    '#66463d',
    '#91503a',
    '#bc5d38',
    '#e27544',
    '#ffa884',
  ];
  const hrArr = activity.hr_series ?? [];
  const zoneMinutes = (() => {
    if (!hrArr.length) return [] as { zone: number; minutes: number }[];
    const totalMin = (elapsedSeconds || seconds) / 60;
    const perBucket = totalMin / hrArr.length;
    const tally = [0, 0, 0, 0, 0];
    for (const v of hrArr) {
      if (v == null) continue;
      const z = hrZone(v);
      if (z) tally[z - 1] += perBucket;
    }
    return tally.map((minutes, i) => ({ zone: i + 1, minutes }));
  })();
  const pace = paceSecPerKm(activity);
  const date = localDate(activity);
  const scrubFraction =
    scrub != null && activity.distance > 0 ? scrub / activity.distance : null;
  const hasRoute = !!trackOf(activity);

  return (
    <>
      <button
        className="ed-link"
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: '#8c8b85',
          marginTop: 30,
        }}
        onClick={() => navigate('')}
      >
        ← 全部活动
      </button>

      <RecentPills
        activities={activities}
        currentId={runId}
        navigate={navigate}
      />

      <div className="ed-detail">
        <div className="ed-poster">
          {hasRoute ? (
            <RoutePoster activity={activity} scrubFraction={scrubFraction} />
          ) : (
            <>
              <div
                style={{
                  padding: '36px 0',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <div style={{ width: 300 }}>
                  <SessionGlyph activity={activity} size={300} glow hero />
                </div>
              </div>
              <SessionClockLegend
                color={color}
                hours={(elapsedSeconds || seconds) / 3600}
                durationLabel={fmtDuration(elapsedSeconds || seconds)}
              />
            </>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <span className="ed-detail-tag">
            <span className="ed-dot" style={{ background: color }} />
            {SPORTS[sport].en}
          </span>
          <h1 className="ed-detail-title">
            {activity.name || SPORTS[sport].zh}
          </h1>
          <p className="ed-detail-date">
            {WEEKDAYS[date.getDay()]} {date.getFullYear()} 年{' '}
            {date.getMonth() + 1} 月 {date.getDate()} 日 ·{' '}
            {String(date.getHours()).padStart(2, '0')}:
            {String(date.getMinutes()).padStart(2, '0')}
          </p>

          <dl className="ed-figures">
            <div className="ed-figures-row">
              <dd>
                {activity.distance >= 100
                  ? `${activityKm(activity.distance).toFixed(2)} km`
                  : '—'}
              </dd>
              <dt>距离</dt>
            </div>
            <div className="ed-figures-row">
              <dd>{fmtDuration(elapsedSeconds || seconds)}</dd>
              <dt>时长</dt>
            </div>
            <div className="ed-figures-row">
              <dd>
                {(activity.elevation_gain ?? 0) > 0
                  ? `${formatInt(activity.elevation_gain ?? 0)} m`
                  : '—'}
              </dd>
              <dt>爬升</dt>
            </div>
            {activity.average_heartrate != null && (
              <div className="ed-figures-row">
                <dd>{Math.round(activity.average_heartrate)} bpm</dd>
                <dt>平均心率</dt>
              </div>
            )}
            {maxHr != null && (
              <div className="ed-figures-row">
                <dd>{maxHr} bpm</dd>
                <dt>最大心率</dt>
              </div>
            )}
            {pace && (
              <div className="ed-figures-row">
                <dd>{fmtPace(pace)} /km</dd>
                <dt>平均配速</dt>
              </div>
            )}
            {activity.calories ? (
              <div className="ed-figures-row">
                <dd>{formatInt(activity.calories)} kcal</dd>
                <dt>能量</dt>
              </div>
            ) : null}
          </dl>

          {hasRoute && scene && scene !== 'missing' && (
            <div className="ed-detail-actions">
              <a className="ed-btn" href="#vert-terrain">
                Vert ↗
              </a>
              <span className="hint">3D 地形就在下面 · 高程剖面可以拖动。</span>
            </div>
          )}
        </div>
      </div>

      {/* 3D 地形 */}
      <section className="ed-section" id="vert-terrain" aria-label="地形">
        {!hasRoute ? (
          <div className="ed-vert-empty">
            室内活动没有 GPS 轨迹，不渲染 3D 地形。
            <br />
            时长与心率已经在上面——它们同样是这次训练的形状。
          </div>
        ) : scene === 'missing' ? (
          <div className="ed-vert-empty">
            这次活动还没有烘焙 3D 地形场景。
            <br />
            场景文件由 vert-bake
            离线生成，只含地形高程网格与轨迹形状，不含任何坐标。
          </div>
        ) : (
          <>
            <div className="ed-section-head">
              <h2 className="ed-section-title" style={{ fontSize: 24 }}>
                地形
              </h2>
              <span className="ed-section-note">拖动旋转 · 滚轮缩放</span>
            </div>
            <Suspense
              fallback={
                <div className="ed-vert-box">
                  <div className="vert-loading">正在加载 3D 地形…</div>
                </div>
              }
            >
              {scene && (
                <VertScene
                  activity={activity}
                  scene={scene}
                  scrub={scrub}
                  onScrub={setScrub}
                />
              )}
            </Suspense>
          </>
        )}
      </section>

      {/* 心率曲线 */}
      {hrVals.length >= 6 && (
        <section className="ed-section" aria-label="心率">
          <div className="ed-chart-card">
            <div className="ed-section-head" style={{ marginBottom: 14 }}>
              <h2 className="ed-section-title" style={{ fontSize: 24 }}>
                心率
              </h2>
              <span className="ed-section-note">
                平均 {Math.round(activity.average_heartrate ?? 0)} · 峰值{' '}
                {maxHr} bpm
              </span>
            </div>
            <HrChart activity={activity} color={color} />
            <div className="ed-hr-axis">
              <span>开始</span>
              <span>{fmtDuration(elapsedSeconds || seconds)}</span>
            </div>
            {/* 心率区间的时间分布（对齐参考站的 Z1–Z5 分布行） */}
            <div className="ed-zone-row">
              {zoneMinutes.map(({ zone, minutes }, i) =>
                minutes >= 0.5 ? (
                  <span key={zone} className="ed-zone-chip">
                    <span
                      className="dot"
                      style={{ background: ZONE_COLORS_RGB[i] }}
                    />
                    {Math.round(minutes)} 分钟 · Z{zone}
                  </span>
                ) : null
              )}
            </div>
          </div>
        </section>
      )}

      {/* 相似活动 */}
      <MoreLikeThis
        activities={activities}
        current={activity}
        navigate={navigate}
      />

      {/* 相邻活动 */}
      <div className="ed-neighbors">
        {prev ? (
          <button
            className="ed-neighbor"
            style={{
              background: 'none',
              border: '1px solid #26272b',
              cursor: 'pointer',
              color: 'inherit',
              font: 'inherit',
            }}
            onClick={() => navigate(`a/${prev.run_id}`)}
          >
            <span className="dir">←</span>
            {localDate(prev).toLocaleDateString('zh-CN')} ·{' '}
            {prev.name || SPORTS[sportOf(prev)].zh}
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button
            className="ed-neighbor next"
            style={{
              background: 'none',
              border: '1px solid #26272b',
              cursor: 'pointer',
              color: 'inherit',
              font: 'inherit',
            }}
            onClick={() => navigate(`a/${next.run_id}`)}
          >
            {localDate(next).toLocaleDateString('zh-CN')} ·{' '}
            {next.name || SPORTS[sportOf(next)].zh}
            <span className="dir">→</span>
          </button>
        )}
      </div>
    </>
  );
}
