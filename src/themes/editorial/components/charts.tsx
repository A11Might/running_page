import { useMemo, useRef, useState } from 'react';
import type { Activity } from '@/types';
import {
  activitySeconds,
  activityYear,
  fmtPace,
  localDate,
  monthlyBars,
  paceSecPerKm,
  SPORTS,
  sportColor,
  sportOf,
  type MonthBar,
  type SportKey,
} from '../lib/data';
import { trackPathBoxPoints, trackOf } from '../lib/track';

// ── 运动占比堆叠条 ───────────────────────────────────────────────────────────

export function SportBar({
  activities,
  height = 8,
}: {
  activities: Activity[];
  height?: number;
}) {
  const stats = useMemo(() => {
    const map = new Map<SportKey, number>();
    for (const a of activities) {
      const s = sportOf(a);
      map.set(s, (map.get(s) ?? 0) + activitySeconds(a) / 3600);
    }
    return [...map.entries()].sort((x, y) => {
      if (x[0] === 'other') return 1;
      if (y[0] === 'other') return -1;
      return y[1] - x[1];
    });
  }, [activities]);
  const total = stats.reduce((s, [, h]) => s + h, 0) || 1;
  if (!activities.length) return null;
  return (
    <div
      className="ed-sportbar"
      role="img"
      aria-label={stats
        .map(([s, h]) => `${SPORTS[s].zh} ${Math.round(h)} 小时`)
        .join('，')}
      style={{ height }}
    >
      {stats.map(([s, h]) => (
        <i
          key={s}
          style={{ width: `${(h / total) * 100}%`, background: sportColor(s) }}
          title={`${SPORTS[s].zh} ${Math.round(h)} h`}
        />
      ))}
    </div>
  );
}

export function SportLegend({ activities }: { activities: Activity[] }) {
  const stats = useMemo(() => {
    const map = new Map<SportKey, number>();
    for (const a of activities) {
      const s = sportOf(a);
      map.set(s, (map.get(s) ?? 0) + activitySeconds(a) / 3600);
    }
    return [...map.entries()].sort((x, y) => {
      if (x[0] === 'other') return 1;
      if (y[0] === 'other') return -1;
      return y[1] - x[1];
    });
  }, [activities]);
  if (!stats.length) return null;
  return (
    <div className="ed-legend">
      {stats.map(([s, h]) => (
        <span key={s}>
          <span className="dot" style={{ background: sportColor(s) }} />
          {SPORTS[s].zh} {h >= 10 ? Math.round(h) : h.toFixed(1)} h
        </span>
      ))}
    </div>
  );
}

// ── 年初至今累计曲线（step line）─────────────────────────────────────────────

const MONTHS_SHORT = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
];

/** 一年的 [dayOfYear, hours] 阶梯数据 */
function cumulativeSeries(activities: Activity[], year: number) {
  const byDay = new Map<number, number>();
  const start = new Date(year, 0, 1).getTime();
  for (const a of activities) {
    const d = localDate(a);
    if (d.getFullYear() !== year) continue;
    const day = Math.floor((d.getTime() - start) / 86400000);
    byDay.set(day, (byDay.get(day) ?? 0) + activitySeconds(a) / 3600);
  }
  const daysInYear = Math.round(
    (new Date(year + 1, 0, 1).getTime() - start) / 86400000
  );
  const pts: [number, number][] = [];
  let acc = 0;
  for (let day = 0; day <= daysInYear; day++) {
    acc += byDay.get(day) ?? 0;
    pts.push([day, acc]);
  }
  return pts;
}

