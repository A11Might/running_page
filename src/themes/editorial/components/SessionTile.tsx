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
 * 会话时钟 —— 无 GPS 会话的签名视觉（对齐参考站）：
 *  - 外圈「一小时一环」：环上的径向柱按该时刻心率高低伸缩（高低编码强度），
 *    颜色 = 心率区间
 *  - 中层的「脉搏」：心率随时间起伏的径向形状，波动幅度取该次活动的真实区间
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
  const R = c - (hero ? 10 : 7);
  const arr = activity.hr_series ?? [];
  const vals = arr.filter((v): v is number => v != null);
  const avg = activity.average_heartrate;
  const zone = hrZone(avg);
  const zoneColor = zone ? ZONE_COLORS[zone] : color;
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of vals) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const spread = vals.length ? Math.max(hi - lo, 6) : 0;

  // ── 外圈径向柱：最多 3 环，每环细柱按时间铺满，柱高 = 心率在该次活动里的相对高低 ──
  const SEG_PER_HOUR = 24;
  const MAX_RINGS = 3;
  const totalSegs = Math.max(1, Math.round(hours * SEG_PER_HOUR));
  const rings = Math.min(Math.max(Math.ceil(hours), 1), MAX_RINGS);
  const gap = hero ? 2.5 : 1.5;
  const barMax = Math.max(Math.min(R * 0.13, (R - R * 0.42) / rings - gap), 2);
  const barsPerRing = Math.ceil((totalSegs * 2) / rings); // 细柱：密度翻倍
  const segArc = (Math.PI * 2) / barsPerRing;
  const hrAt = (t: number): number | null => {
    if (!arr.length) return null;
    return arr[Math.min(arr.length - 1, Math.floor(t * arr.length))] ?? null;
  };
  const segments: ReactElement[] = [];
  let drawn = 0;
  for (let ring = 0; ring < rings; ring++) {
    const rIn = R - barMax - ring * (barMax + gap);
    const bars = Math.min(barsPerRing, totalSegs * 2 - ring * barsPerRing);
    // 底环：整圈淡环，未铺满的部分也看得出轨道
    segments.push(
      <circle
        key={`base-${ring}`}
        cx={c}
        cy={c}
        r={rIn + 0.5}
        fill="none"
        stroke="#1e1f23"
        strokeWidth={1}
      />
    );
    for (let i = 0; i < bars; i++) {
      const t = drawn / (totalSegs * 2);
      const hr = hrAt(t);
      const z = hr != null ? (hrZone(hr) ?? zone) : zone;
      const zc = z ? ZONE_COLORS[z] : zoneColor;
      let f: number;
      if (hr != null && vals.length) {
        f = (hr - lo) / spread;
      } else {
        // 无心率序列：确定性伪随机高低，不冒充真实数据
        f =
          0.45 +
          0.3 *
            Math.abs(
              Math.sin(drawn * 2.7 + (activity.run_id % 13)) *
                Math.cos(drawn * 1.3)
            );
      }
      const h = barMax * (0.28 + 0.72 * Math.min(Math.max(f, 0), 1));
      const a0 = -Math.PI / 2 + i * segArc;
      segments.push(
        <path
          key={`${ring}-${i}`}
          d={sectorPath(
            c,
            c,
            rIn,
            rIn + Math.max(h, 1.2),
            a0 + segArc * 0.14,
            a0 + segArc * 0.86
          )}
          fill={zc}
          opacity={0.95}
        />
      );
      drawn++;
    }
  }

  // ── 脉搏：心率随时间起伏的径向形状（直线多边形，波动取真实区间）──
  const pulseR = R - rings * (barMax + gap) - (hero ? 8 : 4);
  const PULSE_N = Math.max(arr.length * 2, 48);
  const pulsePts: { x: number; y: number }[] = [];
  for (let i = 0; i < PULSE_N; i++) {
    const a = -Math.PI / 2 + (i / PULSE_N) * Math.PI * 2;
    const t = i / PULSE_N;
    let f: number;
    if (vals.length >= 6) {
      // 线性插值到 t，保留桶间的斜率起伏
      const x = t * arr.length;
      const i0 = Math.min(arr.length - 1, Math.floor(x));
      const i1 = Math.min(arr.length - 1, i0 + 1);
      const v0 = arr[i0] ?? lo;
      const v1 = arr[i1] ?? v0;
      const v = v0 + (v1 - v0) * (x - i0);
      f = (v - lo) / spread;
    } else {
      f =
        0.5 +
        0.28 * Math.sin(t * Math.PI * 2 * 3 + (activity.run_id % 7)) +
        0.18 * Math.sin(t * Math.PI * 2 * 5 + (activity.run_id % 11));
    }
    f = Math.min(Math.max(f, 0), 1);
    pulsePts.push(polar(c, c, pulseR * (0.42 + 0.56 * f), a));
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
          fillOpacity={0.2}
          stroke={zoneColor}
          strokeWidth={hero ? 1.6 : 1.1}
          strokeOpacity={0.9}
          strokeLinejoin="round"
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
