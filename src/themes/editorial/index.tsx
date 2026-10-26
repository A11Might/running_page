import { useEffect, useMemo, useState } from 'react';
import type { Activity } from '@/types';
import { getActivityData } from '@/core/hooks/useActivities';
import { formatInt, totalsOf } from './lib/data';
import { Home } from './pages/Home';
import { Years } from './pages/Years';
import { Progress } from './pages/Progress';
import { Records } from './pages/Records';
import { CalendarPage } from './pages/CalendarPage';
import { ActivityDetail } from './pages/ActivityDetail';
import './styles.css';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/500.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo/800-italic.css';
import '@fontsource/archivo/900-italic.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';

type Route =
  | { page: 'home' }
  | { page: 'years' }
  | { page: 'progress' }
  | { page: 'records' }
  | { page: 'calendar' }
  | { page: 'activity'; runId: number };

function parsePath(): Route {
  const base = import.meta.env.BASE_URL;
  const path = decodeURI(window.location.pathname)
    .slice(base.length)
    .replace(/^\/+|\/+$/g, '');
  if (!path) return { page: 'home' };
  if (path === 'years') return { page: 'years' };
  if (path === 'progress') return { page: 'progress' };
  if (path === 'records') return { page: 'records' };
  if (path === 'calendar') return { page: 'calendar' };
  const m = path.match(/^a\/(\d+)$/);
  if (m) return { page: 'activity', runId: Number(m[1]) };
  return { page: 'home' };
}

const NAV: { key: Route['page']; label: string; path: string }[] = [
  { key: 'home', label: 'Home', path: '' },
  { key: 'years', label: 'Years', path: 'years' },
  { key: 'progress', label: 'Progress', path: 'progress' },
  { key: 'records', label: 'Records', path: 'records' },
  { key: 'calendar', label: 'Calendar', path: 'calendar' },
];

function Editorial() {
  const activities = getActivityData() as Activity[];
  const [route, setRoute] = useState<Route>(parsePath);

  useEffect(() => {
    const onPop = () => setRoute(parsePath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (route.page !== 'activity') document.title = 'Activities';
  }, [route.page]);

  const navigate = (path: string) => {
    const base = import.meta.env.BASE_URL;
    const url = `${base}${path}`;
    window.history.pushState(null, '', url);
    setRoute(parsePath());
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const totals = useMemo(() => totalsOf(activities), [activities]);

  const body = (() => {
    switch (route.page) {
      case 'years':
        return <Years activities={activities} navigate={navigate} />;
      case 'progress':
        return <Progress activities={activities} />;
      case 'records':
        return <Records activities={activities} navigate={navigate} />;
      case 'calendar':
        return <CalendarPage activities={activities} navigate={navigate} />;
      case 'activity':
        return (
          <ActivityDetail
            activities={activities}
            runId={route.runId}
            navigate={navigate}
          />
        );
      default:
        return <Home activities={activities} navigate={navigate} />;
    }
  })();

  return (
    <div className="ed-root">
      <div className="ed-container">
        <nav className="ed-nav" aria-label="Site">
          <a
            className="ed-brand"
            href={import.meta.env.BASE_URL}
            onClick={(e) => {
              e.preventDefault();
              navigate('');
            }}
          >
            KOHATH
          </a>
          <div className="ed-nav-links">
            {NAV.map((item) => (
              <a
                key={item.key}
                href={`${import.meta.env.BASE_URL}${item.path}`}
                className={route.page === item.key ? 'is-active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.path);
                }}
              >
                {item.label}
              </a>
            ))}
            <a
              href="https://a11might.github.io/"
              target="_blank"
              rel="noreferrer"
            >
              Blog ↗
            </a>
          </div>
        </nav>

        <main id="main">{body}</main>

        <footer className="ed-footer">
          <span>
            数据：Strava · 轨迹只保留形状，不保存坐标 · 共{' '}
            {formatInt(totals.sessions)} 次 · {formatInt(totals.km)} km
          </span>
          <span>
            <a
              href="https://github.com/A11Might/running_page"
              target="_blank"
              rel="noreferrer"
            >
              GitHub ↗
            </a>
            <span style={{ margin: '0 10px', color: '#3a3b40' }}>|</span>
            <a
              href="https://github.com/geekplux/vert"
              target="_blank"
              rel="noreferrer"
            >
              3D 地形由 Vert 驱动 ↗
            </a>
          </span>
        </footer>
      </div>
    </div>
  );
}

export default Editorial;
