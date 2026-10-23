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
  ZONE_COLORS,
} from '../lib/data';
import { sortedByDate, trackOf } from '../lib/track';
import { RoutePoster } from '../components/charts';
import { SessionGlyph } from '../components/SessionTile';
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

      <div className="ed-detail">
        <div className="ed-poster">
          {hasRoute ? (
            <RoutePoster activity={activity} scrubFraction={scrubFraction} />
          ) : (
            <div
              style={{
                padding: '40px 0',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: 220 }}>
                <SessionGlyph activity={activity} size={220} glow hero />
              </div>
            </div>
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
            {date.getFullYear()} 年 {date.getMonth() + 1} 月 {date.getDate()} 日
            · {WEEKDAYS[date.getDay()]} ·{' '}
            {String(date.getHours()).padStart(2, '0')}:
            {String(date.getMinutes()).padStart(2, '0')}
          </p>

          <div className="ed-detail-stats">
            {activity.distance >= 100 && (
              <div className="ed-detail-stat">
                <span className="num">
                  {activityKm(activity.distance).toFixed(2)} km
                </span>
                <span className="label">距离</span>
              </div>
            )}
            <div className="ed-detail-stat">
              <span className="num">{fmtDuration(seconds)}</span>
              <span className="label">时长</span>
            </div>
            {(activity.elevation_gain ?? 0) > 0 && (
              <div className="ed-detail-stat">
                <span className="num">
                  {formatInt(activity.elevation_gain ?? 0)} m
                </span>
                <span className="label">爬升</span>
              </div>
            )}
            {activity.average_heartrate != null && (
              <div className="ed-detail-stat">
                <span className="num">
                  {Math.round(activity.average_heartrate)} bpm
                </span>
                <span className="label">平均心率</span>
              </div>
            )}
            {pace && (
              <div className="ed-detail-stat">
                <span className="num">{fmtPace(pace)} /km</span>
                <span className="label">平均配速</span>
              </div>
            )}
            {activity.average_heartrate != null &&
              hrZone(activity.average_heartrate) && (
                <div className="ed-detail-stat">
                  <span
                    className="num"
                    style={{
                      color: ZONE_COLORS[hrZone(activity.average_heartrate)!],
                    }}
                  >
                    Zone {hrZone(activity.average_heartrate)}
                  </span>
                  <span className="label">心率区间</span>
                </div>
              )}
          </div>

          {hasRoute && scene && scene !== 'missing' && (
            <div className="ed-detail-actions">
              <a className="ed-btn" href="#vert-terrain">
                在 Vert 中查看 ↗
              </a>
              <span className="hint">本次活动的 3D 地形就在下面。</span>
            </div>
          )}
        </div>
      </div>

      {/* 3D 地形 */}
      <section className="ed-section" id="vert-terrain" aria-label="3D 地形">
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
        )}
      </section>

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
