import type { Activity } from '@/types';
import { parseMovingTime } from '@/core/hooks/useActivities';

// ── 运动类型归类 ─────────────────────────────────────────────────────────────
// Strava 的 type 字段五花八门，这里统一映射到 9 个规范运动，
// 配色取自 activities.geekplux.com 的设计 token。

export type SportKey =
  | 'run'
  | 'hike'
  | 'ride'
  | 'swim'
  | 'climb'
  | 'tennis'
  | 'strength'
  | 'ski'
  | 'other';

export interface SportMeta {
  key: SportKey;
  zh: string;
  en: string;
  color: string;
}

export const SPORTS: Record<SportKey, SportMeta> = {
  run: { key: 'run', zh: '跑步', en: 'Run', color: '#d95926' },
  hike: { key: 'hike', zh: '徒步', en: 'Hike', color: '#c98500' },
  ride: { key: 'ride', zh: '骑行', en: 'Ride', color: '#199e70' },
  swim: { key: 'swim', zh: '游泳', en: 'Swim', color: '#3987e5' },
  climb: { key: 'climb', zh: '攀岩', en: 'Climb', color: '#d55181' },
  tennis: { key: 'tennis', zh: '网球', en: 'Tennis', color: '#008300' },
  strength: { key: 'strength', zh: '力量', en: 'Strength', color: '#9085e9' },
  ski: { key: 'ski', zh: '滑雪', en: 'Ski', color: '#4da3c7' },
  other: { key: 'other', zh: '其他', en: 'Other', color: '#8c8b85' },
};

const STRAVA_TYPE_TO_SPORT: Record<string, SportKey> = {
  Run: 'run',
  TrailRun: 'run',
  Treadmill: 'run',
  VirtualRun: 'run',
  Hike: 'hike',
  Walk: 'hike',
  Snowshoe: 'hike',
  Ride: 'ride',
  VirtualRide: 'ride',
  GravelRide: 'ride',
  MountainBikeRide: 'ride',
  EBikeRide: 'ride',
  Handcycle: 'ride',
  Velomobile: 'ride',
  Swim: 'swim',
  RockClimbing: 'climb',
  IceClimbing: 'climb',
  AlpineClimbing: 'climb',
  Tennis: 'tennis',
  WeightTraining: 'strength',
  Workout: 'strength',
  Crossfit: 'strength',
  HIIT: 'strength',
  Yoga: 'strength',
  Pilates: 'strength',
  Core: 'strength',
  StairStepper: 'strength',
  StepMill: 'strength',
  Elliptical: 'strength',
  AlpineSki: 'ski',
  NordicSki: 'ski',
  BackcountrySki: 'ski',
  Snowboard: 'ski',
  Rowing: 'other',
  Kayaking: 'other',
  Canoeing: 'other',
  Skateboard: 'other',
  InlineSkate: 'other',
  IceSkate: 'other',
  Football: 'other',
  Soccer: 'other',
  Basketball: 'other',
  Badminton: 'other',
  Golf: 'other',
  Surfing: 'other',
  Windsurf: 'other',
  Kitesurf: 'other',
  Dance: 'other',
  Pickleball: 'tennis',
  Squash: 'tennis',
  Racquetball: 'tennis',
  TableTennis: 'tennis',
};

export function sportOf(activity: Activity): SportKey {
  return (
    STRAVA_TYPE_TO_SPORT[activity.type] ??
    STRAVA_TYPE_TO_SPORT[activity.subtype ?? ''] ??
    'other'
  );
}

export const sportColor = (key: SportKey): string => SPORTS[key].color;

// ── 基础数值 ─────────────────────────────────────────────────────────────────

export const activitySeconds = (a: Activity): number =>
  parseMovingTime(a.moving_time);

export const activityKm = (meters: number): number => meters / 1000;

export const activityKmOf = (a: Activity): number => a.distance / 1000;