export function YearToDateChart({
  activities,
  focusYear,
}: {
  activities: Activity[];
  focusYear: number;
}) {
  const W = 1200;
  const H = 420;
  const PAD_L = 56;
  const PAD_R = 96;
  const PAD_T = 20;
  const PAD_B = 34;
  const years = useMemo(
    () => [...new Set(activities.map(activityYear))].sort((a, b) => a - b),
    [activities]
  );
  const series = useMemo(
    () => years.map((y) => ({ year: y, pts: cumulativeSeries(activities, y) })),
    [activities, years]
  );
  const maxHours = Math.max(
    ...series.map((s) => s.pts[s.pts.length - 1][1]),
    10
  );
  const yMax = Math.ceil(maxHours / 40) * 40 || 40;
  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const yearLen = (y: number) => (isLeap(y) ? 366 : 365);
  const x = (day: number, year: number) =>
    PAD_L + (day / yearLen(year)) * (W - PAD_L - PAD_R);
  const y = (h: number) => PAD_T + (1 - h / yMax) * (H - PAD_T - PAD_B);

  const now = new Date();
  const todayDoy =
    Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000
    ) + 1;

  // 结尾标签防重叠：自上而下（结束值降序 = 像素 y 升序）依次排开
  const ends = series
    .map((s) => ({ year: s.year, hours: s.pts[s.pts.length - 1][1] }))
    .sort((a, b) => b.hours - a.hours);
  const endLabelY = new Map<number, number>();
  let prevLabelY = -Infinity;
  for (const e of ends) {
    const yy = Math.max(y(e.hours), prevLabelY + 16);
    endLabelY.set(e.year, yy);
    prevLabelY = yy;
  }

  return (
    <svg
      className="ed-chart-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`年初至今累计小时曲线，聚焦 ${focusYear} 年`}
    >
      {/* 网格与轴 */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={y(yMax * f)}
            y2={y(yMax * f)}
            stroke="#1e1f23"
            strokeWidth={1}
          />
          <text
            x={PAD_L - 8}
            y={y(yMax * f) + 3}
            textAnchor="end"
            fontSize={10}
            fill="#55565c"
          >
            {Math.round(yMax * f)} h
          </text>
        </g>
      ))}
      {MONTHS_SHORT.map((m, i) => (
        <text
          key={m}
          x={x(
            Math.min(
              329,
              [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][i]
            ),
            focusYear
          )}
          y={H - 10}
          fontSize={10.5}
          fill="#55565c"
          textAnchor={i === 0 ? 'start' : 'middle'}
        >
          {m}
        </text>
      ))}
      {/* 今日虚线 */}
      {now.getFullYear() === focusYear && (
        <line
          x1={x(todayDoy, focusYear)}
          x2={x(todayDoy, focusYear)}
          y1={PAD_T}
          y2={H - PAD_B}
          stroke="#55565c"
          strokeWidth={1}
          strokeDasharray="3 4"
        />
      )}
      {/* 每年一条阶梯线 */}
      {series.map(({ year, pts }) => {
        const focus = year === focusYear;
        let d = '';
        let prevX = x(pts[0][0], year);
        let prevY = y(pts[0][1]);
        d += `M${prevX.toFixed(1)} ${prevY.toFixed(1)}`;
        for (let i = 1; i < pts.length; i++) {
          const px = x(pts[i][0], year);
          const py = y(pts[i][1]);
          d += `H${px.toFixed(1)}V${py.toFixed(1)}`;
          prevX = px;
          prevY = py;
        }
        const end = pts[pts.length - 1][1];
        return (
          <g key={year}>
            <path
              d={d}
              fill="none"
              stroke={focus ? '#f0efec' : '#3a3b40'}
              strokeWidth={focus ? 2.2 : 1.1}
            />
            {focus && <circle cx={prevX} cy={prevY} r={3} fill="#f0efec" />}
            <text
              x={W - PAD_R + 10}
              y={(endLabelY.get(year) ?? y(end)) + 3}
              fontSize={11}
              fill={focus ? '#f0efec' : '#55565c'}
              fontWeight={focus ? 700 : 400}
            >
              {year} · {Math.round(end)} h
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── 月度堆叠柱（Am I doing more?）────────────────────────────────────────────

export function MonthlyBarsChart({
  activities,
  focusYear,
}: {
  activities: Activity[];
  focusYear: number;
}) {
  const bars = useMemo(() => monthlyBars(activities), [activities]);
  const [hover, setHover] = useState<MonthBar | null>(null);
  const W = 1200;
  const H = 380;
  const PAD_L = 44;
  const PAD_B = 30;
  const PAD_T = 26;
  const PAD_R = 12;
  const maxHours = Math.max(...bars.map((b) => b.hours), 1);
  const yMax = Math.ceil(maxHours / 5) * 5 || 5;
  const slot = (W - PAD_L - PAD_R) / bars.length;
  const barW = Math.min(slot * 0.62, 26);
  const y = (h: number) => PAD_T + (1 - h / yMax) * (H - PAD_T - PAD_B);

  // 12 个月滚动均值线
  const avgLine = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i < bars.length; i++) {
      const from = Math.max(0, i - 11);
      const window = bars.slice(from, i + 1);
      const avg = window.reduce((s, b) => s + b.hours, 0) / window.length;
      const cx = PAD_L + slot * i + slot / 2;
      pts.push(
        `${pts.length ? 'L' : 'M'}${cx.toFixed(1)} ${y(avg).toFixed(1)}`
      );
    }
    return pts.join('');
  }, [bars, slot]);

  const sportsInData = useMemo(() => {
    const set = new Set<SportKey>();
    bars.forEach((b) =>
      Object.keys(b.bySport).forEach((s) => set.add(s as SportKey))
    );
    return [...set];
  }, [bars]);

  return (
    <>
      <svg
        className="ed-chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="每月运动小时数堆叠柱状图"
        onMouseLeave={() => setHover(null)}
      >
        {[0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(yMax * f)}
              y2={y(yMax * f)}
              stroke="#1e1f23"
            />
            <text
              x={PAD_L - 8}
              y={y(yMax * f) + 3}
              textAnchor="end"
              fontSize={10}
              fill="#55565c"
            >
              {Math.round(yMax * f)} h
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const focus = b.year === focusYear;
          const cx = PAD_L + slot * i + slot / 2;
          let acc = 0;
          const rects = sportsInData.map((s) => {
            const h = b.bySport[s] ?? 0;
            if (h <= 0) return null;
            const y1 = y(acc + h);
            const rh = y(acc) - y(acc + h);
            acc += h;
            return (
              <rect
                key={s}
                x={cx - barW / 2}
                y={y1}
                width={barW}
                height={Math.max(rh, 0.5)}
                fill={sportColor(s)}
                opacity={focus ? 0.92 : 0.32}
              />
            );
          });
          return (
            <g key={b.key} onMouseEnter={() => setHover(b)}>
              {rects}
              <rect
                x={PAD_L + slot * i}
                y={PAD_T - 6}
                width={slot}
                height={H - PAD_T - PAD_B + 6}
                fill="transparent"
              />
              {(i % Math.ceil(bars.length / 14) === 0 ||
                i === bars.length - 1) && (
                <text
                  x={cx}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize={9.5}
                  fill="#55565c"
                >
                  {String(b.month).padStart(2, '0')}
                  {b.month === 1 || i === 0
                    ? ` '${String(b.year).slice(2)}`
                    : ''}
                </text>
              )}
            </g>
          );
        })}
        <path
          d={avgLine}
          fill="none"
          stroke="#f0efec"
          strokeWidth={1.6}
          opacity={0.9}
        />
      </svg>
      <div className="ed-chart-sub" style={{ minHeight: 18 }}>
        {hover
          ? `${hover.year}年${hover.month}月 · 共 ${hover.hours.toFixed(1)} 小时`
          : `${focusYear} · 悬停查看某月`}
      </div>
    </>
  );
}

