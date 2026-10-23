import { memo, type ReactElement } from 'react';
import type { Activity } from '@/types';
import {
  activitySeconds,
  hrZone,
  sportColor,
  sportOf,
  ZONE_COLORS,
} from '../lib/data';
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

/** 一段圆弧 path（从角 a1 到角 a2） */
function arcPath(cx: number, cy: number, r: number, a1: number, a2: number) {
  const p1 = polar(cx, cy, r, a1);
  const p2 = polar(cx, cy, r, a2);
  const large = a2 - a1 > Math.PI ? 1 : 0;
  return `M${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A${r} ${r} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}

/**
 * 会话时钟 —— 无 GPS 会话的签名视觉（对齐参考站）：
 *  - 外圈「一小时一环」：每环按时间切成小段，颜色 = 该时刻的心率区间
 *  - 中层的「脉搏」：心率随时间起伏的径向形状
 *  - 圆心的同心圆靶心
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
  const R = c - (hero ? 12 : 8);
  const series = (activity.hr_series ?? []).filter(
    (v): v is number => v != null
  );
  const avg = activity.average_heartrate;
  const zone = hrZone(avg);
  const zoneColor = zone ? ZONE_COLORS[zone] : color;

  // ── 一小时一环：每环 24 段，最多 6 环，最后未满一小时按比例画弧 ──
  const SEG_PER_HOUR = 24;
  const MAX_RINGS = 6;
  const totalSegs = Math.max(1, Math.round(hours * SEG_PER_HOUR));
  const rings = Math.min(Math.ceil(totalSegs / SEG_PER_HOUR), MAX_RINGS);
  const segW = hero ? 5 : Math.max(R / 14, 3);
  const ringGap = segW + (hero ? 3.5 : 2.5);
  const hrAt = (t: number): number | null => {
    // t ∈ [0,1) 会话时间进度 → 心率桶
    if (!activity.hr_series?.length) return null;
    const arr = activity.hr_series;
    const idx = Math.min(arr.length - 1, Math.floor(t * arr.length));
    return arr[idx];
  };
  const segments: ReactElement[] = [];
  let drawn = 0;
  for (let ring = 0; ring < rings; ring++) {
    const rr = R - ring * ringGap;
    const segsThisRing = Math.min(
      SEG_PER_HOUR,
      totalSegs - ring * SEG_PER_HOUR
    );
    for (let i = 0; i < segsThisRing; i++) {
      const t = drawn / totalSegs;
      const hr = hrAt(t);
      const z = hr != null ? (hrZone(hr) ?? zone) : zone;
      const zc = z ? ZONE_COLORS[z] : zoneColor;
      const segArc = (Math.PI * 2) / SEG_PER_HOUR;
      const a0 = -Math.PI / 2 + i * segArc;
      segments.push(
        <path
          key={`${ring}-${i}`}
          d={arcPath(c, c, rr, a0 + 0.02, a0 + segArc * 0.68)}
          fill="none"
          stroke={zc}
          strokeWidth={segW}
          opacity={z ? 0.42 + (z / 5) * 0.58 : 0.55}
        />
      );
      drawn++;
    }
  }

  // ── 脉搏：心率随时间起伏的径向闭合形状 ──
  const PULSE_N = hero ? 56 : 40;
  const pulseR = R - rings * ringGap - (hero ? 12 : 7);
  const hrVals = series.length >= 6 ? series : null;
  let lo = Infinity;
  let hi = -Infinity;
  if (hrVals) {
    for (const v of hrVals) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const spread = hrVals ? Math.max(hi - lo, 8) : 0;
  const pulsePts: { x: number; y: number }[] = [];
  for (let i = 0; i < PULSE_N; i++) {
    const a = -Math.PI / 2 + (i / PULSE_N) * Math.PI * 2;
    const t = i / PULSE_N;
    let f: number;
    if (hrVals) {
      const idx = Math.min(hrVals.length - 1, Math.floor(t * hrVals.length));
      f = 0.55 + 0.45 * ((hrVals[idx] - lo) / spread);
    } else {
      // 无心率序列：确定性伪随机起伏，形状仍自然但不冒充真实数据
      f =
        0.72 +
        0.12 * Math.sin(t * Math.PI * 2 * 3 + (activity.run_id % 7)) +
        0.08 * Math.sin(t * Math.PI * 2 * 5 + (activity.run_id % 11));
    }
    pulsePts.push(polar(c, c, pulseR * f, a));
  }
  const pulseD =
    pulsePts
      .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ') + 'Z';

  // ── 圆心靶心 ──
  const dotR = hero ? 3.2 : 2.2;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${activity.name} 会话时钟`}
      style={{ color: zoneColor, overflow: 'visible' }}
    >
      <g className={glow ? 'ed-glyph-glow' : undefined}>
        {segments}
        <path
          d={pulseD}
          fill={zoneColor}
          fillOpacity={0.16}
          stroke={zoneColor}
          strokeWidth={hero ? 1.6 : 1.1}
          strokeOpacity={0.85}
          strokeLinejoin="round"
        />
        {/* 未满一环时的底环刻度 */}
        <circle
          cx={c}
          cy={c}
          r={R}
          fill="none"
          stroke="#1e1f23"
          strokeWidth={segW}
          opacity={0.55}
          strokeDasharray={`${((Math.PI * 2 * R) / SEG_PER_HOUR) * 0.7} ${(Math.PI * 2 * R) / SEG_PER_HOUR}`}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </g>
      <circle
        cx={c}
        cy={c}
        r={dotR * 2.6}
        fill="none"
        stroke="#26272b"
        strokeWidth={1}
      />
      <circle
        cx={c}
        cy={c}
        r={dotR * 1.4}
        fill="none"
        stroke="#26272b"
        strokeWidth={1}
      />
      <circle cx={c} cy={c} r={dotR} fill={zoneColor} />
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
        <circle
          cx={endPt.lat}
          cy={endPt.lng}
          r={hero ? 3.4 : 2.4}
          fill="#f0efec"
          stroke={color}
          strokeWidth={hero ? 1.2 : 1}
        />
        {!isLoop && (
          <circle
            cx={startPt.lat}
            cy={startPt.lng}
            r={hero ? 2.4 : 1.7}
            fill="none"
            stroke={color}
            strokeWidth={1.1}
            opacity={0.9}
          />
        )}
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