/** local 时间字符串 → Date（避免 Safari 对 "YYYY-MM-DD HH:MM:SS" 的解析差异） */
export function localDate(a: Activity): Date {
  const m = a.start_date_local.match(
    /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/
  );
  if (!m) return new Date(a.start_date_local);
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

export const activityYear = (a: Activity): number => localDate(a).getFullYear();

/** 配速 min/km（跑步类），无效返回 null */
export function paceSecPerKm(a: Activity): number | null {
  if (a.distance < 100) return null;
  const secs = activitySeconds(a);
  if (!secs) return null;
  return secs / activityKmOf(a);
}

export const fmtPace = (secPerKm: number | null): string => {
  if (secPerKm == null || !Number.isFinite(secPerKm)) return '--';
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** "H:MM:SS" / "1 day, HH:MM:SS" → "H:MM"（小时超过 99 也不再带天） */
export function fmtDuration(seconds: number): string {
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export const fmtKm = (meters: number): string =>
  meters >= 1000 ? formatInt(meters / 1000) : `${Math.round(meters)} m`;

export function formatInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** 心率五区间（参考站的 zone 配色），返回 zone 1..5 */
export function hrZone(hr: number | null): number | null {
  if (hr == null) return null;
  if (hr < 100) return 1;
  if (hr < 120) return 2;
  if (hr < 140) return 3;
  if (hr < 160) return 4;
  return 5;
}

export const ZONE_COLORS: Record<number, string> = {
  1: '#66463d',
  2: '#91503a',
  3: '#bc5d38',
  4: '#e27544',
  5: '#ffa884',
};

// ── 聚合 ─────────────────────────────────────────────────────────────────────

export interface Totals {
  sessions: number;
  km: number;
  hours: number;
  climb: number;
  activeDays: number;
}

export function totalsOf(activities: Activity[]): Totals {
  const days = new Set<string>();
  let km = 0;
  let hours = 0;
  let climb = 0;
  for (const a of activities) {
    days.add(a.start_date_local.slice(0, 10));
    km += a.distance / 1000;
    hours += activitySeconds(a) / 3600;
    climb += a.elevation_gain ?? 0;
  }
  return {
    sessions: activities.length,
    km,
    hours,
    climb,
    activeDays: days.size,
  };
}

export interface SportStat {
  sport: SportKey;
  sessions: number;
  hours: number;
  km: number;
  climb: number;
}

/** 按运动聚合，时长降序，other 恒排最后 */
export function bySport(activities: Activity[]): SportStat[] {
  const map = new Map<SportKey, SportStat>();
  for (const a of activities) {
    const sport = sportOf(a);
    const stat = map.get(sport) ?? {
      sport,
      sessions: 0,
      hours: 0,
      km: 0,
      climb: 0,
    };
    stat.sessions += 1;
    stat.hours += activitySeconds(a) / 3600;
    stat.km += a.distance / 1000;
    stat.climb += a.elevation_gain ?? 0;
    map.set(sport, stat);
  }
  return [...map.values()].sort((x, y) => {
    if (x.sport === 'other') return 1;
    if (y.sport === 'other') return -1;
    return y.hours - x.hours;
  });
}

export const availableYears = (activities: Activity[]): number[] =>
  [...new Set(activities.map(activityYear))].sort((a, b) => b - a);

/** 同一年里，截至当天“同一天”为止的记录（用于年初至今对比） */
export function samePeriodOf(word: Activity[], year: number): Activity[] {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return word.filter((a) => {
    const d = localDate(a);
    return d.getFullYear() === year && d < cutoff;
  });
}

/** 连续活跃天数（最长 streak）与最长间隔 */
export function streaks(activities: Activity[]): {
  longestStreak: number;
  longestGap: number;
} {
  const days = [
    ...new Set(activities.map((a) => a.start_date_local.slice(0, 10))),
  ].sort();
  let longestStreak = 0;
  let longestGap = 0;
  let run = 0;
  let prev: number | null = null;
  for (const day of days) {
    const t = new Date(day + 'T00:00:00').getTime();
    if (prev != null) {
      const diff = Math.round((t - prev) / 86400000);
      if (diff === 1) run += 1;
      else {
        longestGap = Math.max(longestGap, diff - 1);
        run = 1;
      }
    } else {
      run = 1;
    }
    longestStreak = Math.max(longestStreak, run);
    prev = t;
  }
  return { longestStreak, longestGap };
}

export interface MonthBar {
  key: string; // "2026-04"
  year: number;
  month: number;
  /** 每种运动的时长（小时），按 SPORT 顺序 */
  bySport: Partial<Record<SportKey, number>>;
  hours: number;
}

/** 自最早活动起，每个月的按运动时长柱 */
export function monthlyBars(activities: Activity[]): MonthBar[] {
  const map = new Map<string, MonthBar>();
  for (const a of activities) {
    const d = localDate(a);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bar = map.get(key) ?? {
      key,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      bySport: {},
      hours: 0,
    };
    const sport = sportOf(a);
    const h = activitySeconds(a) / 3600;
    bar.bySport[sport] = (bar.bySport[sport] ?? 0) + h;
    bar.hours += h;
    map.set(key, bar);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}
