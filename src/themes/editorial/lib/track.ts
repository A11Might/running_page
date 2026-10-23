import polyline from '@mapbox/polyline';
import type { Activity } from '@/types';
import { activitySeconds, localDate } from './data';

export interface TrackPoint {
  lat: number;
  lng: number;
}

const trackCache = new Map<number, TrackPoint[]>();

export function trackOf(activity: Activity): TrackPoint[] | null {
  const cached = trackCache.get(activity.run_id);
  if (cached) return cached;
  if (!activity.summary_polyline) return null;
  try {
    const decoded = polyline.decode(activity.summary_polyline) as [
      number,
      number,
    ][];
    if (decoded.length < 2) return null;
    const points = decoded.map(([lat, lng]) => ({ lat, lng }));
    trackCache.set(activity.run_id, points);
    return points;
  } catch {
    return null;
  }
}

/**
 * 把经纬度轨迹投影成 viewBox 内的 SVG path。
 * 等距柱状投影（经度按 cos(lat) 压缩），保持长宽比，留 pad 边距。
 */
export function trackPath(
  points: TrackPoint[],
  size: number,
  pad: number,
  close = false
): { d: string; points: TrackPoint[] } {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const lngMin = Math.min(...lngs);
  const lngMax = Math.max(...lngs);
  const midLat = ((latMin + latMax) / 2) * (Math.PI / 180);
  const cosLat = Math.max(Math.cos(midLat), 0.01);
  const w = Math.max((lngMax - lngMin) * cosLat, 1e-6);
  const h = Math.max(latMax - latMin, 1e-6);
  const scale = (size - pad * 2) / Math.max(w, h);
  const ox = (size - w * scale) / 2;
  const oy = (size - h * scale) / 2;
  const mapped = points.map((p) => ({
    lat: ox + (p.lng - lngMin) * cosLat * scale,
    lng: size - (oy + (p.lat - latMin) * scale), // SVG y 向下
  }));
  let d = '';
  for (let i = 0; i < mapped.length; i++) {
    d += `${i === 0 ? 'M' : 'L'}${mapped[i].lat.toFixed(2)} ${mapped[i].lng.toFixed(2)}`;
    if (i === 0 && close) d += 'Z';
    else if (i < mapped.length - 1) d += ' ';
  }
  return { d, points: mapped };
}

/** 同 trackPath，但适配非正方形框（缩略图用），返回映射后的像素坐标 */
export function trackPathBoxPoints(
  points: TrackPoint[],
  width: number,
  height: number,
  pad = 8
): { d: string; pts: { x: number; y: number }[] } {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const lngMin = Math.min(...lngs);
  const lngMax = Math.max(...lngs);
  const midLat = ((latMin + latMax) / 2) * (Math.PI / 180);
  const cosLat = Math.max(Math.cos(midLat), 0.01);
  const w = Math.max((lngMax - lngMin) * cosLat, 1e-6);
  const h = Math.max(latMax - latMin, 1e-6);
  const scale = Math.min((width - pad * 2) / w, (height - pad * 2) / h);
  const ox = (width - w * scale) / 2;
  const oy = (height - h * scale) / 2;
  const pts = points.map((p) => ({
    x: ox + (p.lng - lngMin) * cosLat * scale,
    y: height - (oy + (p.lat - latMin) * scale),
  }));
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    d += `${i === 0 ? 'M' : 'L'}${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
    if (i < pts.length - 1) d += ' ';
  }
  return { d, pts };
}

/** 同 trackPath，但适配非正方形框（缩略图用） */
export function trackPathBox(
  points: TrackPoint[],
  width: number,
  height: number,
  pad = 8
): string {
  return trackPathBoxPoints(points, width, height, pad).d;
}

// ── 各距离最快一次 ───────────────────────────────────────────────────────────
// 数据里只有折线 + 平均配速，没有逐点时间流，无法算“任意路段内”的
// best effort。这里取"距离 ≥ 目标值的活动里平均配速最快的一次"，
// 诚实近似。

export interface DistanceBest {
  distanceM: number;
  activity: Activity;
  secPerKm: number;
}

export function bestRunForDistance(
  activities: Activity[],
  distanceM: number
): DistanceBest | null {
  let best: DistanceBest | null = null;
  for (const a of activities) {
    if (a.type !== 'Run' && a.type !== 'TrailRun' && a.type !== 'VirtualRun')
      continue;
    if (a.distance < distanceM) continue;
    const secs = activitySeconds(a);
    if (!secs) continue;
    const secPerKm = secs / (a.distance / 1000);
    if (!best || secPerKm < best.secPerKm) {
      best = { distanceM, activity: a, secPerKm };
    }
  }
  return best;
}

export const sortedByDate = (activities: Activity[]): Activity[] =>
  [...activities].sort(
    (a, b) => localDate(a).getTime() - localDate(b).getTime()
  );
