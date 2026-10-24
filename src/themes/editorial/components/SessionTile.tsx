import { memo } from 'react';
import type { Activity } from '@/types';
import { activitySeconds, sportColor, sportOf } from '../lib/data';
import { trackOf, trackPath, trackPathBoxPoints } from '../lib/track';

/**
 * 会话图形 —— 编辑主题的签名视觉，规格逐项取自参考站
 * (activities.geekplux.com) 打包源码的破译结果：
 *  - 坐标系 0..100、圆心 (50,50)；viewBox 四周留 8（hero 留 12）
 *  - 有 GPS：轨迹线 + 起点点（主墨色）；无白描边、无终点标记
 *  - 无 GPS：会话时钟（外环瓦片 / 内曲线 / 核心，详见 SessionClock）
 */

export type GlyphVariant = 'tile' | 'card' | 'hero';

/** 各尺寸的线宽与点半径（参考站 vc 常量表） */
const GLYPH_CFG: Record<
  GlyphVariant,
  {
    vb: string;
    route: number;
    nonScaling: boolean;
    startDot: number;
    track: number;
    hrLine: number;
    tree: number;
  }
> = {
  tile: {
    vb: '-8 -8 116 116',
    route: 1.8,
    nonScaling: false,
    startDot: 2.4,
    track: 0.8,
    hrLine: 1.3,
    tree: 0.55,
  },
  card: {
    vb: '-8 -8 116 116',
    route: 2.5,
    nonScaling: true,
    startDot: 3.2,
    track: 0.4,
    hrLine: 0.9,
    tree: 0.4,
  },
  hero: {
    vb: '-12 -12 124 124',
    route: 3,
    nonScaling: true,
    startDot: 2.8,
    track: 0.3,
    hrLine: 0.7,
    tree: 0.3,
  },
};

/** 时钟槽位数（参考站心率桶固定 48 个） */
const SLOTS = 48;
/** 瓦片间角隙（弧度，参考站 a = 0.014） */
const SLOT_GAP = 0.014;
/** 区间透明度 Z1→Z5 */
const ZONE_OPACITY = [0.3, 0.47, 0.64, 0.82, 1];
/**
 * 个人最大心率：区间阈值 = 最大心率的 50%–90%，每 10% 一档。
 * 参考站取 meta.hrmax（作者本人 197）；按自己的实际情况调整。
 */
const HR_MAX = 190;

const TAU = Math.PI * 2;

/** 极坐标 → 顶点（0° 在 12 点方向，顺时针，参考站 fc） */
const pt = (a: number, r: number) =>
  `${(50 + r * Math.sin(a)).toFixed(2)} ${(50 - r * Math.cos(a)).toFixed(2)}`;

/** 环形扇区（参考站 pc） */
function sector(a1: number, a2: number, r0: number, r1: number) {
  const large = a2 - a1 > Math.PI ? 1 : 0;
  return `M${pt(a1, r0)}L${pt(a1, r1)}A${r1} ${r1} 0 ${large} 1 ${pt(a2, r1)}L${pt(a2, r0)}A${r0} ${r0} 0 ${large} 0 ${pt(a1, r0)}Z`;
}

/** 心率区间（0 基）：Z(z+1) = 最大心率的 50%+10%·z 以上（参考站 dc） */
const zoneOf = (v: number | null): number =>
  v
    ? Math.max(0, Math.min(4, Math.floor((v / HR_MAX - 0.5) * 10)))
    : 0;

/** 心率序列重采样到固定 48 槽（每槽取中点所在的桶） */
function resampleSlots(arr: (number | null)[]): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < SLOTS; i++) {
    const x = ((i + 0.5) / SLOTS) * arr.length;
    out.push(arr[Math.min(arr.length - 1, Math.floor(x))] ?? null);
  }
  return out;
}

const SVG_BASE = {
  width: '100%',
  height: 'auto',
  display: 'block',
  overflow: 'visible',
} as const;

interface GlyphProps {
  activity: Activity;
  variant?: GlyphVariant;
  glow?: boolean;
  /** 图例悬浮联动：高亮指定部分，其余淡出（仅会话时钟生效） */
  highlight?: 'ring' | 'curve' | 'core' | null;
}

/**
 * 会话时钟（参考站 hc/mc 的逐行移植）：
 *  - 外环：一圈 = 整场活动，48 个瓦片从顶部顺时针；
 *    内缘 r=30，Z(z) 外缘 33+2.6z，角隙 0.014rad，透明度按区间
 *  - 内曲线：r = 12 + clamp((v−70)/120, 0, 1)·15，槽位中心取样；
 *    12 即 70 bpm 基准圈（hairline 色）；空桶跳过、直线跨越
 *  - 核心：不足一小时 = 种子点 r=1.6；满 k 小时 = k 圈年轮，
 *    半径 1.2 + k·min(1.6, 9.5/k)，此时不画种子点
 */
