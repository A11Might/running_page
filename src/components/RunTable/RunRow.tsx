import { useState, lazy, Suspense } from 'react';
import {
  formatPace,
  titleForRun,
  formatRunTime,
  Activity,
  RunIds,
} from '@/utils/utils';
import { SHOW_ELEVATION_GAIN } from '@/utils/const';
import { M_TO_DIST, M_TO_ELEV } from '@/utils/utils';
import styles from './style.module.css';

const ModelViewer = lazy(() => import('@/components/ModelViewer'));

const TYPE_LABELS: Record<string, string> = {
  Run: 'Run',
  Walk: 'Walk',
  Hike: 'Hike',
  Workout: 'Workout',
};

const Icon3D = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3l9 5.25v7.5L12 21l-9-5.25v-7.5L12 3z" />
    <path d="M12 12l9-5.25" />
    <path d="M12 12v9" />
    <path d="M12 12L3 6.75" />
  </svg>
);

interface IRunRowProperties {
  elementIndex: number;
  locateActivity: (_runIds: RunIds) => void;
  run: Activity;
  runIndex: number;
  setRunIndex: (_ndex: number) => void;
}

const RunRow = ({
  elementIndex,
  locateActivity,
  run,
  runIndex,
  setRunIndex,
}: IRunRowProperties) => {
  const [showModel, setShowModel] = useState(false);
  const distance = (run.distance / M_TO_DIST).toFixed(2);
  const paceParts = run.average_speed ? formatPace(run.average_speed) : null;
  const heartRate = run.average_heartrate;
  const runTime = formatRunTime(run.moving_time);
  const isHike = run.type === 'Hike';

  const handleClick = () => {
    if (runIndex === elementIndex) {
      setRunIndex(-1);
      locateActivity([]);
      return;
    }
    setRunIndex(elementIndex);
    locateActivity([run.run_id]);
  };

  const handle3DClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowModel(true);
  };

  return (
    <>
      <tr
        className={`${styles.runRow} ${runIndex === elementIndex ? styles.selected : ''}`}
        key={run.start_date_local}
        onClick={handleClick}
      >
        <td>{titleForRun(run)}</td>
        <td className={styles.typeCell}>
          <span>{TYPE_LABELS[run.type] || run.type}</span>
          {isHike && (
            <button
              className={styles.model3dBtn}
              onClick={handle3DClick}
              title="View 3D Model"
            >
              <Icon3D />
            </button>
          )}
        </td>
        <td>{distance}</td>
        {SHOW_ELEVATION_GAIN && (
          <td>{((run.elevation_gain ?? 0) * M_TO_ELEV).toFixed(1)}</td>
        )}
        {paceParts && <td>{paceParts}</td>}
        <td>{heartRate && heartRate.toFixed(0)}</td>
        <td>{runTime}</td>
        <td className={styles.runDate}>{run.start_date_local}</td>
      </tr>
      {showModel && (
        <Suspense fallback={null}>
          <ModelViewer onClose={() => setShowModel(false)} />
        </Suspense>
      )}
    </>
  );
};

export default RunRow;
