import { memo, type ReactElement } from 'react';
import type { Activity } from '@/types';
import { activitySeconds, hrZone, sportColor, sportOf } from '../lib/data';
import { trackOf, trackPath } from '../lib/track';

interface GlyphProps {
  activity: Activity;
  size?: number;
  glow?: boolean;
  /** 详情页用：画笔更粗、显示起终点 */
  hero?: boolean;
}

/** 极坐标辅助 */
const polar = (cx: number, cy: number, r: number, a: number) => ({
  x: cx + r * Math.cos(a),
  y: cy + r * Math.sin(a),
});

/** 环形扇区（内半径 r0 → 外半径 r1），用于径向柱 */
function sectorPath(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a1: number,
  a2: number
) {
  const p0 = polar(cx, cy, r0, a1);
  const p1 = polar(cx, cy, r1, a1);
  const p2 = polar(cx, cy, r1, a2);
  const p3 = polar(cx, cy, r0, a2);
  const large = a2 - a1 > Math.PI ? 1 : 0;
  return `M${p0.x.toFixed(2)} ${p0.y.toFixed(2)} L${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A${r1} ${r1} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L${p3.x.toFixed(2)} ${p3.y.toFixed(2)} A${r0} ${r0} 0 ${large} 0 ${p0.x.toFixed(2)} ${p0.y.toFixed(2)}Z`;
}

/**
 * 会话时钟 —— 无 GPS 会话的签名视觉（严格对齐参考站详情页的图例说明）：
 *  - 外环：一圈 = 整场活动，从顶部顺时针；每片是一段时间，
 *    心率区间越高（Z1→Z5）越高、越亮；颜色为运动色单色系
 *  - 内曲线：同一圈上的心率，越高越靠外；淡圈是 70 bpm 基准
 *  - 核心：种子圆点，每满一小时一圈
 */
function SessionClock({
  activity,
  size,
  hero,
  glow,
  color,
}: Required<Pick<GlyphProps, 'size' | 'hero' | 'glow'>> & { color: string } & {
  activity: Activity;
}) {
  const hours = Math.max(activitySeconds(activity) / 3600, 1 / 60);
  const c = size / 2;
  const R = c - (hero ? 8 : 5);
  const arr = activity.hr_series ?? [];
  const vals = arr.filter((v): v is number => v != null);
  const hasHr = vals.length >= 6;
  // 每场活动内归一化：把这场的心率区间拉满整个柱高范围，
  // 高低对比才像参考站那样参差（绝对区间只决定颜色）
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of vals) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const spread = hasHr ? Math.max(hi - lo, 4) : 0;
  const relFrac = (hr: number | null): number | null =>
    hasHr && hr != null ? Math.min(Math.max((hr - lo) / spread, 0), 1) : null;

  // ── 外环：一圈 = 整场，每桶一片，顺时针从顶部开始 ──
  const N = Math.max(arr.length, 48);
  const barMax = hero ? Math.max(R * 0.17, 9) : Math.max(R * 0.17, 4);
  const rIn = R - barMax;
  const segArc = (Math.PI * 2) / N;
  const slices: ReactElement[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const hr = arr.length
      ? (arr[Math.min(arr.length - 1, Math.floor(t * arr.length))] ?? null)
      : null;
    const f = relFrac(hr);
    // 无心率数据：确定性伪随机高低，不冒充真实数据
    const ff =
      f ??
      0.3 +
        0.55 *
          Math.abs(
            Math.sin(i * 2.399 + (activity.run_id % 17)) * Math.cos(i * 0.7)
          );
    const h = barMax * (0.1 + 0.9 * ff);
    const a0 = -Math.PI / 2 + i * segArc; // 顶部顺时针
    slices.push(
      <path
        key={i}
        d={sectorPath(
          c,
          c,
          rIn,
          rIn + Math.max(h, 1),
          a0 + segArc * 0.18,
          a0 + segArc * 0.82
        )}
        fill={color}
        opacity={0.28 + 0.68 * ff}
      />
    );
  }

  // ── 内曲线：同一场内的相对高低（0.26–0.95 半径），70 bpm 淡圈为基准 ──
  const HR_BASE = 70; // 淡圈基准
  const PULSE_LO = 0.26;
  const PULSE_HI = 0.95;
  const pulseR = rIn - (hero ? 7 : 4);
  const PULSE_N = Math.max(arr.length * 2, 64);
  const pulseRadiusOf = (v: number): number =>
    hasHr
      ? pulseR * (PULSE_LO + (PULSE_HI - PULSE_LO) * ((v - lo) / spread))
      : pulseR * 0.4;
  const rAt = (t: number): number => {
    if (!hasHr) return pulseR * 0.4;
    const x = t * arr.length;
    const i0 = Math.min(arr.length - 1, Math.floor(x));
    const i1 = Math.min(arr.length - 1, i0 + 1);
    const v0 = arr[i0];
    const v1 = arr[i1];
    if (v0 == null && v1 == null) return pulseRadiusOf(lo);
    const a = v0 ?? v1!;
    const b = v1 ?? v0!;
    return pulseRadiusOf(a + (b - a) * (x - i0));
  };
  const pulsePts: string[] = [];
  for (let i = 0; i < PULSE_N; i++) {
    const a = -Math.PI / 2 + (i / PULSE_N) * Math.PI * 2;
    const p = polar(c, c, rAt(i / PULSE_N), a);
    pulsePts.push(`${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
  }
  const pulseD = `M${pulsePts.join('L')}Z`;
  // 70 bpm 淡圈：只在这场心率范围覆盖它时画在对应相对位置
  const baseCircleR =
    hasHr && HR_BASE >= lo - 3 && HR_BASE <= hi + 3
      ? pulseRadiusOf(HR_BASE)
      : null;

  // ── 核心：种子点 + 每满一小时一圈 ──
  const dotR = hero ? 3 : 2;
  const coreRings = Math.max(2, Math.round(hours));
  const coreOuter = (baseCircleR ?? pulseR * PULSE_LO) * 0.72;
  const coreEls: ReactElement[] = [];
  for (let k = coreRings; k >= 1; k--) {
    coreEls.push(
      <circle
        key={k}
        cx={c}
        cy={c}
        r={dotR + ((coreOuter - dotR) / coreRings) * k}
        fill="none"
        stroke={color}
        strokeWidth={0.9}
        opacity={0.5}
      />
    );
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${activity.name} 会话时钟`}
      style={{ color, overflow: 'visible' }}
    >
      <g className={glow ? 'ed-glyph-glow' : undefined}>
        {slices}
        {baseCircleR != null && (
          <circle
            cx={c}
            cy={c}
            r={baseCircleR}
            fill="none"
            stroke={color}
            strokeWidth={hero ? 1 : 0.7}
            opacity={0.28}
          />
        )}
        <path
          d={pulseD}
          fill={color}
          fillOpacity={0.1}
          stroke={color}
          strokeWidth={hero ? 1.8 : 1.1}
          strokeOpacity={0.95}
          strokeLinejoin="round"
        />
      </g>
      {coreEls}
      <circle cx={c} cy={c} r={dotR} fill={color} />
    </svg>
  );
}