function SessionClock({
  activity,
  variant,
  glow,
  color,
  highlight,
}: {
  activity: Activity;
  variant: GlyphVariant;
  glow: boolean;
  color: string;
  highlight?: 'ring' | 'curve' | 'core' | null;
}) {
  const minutes = activitySeconds(activity) / 60;
  const cfg = GLYPH_CFG[variant];
  const raw = activity.hr_series ?? [];
  const slots = raw.length
    ? resampleSlots(raw)
    : (Array.from({ length: SLOTS }, () => null) as (number | null)[]);

  // ── 外环瓦片 ──
  const zoneSubs: string[][] = [[], [], [], [], []];
  for (let t = 0; t < SLOTS; t++) {
    const z = zoneOf(slots[t]);
    const a1 = (t / SLOTS) * TAU + SLOT_GAP / 2;
    const a2 = ((t + 1) / SLOTS) * TAU - SLOT_GAP / 2;
    zoneSubs[z].push(sector(a1, a2, 30, 33 + z * 2.6));
  }

  // ── 内曲线 + 70 bpm 基线（反向串联成环带）──
  let hrLine = '';
  let base = '';
  for (let t = 0; t < SLOTS; t++) {
    const v = slots[t];
    if (!v) continue;
    const a = ((t + 0.5) / SLOTS) * TAU;
    const r = 12 + Math.max(0, Math.min(1, (v - 70) / 120)) * 15;
    hrLine += (hrLine ? 'L' : 'M') + pt(a, r);
    base = `L${pt(a, 12)}` + base;
  }
  const hrArea = hrLine ? `${hrLine}${base}Z` : '';

  // ── 核心 ──
  const hours = Math.floor(minutes / 60);
  const ringRadii =
    hours > 0
      ? Array.from(
          { length: hours },
          (_, k) => 1.2 + (k + 1) * Math.min(1.6, 9.5 / hours)
        )
      : [];

  const dim = (part: 'ring' | 'curve' | 'core') =>
    highlight && highlight !== part ? 0.2 : 1;
  const nsc = cfg.nonScaling
    ? { vectorEffect: 'non-scaling-stroke' as const }
    : {};
  const fade = { transition: 'opacity 0.25s ease' };

  return (
    <svg
      viewBox={cfg.vb}
      role="img"
      aria-label={`${activity.name} 会话时钟`}
      className={glow ? 'ed-glyph-glow' : undefined}
      style={{ color, ...SVG_BASE }}
    >
      <g data-part="clock">
        <g style={{ opacity: dim('curve'), ...fade }}>
          <circle
            cx={50}
            cy={50}
            r={12}
            fill="none"
            stroke="var(--hairline)"
            strokeWidth={cfg.track}
            {...nsc}
          />
          {hrArea ? <path d={hrArea} fill={color} opacity={0.16} /> : null}
          {hrLine ? (
            <path
              d={hrLine}
              fill="none"
              stroke={color}
              strokeWidth={cfg.hrLine}
              strokeLinejoin="round"
              strokeLinecap="round"
              {...nsc}
            />
          ) : null}
        </g>
        <g style={{ opacity: dim('ring'), ...fade }}>
          {zoneSubs.map((subs, z) =>
            subs.length ? (
              <path
                key={z}
                d={subs.join('')}
                fill={color}
                opacity={ZONE_OPACITY[z]}
              />
            ) : null
          )}
        </g>
        <g style={{ opacity: dim('core'), ...fade }}>
          {ringRadii.map((r, k) => (
            <circle
              key={k}
              cx={50}
              cy={50}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={cfg.tree}
              opacity={0.9}
              {...nsc}
            />
          ))}
          {hours === 0 ? <circle cx={50} cy={50} r={1.6} fill={color} /> : null}
        </g>
      </g>
    </svg>
  );
}

export const SessionGlyph = memo(function SessionGlyph({
  activity,
  variant = 'tile',
  glow = false,
  highlight = null,
}: GlyphProps) {
  const color = sportColor(sportOf(activity));
  const cfg = GLYPH_CFG[variant];
  const track = trackOf(activity);

  if (track && track.length >= 2) {
    const { d, points } = trackPath(track, 100, 0);
    const start = points[0];
    return (
      <svg
        viewBox={cfg.vb}
        role="img"
        aria-label={`${activity.name} 路线`}
        className={glow ? 'ed-glyph-glow' : undefined}
        style={{ color, ...SVG_BASE }}
      >
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={cfg.route}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...(cfg.nonScaling
            ? { vectorEffect: 'non-scaling-stroke' as const }
            : {})}
        />
        <circle cx={start.lat} cy={start.lng} r={cfg.startDot} fill="var(--ink)" />
      </svg>
    );
  }

  return (
    <SessionClock
      activity={activity}
      variant={variant}
      glow={glow}
      color={color}
      highlight={highlight}
    />
  );
});

