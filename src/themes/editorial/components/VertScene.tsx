import { useEffect, useRef, useState } from 'react';
import {
  ElevationProfile,
  TerrainView,
  decodeScene,
  TERRAIN_ATTRIBUTION,
  TERRAIN_ATTRIBUTION_LINK,
} from '@geekplux/vert';
import type { Scene } from '@geekplux/vert';
import type { TerrainViewHandle } from '@geekplux/vert';
import '@geekplux/vert/vert.css';
import type { Activity } from '@/types';
import { sportColor, sportOf } from '../lib/data';

/**
 * 从 public/scenes/<run_id>.scene 加载烘焙好的地形场景，
 * 用 @geekplux/vert 渲染 3D 地形 + 高程剖面（可与路线海报联动 scrub）。
 */
export function useVertScene(runId: number): Scene | null | 'missing' {
  const [state, setState] = useState<Scene | null | 'missing'>(null);
  useEffect(() => {
    let alive = true;
    setState(null);
    const base = import.meta.env.BASE_URL.endsWith('/')
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
    fetch(`${base}scenes/${runId}.scene`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.arrayBuffer();
      })
      .then((buf) => {
        if (!alive) return;
        try {
          setState(decodeScene(buf));
        } catch {
          setState('missing');
        }
      })
      .catch(() => {
        if (alive) setState('missing');
      });
    return () => {
      alive = false;
    };
  }, [runId]);
  return state;
}

export function VertScene({
  activity,
  scene,
  scrub,
  onScrub,
}: {
  activity: Activity;
  scene: Scene;
  scrub: number | null;
  onScrub: (m: number | null) => void;
}) {
  const viewRef = useRef<TerrainViewHandle>(null);
  const [flat, setFlat] = useState(false);
  const [night, setNight] = useState(true);
  const sport = sportOf(activity);
  const color = sportColor(sport);

  // 键盘快捷键（对齐参考站）：R 旋转 / F 平面切换
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input,textarea'))
        return;
      if (e.key === 'r' || e.key === 'R') {
        viewRef.current?.rotateBy(Math.PI / 5);
      } else if (e.key === 'f' || e.key === 'F') {
        setFlat((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className={`ed-vert ${night ? '' : 'ed-vert--day'}`}
      style={{ ['--route' as string]: color }}
    >
      <div className="ed-vert-box">
        <TerrainView
          ref={viewRef}
          scene={scene}
          exaggeration={1.6}
          view={flat ? 'flat' : 'oblique'}
          ariaLabel={`${activity.name} 的 3D 地形`}
          scrub={scrub}
          palette={
            night
              ? { surface: '#26282e', ink: '#8f929a' }
              : { surface: '#e6eaee', ink: '#1b2a3a' }
          }
          routePalette={{
            route: color,
            halo: night ? '#f0efec' : '#ffffff',
            ink: night ? '#111214' : '#1b2a3a',
          }}
        />
      </div>
      <div className="ed-vert-controls">
        <button
          className="ed-btn ed-btn--ghost"
          onClick={() => viewRef.current?.rotateBy(Math.PI / 5)}
        >
          ↻ 旋转 (R)
        </button>
        <button
          className="ed-btn ed-btn--ghost"
          onClick={() => setFlat((v) => !v)}
          aria-pressed={flat}
        >
          ⛶ {flat ? '3D 视角' : '平面'} (F)
        </button>
        <button
          className="ed-btn ed-btn--ghost"
          onClick={() => viewRef.current?.resetView()}
        >
          ⟲ 重置
        </button>
        <span className="ed-vert-marks" aria-hidden>
          <span>○ 起点</span>
          <span>◉ 终点</span>
          <span>▲ 最高点</span>
        </span>
      </div>
      <div style={{ marginTop: 18 }}>
        <ElevationProfile
          scene={scene}
          scrub={scrub}
          onScrub={onScrub}
          height={130}
          label={`${activity.name} 高程剖面`}
        />
      </div>
      <div className="ed-vert-actions">
        <button
          className="ed-btn ed-btn--outline"
          onClick={() => setNight((v) => !v)}
          aria-pressed={!night}
        >
          {night ? '☀ 日间模式' : '☾ 夜间模式'}
        </button>
        <a
          className="ed-vert-attribution"
          href={TERRAIN_ATTRIBUTION_LINK.href}
          target="_blank"
          rel="noreferrer"
        >
          高程数据：{TERRAIN_ATTRIBUTION} ↗
        </a>
      </div>
    </div>
  );
}