// ── 配速 × 距离散点 ──────────────────────────────────────────────────────────

export function PaceScatterChart({
  activities,
  focusYear,
}: {
  activities: Activity[];
  focusYear: number;
}) {
  const points = useMemo(
    () =>
      activities
        .filter(
          (a) =>
            a.type === 'Run' || a.type === 'TrailRun' || a.type === 'VirtualRun'
        )
        .map((a) => ({ a, pace: paceSecPerKm(a), km: a.distance / 1000 }))
        .filter(
          (p) => p.pace != null && p.km >= 0.8 && activitySeconds(p.a) >= 300
        ) as { a: Activity; pace: number; km: number }[],
    [activities]
  );
  const [hover, setHover] = useState<{
    a: Activity;
    pace: number;
    km: number;
  } | null>(null);

  const W = 1200;
  const H = 470;
  const PAD_L = 78;
  const PAD_R = 30;
  const PAD_T = 26;
  const PAD_B = 48;
  if (!points.length) return null;

  const paces = points.map((p) => p.pace).sort((x, y2) => x - y2);
  const paceLo = Math.max(
    Math.floor((paces[Math.floor(paces.length * 0.05)] - 45) / 60) * 60,
    180
  );
  const paceHi =
    Math.ceil((paces[Math.floor(paces.length * 0.95)] + 45) / 60) * 60;
  const kmLo = 1;
  const kmHi = Math.max(...points.map((p) => p.km)) * 1.15;

  const x = (km: number) =>
    PAD_L +
    ((Math.log10(km) - Math.log10(kmLo)) /
      (Math.log10(kmHi) - Math.log10(kmLo))) *
      (W - PAD_L - PAD_R);
  const y = (pace: number) =>
    PAD_T + ((pace - paceLo) / (paceHi - paceLo)) * (H - PAD_T - PAD_B);

  // 典型值（中位数，仅跑步）
  const runs = points.filter((p) => p.a.type === 'Run');
  const med = (arr: number[]) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const typicalKm = med(runs.map((p) => p.km));
  const typicalPace = med(runs.map((p) => p.pace));

  const paceTicks: number[] = [];
  const tickStep = paceHi - paceLo > 720 ? 120 : 60;
  for (let p = paceLo; p <= paceHi; p += tickStep) paceTicks.push(p);
  const kmTicks = [1, 2, 5, 10, 21.0975, 42.195].filter((k) => k <= kmHi);
  const kmTickLabel = (k: number) =>
    k === 21.0975 ? '半马' : k === 42.195 ? '全马' : `${k} km`;

  return (
    <>
      <svg
        className="ed-chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="跑步距离与配速散点图，距离为对数刻度"
        onMouseLeave={() => setHover(null)}
      >
        {paceTicks.map((p) => (
          <g key={p}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(p)}
              y2={y(p)}
              stroke="#1e1f23"
            />
            <text
              x={PAD_L - 10}
              y={y(p) + 3}
              textAnchor="end"
              fontSize={10.5}
              fill="#55565c"
            >
              {fmtPace(p)} /km
            </text>
          </g>
        ))}
        {kmTicks.map((k) => (
          <text
            key={k}
            x={x(k)}
            y={H - PAD_B + 18}
            textAnchor="middle"
            fontSize={10.5}
            fill="#55565c"
          >
            {kmTickLabel(k)}
          </text>
        ))}
        <text x={PAD_L} y={H - 8} fontSize={10} fill="#55565c">
          ← 更短
        </text>
        <text
          x={W - PAD_R}
          y={H - 8}
          textAnchor="end"
          fontSize={10}
          fill="#55565c"
        >
          更远 →
        </text>
        <text
          x={(PAD_L + W - PAD_R) / 2}
          y={H - PAD_B + 34}
          textAnchor="middle"
          fontSize={10.5}
          fill="#8c8b85"
          letterSpacing="2"
        >
          距离 · 对数刻度
        </text>
        {/* 典型值十字虚线 */}
        {typicalKm && typicalPace && (
          <>
            <line
              x1={x(typicalKm)}
              x2={x(typicalKm)}
              y1={PAD_T}
              y2={H - PAD_B}
              stroke="#8c8b85"
              strokeDasharray="2 4"
              opacity={0.7}
            />
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(typicalPace)}
              y2={y(typicalPace)}
              stroke="#8c8b85"
              strokeDasharray="2 4"
              opacity={0.7}
            />
          </>
        )}
        {points.map(({ a, pace, km }) => {
          const focus = activityYear(a) === focusYear;
          return (
            <circle
              key={a.run_id}
              cx={x(km)}
              cy={y(pace)}
              r={hover?.a.run_id === a.run_id ? 6.5 : focus ? 6 : 3.6}
              fill={focus ? sportColor('run') : '#3a3b40'}
              stroke={focus ? '#f0efec' : 'none'}
              strokeWidth={1.2}
              opacity={focus ? 1 : 0.75}
              onMouseEnter={() => setHover({ a, pace, km })}
              style={{ cursor: 'default' }}
            />
          );
        })}
      </svg>
      <div className="ed-chart-sub" style={{ minHeight: 18 }}>
        {hover
          ? `${localDate(hover.a).toLocaleDateString('zh-CN')} · ${hover.a.name} · ${hover.km.toFixed(1)} km · ${fmtPace(hover.pace)} /km`
          : `${focusYear} 年的跑步 · 悬停查看某次记录`}
      </div>
    </>
  );
}