/** 会话时钟图例（详情页用，对齐参考站的 OUTER RING / INNER CURVE / CORE 说明） */
export function SessionClockLegend({
  color,
  hours,
  durationLabel,
  onHover,
}: {
  color: string;
  hours: number;
  durationLabel: string;
  onHover?: (part: 'ring' | 'curve' | 'core' | null) => void;
}) {
  const rowProps = (part: 'ring' | 'curve' | 'core') => ({
    onMouseEnter: () => onHover?.(part),
    onMouseLeave: () => onHover?.(null),
    onFocus: () => onHover?.(part),
    onBlur: () => onHover?.(null),
    tabIndex: 0 as const,
  });
  return (
    <div className="ed-clock-legend">
      <div className="row" {...rowProps('ring')}>
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
          {Array.from({ length: 18 }).map((_, i) => {
            const a = -Math.PI / 2 + (i / 18) * Math.PI * 2;
            const f = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7));
            const r0 = 6.5;
            const r1 = r0 + 3.6 * f;
            const p0 = {
              x: 11 + r0 * Math.cos(a + 0.05),
              y: 11 + r0 * Math.sin(a + 0.05),
            };
            const p1 = {
              x: 11 + r1 * Math.cos(a + 0.05),
              y: 11 + r1 * Math.sin(a + 0.05),
            };
            const p2 = {
              x: 11 + r1 * Math.cos(a + 0.24),
              y: 11 + r1 * Math.sin(a + 0.24),
            };
            const p3 = {
              x: 11 + r0 * Math.cos(a + 0.24),
              y: 11 + r0 * Math.sin(a + 0.24),
            };
            return (
              <path
                key={i}
                d={`M${p0.x.toFixed(1)} ${p0.y.toFixed(1)}L${p1.x.toFixed(1)} ${p1.y.toFixed(1)}A${r1} ${r1} 0 0 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}L${p3.x.toFixed(1)} ${p3.y.toFixed(1)}A${r0} ${r0} 0 0 0 ${p0.x.toFixed(1)} ${p0.y.toFixed(1)}Z`}
                fill={color}
                opacity={0.35 + f * 0.65}
              />
            );
          })}
        </svg>
        <p>
          <b>外环</b> 一圈是整场活动（{durationLabel}
          ），从顶部顺时针。每一片是一段时间， 心率区间越高（Z1→Z5）越高、越亮。
        </p>
      </div>
      <div className="row" {...rowProps('curve')}>
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
          <circle
            cx="11"
            cy="11"
            r="6"
            fill="none"
            stroke={color}
            strokeWidth="0.8"
            opacity="0.35"
          />
          <path
            d="M11 3.5 L12.6 6.2 L14.5 4.8 L15.8 8.5 L13 11 L15.2 13.6 L12.4 16.2 L9.8 14.4 L7.4 16.8 L5.8 13.2 L8.4 10.8 L6.2 8.2 L9 5.6 Z"
            fill="none"
            stroke={color}
            strokeWidth="1.1"
          />
          <circle cx="11" cy="11" r="1.6" fill={color} />
        </svg>
        <p>
          <b>内曲线</b> 同一圈上的心率，越高越靠外；淡圈是 70 bpm。
        </p>
      </div>
      <div className="row" {...rowProps('core')}>
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
          <circle
            cx="11"
            cy="11"
            r="7"
            fill="none"
            stroke={color}
            strokeWidth="0.9"
            opacity="0.5"
          />
          <circle
            cx="11"
            cy="11"
            r="4.6"
            fill="none"
            stroke={color}
            strokeWidth="0.9"
            opacity="0.5"
          />
          <circle cx="11" cy="11" r="2" fill={color} />
        </svg>
        <p>
          <b>核心</b>
          {hours < 1
            ? '种子圆点：本次活动不足一小时。'
            : `种子圆点，每满一小时一圈（共 ${Math.floor(hours)} 圈）。`}
        </p>
      </div>
    </div>
  );
}

export const RouteThumb = memo(function RouteThumb({
  activity,
  width = 92,
  height = 76,
}: {
  activity: Activity;
  width?: number;
  height?: number;
}) {
  // 卡片缩略图：线宽与起终点用 card 档（non-scaling，屏幕像素恒定）
  const cfg = GLYPH_CFG.card;
  const color = sportColor(sportOf(activity));
  const track = trackOf(activity);
  if (!track || track.length < 2) {
    // 无 GPS：小号会话时钟（card 档）
    const s = Math.min(width, height);
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        role="img"
        aria-label={activity.name}
      >
        <div style={{ width: s, height: s }}>
          <SessionClock
            activity={activity}
            variant="card"
            glow={false}
            color={color}
          />
        </div>
      </div>
    );
  }
  const { d, pts } = trackPathBoxPoints(track, width, height, 8);
  const start = pts[0];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={activity.name}
      style={{ overflow: 'visible' }}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={cfg.route}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={start.x} cy={start.y} r={cfg.startDot} fill="var(--ink)" />
    </svg>
  );
});