/**
 * 会话图形 —— 编辑主题的签名视觉：
 *  - 有 GPS：轨迹按等比投影画成"路线形状"（route shape）
 *  - 无 GPS：会话时钟（session clock）
 */
export const SessionGlyph = memo(function SessionGlyph({
  activity,
  size = 84,
  glow = false,
  hero = false,
}: GlyphProps) {
  const sport = sportOf(activity);
  const color = sportColor(sport);
  const track = trackOf(activity);
  const strokeWidth = hero ? 3 : 2.2;
  const pad = hero ? 10 : 7;

  if (track && track.length >= 2) {
    const { d, points } = trackPath(track, size, pad);
    const startPt = points[0];
    const endPt = points[points.length - 1];
    const isLoop =
      Math.hypot(startPt.lat - endPt.lat, startPt.lng - endPt.lng) <
      size * 0.02;
    return (
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${activity.name} 路线`}
        style={{ color, overflow: 'visible' }}
      >
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={glow ? 'ed-glyph-glow' : undefined}
        />
        {/* 起点：白点 + 细环（对齐参考站的可见起点标记） */}
        <circle
          cx={startPt.lat}
          cy={startPt.lng}
          r={hero ? 4.4 : 3}
          fill="#f0efec"
        />
        <circle
          cx={startPt.lat}
          cy={startPt.lng}
          r={hero ? 6 : 4.2}
          fill="none"
          stroke="#f0efec"
          strokeWidth={hero ? 1.4 : 1}
          opacity={0.55}
        />
        {/* 终点：详情页大图才画（环线共用起终点时只画一个），网格瓦片只留起点 */}
        {hero &&
          (isLoop ? (
            <circle
              cx={endPt.lat}
              cy={endPt.lng}
              r={2.6}
              fill={color}
              stroke="#f0efec"
              strokeWidth={1}
            />
          ) : (
            <circle
              cx={endPt.lat}
              cy={endPt.lng}
              r={2.8}
              fill="#f0efec"
              opacity={0.9}
            />
          ))}
      </svg>
    );
  }

  return (
    <SessionClock
      activity={activity}
      size={size}
      hero={hero}
      glow={glow}
      color={color}
    />
  );
});

/** 路线小缩略图（Latest / Records 卡片用） */
/** 会话时钟图例（详情页用，对齐参考站的 OUTER RING / INNER CURVE / CORE 说明） */
export function SessionClockLegend({
  color,
  hours,
  durationLabel,
}: {
  color: string;
  hours: number;
  durationLabel: string;
}) {
  return (
    <div className="ed-clock-legend">
      <div className="row">
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
          {Array.from({ length: 18 }).map((_, i) => {
            const a = -Math.PI / 2 + (i / 18) * Math.PI * 2;
            const f = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7));
            const r0 = 6.5;
            const r1 = r0 + 3.6 * f;
            const p0 = polar(11, 11, r0, a + 0.05);
            const p1 = polar(11, 11, r1, a + 0.05);
            const p2 = polar(11, 11, r1, a + 0.24);
            const p3 = polar(11, 11, r0, a + 0.24);
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
      <div className="row">
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
      <div className="row">
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
  const track = trackOf(activity);
  const color = sportColor(sportOf(activity));
  if (!track || track.length < 2) {
    // 无 GPS：小号会话时钟
    const s = Math.min(width, height) - 6;
    return (
      <svg width={width} height={height} role="img" aria-label={activity.name}>
        <g transform={`translate(${(width - s) / 2} ${(height - s) / 2})`}>
          <SessionClock
            activity={activity}
            size={s}
            hero={false}
            glow={false}
            color={color}
          />
        </g>
      </svg>
    );
  }
  const size = Math.max(width, height);
  const { d } = trackPath(track, size, 8);
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
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`translate(${(size - width) / 2} ${Math.max((size - height) / 2, 0)})`}
      />
    </svg>
  );
});