// ── 轨迹海报（详情页大图，带描线动画 + 与高程联动的 scrub 点）───────────────

export function RoutePoster({
  activity,
  size = 460,
  scrubFraction,
}: {
  activity: Activity;
  size?: number;
  scrubFraction?: number | null;
}) {
  const track = trackOf(activity);
  const color = sportColor(sportOf(activity));
  if (!track) return null;
  const { d, pts } = trackPathBoxPoints(track, size, size, 26);
  const scrubIdx =
    scrubFraction != null && scrubFraction >= 0 && scrubFraction <= 1
      ? Math.min(
          track.length - 1,
          Math.round(scrubFraction * (track.length - 1))
        )
      : null;
  const scrubPt = scrubIdx != null ? pts[scrubIdx] : null;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${activity.name} 路线海报`}
      style={{ overflow: 'visible' }}
    >
      <path
        d={d}
        fill="none"
        stroke="#1e1f23"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ed-draw-path"
        style={{ ['--dash-len' as string]: '4000' }}
      />
      {scrubPt && (
        <g>
          <circle
            cx={scrubPt.x}
            cy={scrubPt.y}
            r={9}
            fill={color}
            opacity={0.35}
          />
          <circle cx={scrubPt.x} cy={scrubPt.y} r={4.5} fill="#f0efec" />
        </g>
      )}
      <circle
        cx={pts[0].x}
        cy={pts[0].y}
        r={5.5}
        fill="none"
        stroke={color}
        strokeWidth={2}
      />
      <circle
        cx={pts[pts.length - 1].x}
        cy={pts[pts.length - 1].y}
        r={5}
        fill="#f0efec"
      />
    </svg>
  );
}

// ── 心率曲线（详情页，可拖拽播放头，与高程/3D/海报联动）──────────────────────

export function HrChart({
  activity,
  color,
  scrubFraction,
  onScrubFraction,
  elapsedSeconds,
}: {
  activity: Activity;
  color: string;
  /** 0..1 的会话进度播放头；null 无播放头 */
  scrubFraction: number | null;
  onScrubFraction: (frac: number | null) => void;
  elapsedSeconds: number;
}) {
  const series = activity.hr_series ?? [];
  const vals = series.filter((v): v is number => v != null);
  if (vals.length < 6) return null;
  const lo = Math.floor((Math.min(...vals) - 6) / 10) * 10;
  const hi = Math.ceil((Math.max(...vals) + 6) / 10) * 10;
  const W = 1200;
  const H = 190;
  const PAD_L = 56;
  const PAD_R = 16;
  const PAD_T = 14;
  const PAD_B = 26;
  const n = series.length;
  const x = (i: number) => PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) =>
    PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);

  // 高分辨率序列（240 桶）直接折线，保留真实的尖峰起伏
  let line = '';
  for (let i = 0; i < n; i++) {
    const v = series[i];
    if (v == null) continue;
    line += `${line ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
  }
  const area = `${line} L${x(n - 1).toFixed(1)} ${H - PAD_B} L${PAD_L} ${H - PAD_B} Z`;

  // 播放头位置的心率（线性插值）
  const hrAt = (frac: number): number | null => {
    if (!series.length) return null;
    const p = frac * (series.length - 1);
    const i0 = Math.floor(p);
    const i1 = Math.min(series.length - 1, i0 + 1);
    const v0 = series[i0];
    const v1 = series[i1];
    if (v0 == null && v1 == null) return null;
    return (v0 ?? v1)! + ((v1 ?? v0)! - (v0 ?? v1)!) * (p - i0);
  };

  const scrubX =
    scrubFraction != null
      ? PAD_L + Math.min(Math.max(scrubFraction, 0), 1) * (W - PAD_L - PAD_R)
      : null;
  const scrubHr = scrubFraction != null ? hrAt(scrubFraction) : null;
  const scrubTime =
    scrubFraction != null
      ? (() => {
          const total = Math.round((elapsedSeconds / 60) * scrubFraction);
          return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
        })()
      : null;

  // X 轴：钟表时刻（参考站格式），从开跑时刻起算
  const startClock = (() => {
    const m = activity.start_date_local.match(
      /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/
    );
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  })();
  const clockAt = (f: number): string => {
    if (!startClock) {
      const total = Math.round((elapsedSeconds / 60) * f);
      return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
    }
    const d = new Date(startClock.getTime() + elapsedSeconds * 1000 * f);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  const fracFromEvent = (e: React.PointerEvent): number => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    return Math.min(Math.max((vx - PAD_L) / (W - PAD_L - PAD_R), 0), 1);
  };

  const gridTicks: number[] = [];
  const tickStep = Math.max(Math.round((hi - lo) / 4 / 10) * 10, 10);
  for (let v = lo + tickStep; v < hi; v += tickStep) gridTicks.push(v);

  return (
    <svg
      ref={svgRef}
      className="ed-chart-svg ed-hr-chart"
      viewBox={`0 0 ${W} ${H}`}
      style={{ marginTop: 0, touchAction: 'none', cursor: 'crosshair' }}
      role="slider"
      aria-label={`${activity.name} 心率播放头`}
      aria-valuenow={
        scrubFraction != null ? Math.round(scrubFraction * 100) : undefined
      }
      aria-valuetext={
        scrubTime
          ? `${scrubTime}，约 ${scrubHr ? Math.round(scrubHr) : '—'} bpm`
          : '未选择'
      }
      tabIndex={0}
      onPointerDown={(e) => {
        draggingRef.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        onScrubFraction(fracFromEvent(e));
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) onScrubFraction(fracFromEvent(e));
      }}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onScrubFraction(null);
        else if (e.key === 'ArrowLeft')
          onScrubFraction(Math.max((scrubFraction ?? 0) - 0.01, 0));
        else if (e.key === 'ArrowRight')
          onScrubFraction(Math.min((scrubFraction ?? 0) + 0.01, 1));
      }}
    >
      {/* 网格与 Y 轴 */}
      {gridTicks.map((v) => (
        <g key={v}>
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={y(v)}
            y2={y(v)}
            stroke="#1e1f23"
          />
          <text
            x={PAD_L - 8}
            y={y(v) + 3}
            textAnchor="end"
            fontSize={10}
            fill="#55565c"
          >
            {v}
          </text>
        </g>
      ))}
      <path d={area} fill={color} opacity={0.15} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      {/* 播放头 */}
      {scrubX != null && (
        <g>
          <line
            x1={scrubX}
            x2={scrubX}
            y1={PAD_T - 4}
            y2={H - PAD_B}
            stroke="#f0efec"
            strokeWidth={1.5}
          />
          {scrubHr != null && (
            <circle
              cx={scrubX}
              cy={y(scrubHr)}
              r={4.5}
              fill="#f0efec"
              stroke={color}
              strokeWidth={2}
            />
          )}
          {scrubTime && (
            <text
              x={Math.min(scrubX + 8, W - PAD_R - 44)}
              y={PAD_T + 8}
              fontSize={11}
              fill="#f0efec"
              fontFamily="var(--font-mono)"
            >
              {scrubTime}
              {scrubHr != null ? ` · ${Math.round(scrubHr)} bpm` : ''}
            </text>
          )}
        </g>
      )}
      {/* X 轴时间刻度（钟表时刻） */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <text
          key={f}
          x={PAD_L + f * (W - PAD_L - PAD_R)}
          y={H - 8}
          fontSize={10}
          fill="#55565c"
          textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}
        >
          {clockAt(f)}
        </text>
      ))}
    </svg>
  );
}

export function StatBadge({ value, label }: { value: string; label: string }) {
  return (
    <div className="ed-stat-cell">
      <span className="ed-stat-num">{value}</span>
      <span className="ed-stat-label">{label}</span>
    </div>
  );
}
