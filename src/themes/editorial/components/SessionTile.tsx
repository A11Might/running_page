import { memo } from 'react';
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

/**
 * 会话图形 —— 编辑主题的签名视觉：
 *  - 有 GPS：轨迹按等比投影画成"路线形状"（route shape）
 *  - 无 GPS：会话时钟（session clock）——外圈每满 1 小时一圈的弧线，
 *    圆心是按心率区间着色的呼吸点
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
        style={
          glow ? { color, overflow: 'visible' } : { color, overflow: 'visible' }
        }
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

  // ── 无 GPS：会话时钟 ──
  const hours = Math.max(activitySeconds(activity) / 3600, 1 / 60);
  const c = size / 2;
  const r = c - pad - 2;
  const zone = hrZone(activity.average_heartrate);
  const zoneColor = zone ? ZONE_COLORS[zone] : color;
  const fills = Math.min(Math.floor(hours), 8);
  const arcs: number[] = [];
  let remaining = hours;
  while (remaining > 0) {
    arcs.push(Math.min(remaining, 1));
    remaining -= 1;
  }
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${activity.name} 会话时钟`}
      style={{ color, overflow: 'visible' }}
    >
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="#26272b"
        strokeWidth={strokeWidth * 0.7}
      />
      {arcs.map((frac, i) => (
        <circle
          key={i}
          cx={c}
          cy={c}
          r={r - i * (strokeWidth + 1.5)}
          fill="none"
          stroke={zoneColor}
          strokeWidth={strokeWidth * 0.9}
          strokeLinecap="round"
          strokeDasharray={`${frac * 2 * Math.PI * (r - i * (strokeWidth + 1.5))} 999`}
          transform={`rotate(-90 ${c} ${c})`}
          opacity={0.55 + 0.45 * Math.min(frac, 1)}
          className={glow ? 'ed-glyph-glow' : undefined}
        />
      ))}
      <circle cx={c} cy={c} r={hero ? 4 : 2.6} fill={zoneColor} opacity={0.9} />
      {fills > 4 && (
        <circle cx={c} cy={c} r={2} fill={zoneColor} opacity={0.35}>
          <animate
            attributeName="r"
            values="2;4;2"
            dur="3s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </svg>
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
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={activity.name}
      >
        <circle
          cx={width / 2}
          cy={height / 2}
          r={9}
          fill="none"
          stroke={color}
          strokeWidth={2.4}
        />
        <circle cx={width / 2} cy={height / 2} r={2.4} fill={color} />
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
