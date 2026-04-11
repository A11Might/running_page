import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center } from '@react-three/drei';
import * as THREE from 'three';
import styles from './style.module.css';

const MODEL_PATH = '/models/四顶山.glb';
const ENTRANCE_DURATION = 2.0;

function Model() {
  const { scene } = useGLTF(MODEL_PATH);
  return <primitive object={scene} />;
}

useGLTF.preload(MODEL_PATH);

function CameraAnimation({
  onDone,
}: {
  onDone: (target: THREE.Vector3) => void;
}) {
  const { camera, scene } = useThree();
  const phase = useRef<'fit' | 'entrance' | 'idle'>('fit');
  const startTime = useRef(0);
  const center = useRef(new THREE.Vector3());
  const orbitRadius = useRef(0);
  // Start and end in spherical coords (phi=polar from Y+, theta=azimuth)
  const startPhi = useRef(0);
  const endPhi = useRef(0);
  const startTheta = useRef(0);
  const endTheta = useRef(0);

  useFrame(() => {
    if (phase.current === 'fit') {
      const box = new THREE.Box3().setFromObject(scene);
      if (box.isEmpty()) return;

      const c = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
      const dist = maxDim / (2 * Math.tan(fov / 2)) * 1.6;

      center.current.copy(c);
      orbitRadius.current = dist;

      // Start: phi=75° from top (nearly side view), theta=225° (back-left)
      startPhi.current = THREE.MathUtils.degToRad(75);
      startTheta.current = THREE.MathUtils.degToRad(225);
      // End: phi=5° (nearly top-down), theta=0° (aligned with Z axis, straight orientation)
      endPhi.current = THREE.MathUtils.degToRad(5);
      endTheta.current = THREE.MathUtils.degToRad(90);

      // Set initial camera position
      camera.position.set(
        c.x + dist * Math.sin(startPhi.current) * Math.cos(startTheta.current),
        c.y + dist * Math.cos(startPhi.current),
        c.z + dist * Math.sin(startPhi.current) * Math.sin(startTheta.current)
      );
      camera.lookAt(c);

      phase.current = 'entrance';
      startTime.current = performance.now() / 1000;
    }

    if (phase.current === 'entrance') {
      const now = performance.now() / 1000;
      const t = Math.min((now - startTime.current) / ENTRANCE_DURATION, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const phi =
        startPhi.current +
        (endPhi.current - startPhi.current) * eased;
      const theta =
        startTheta.current +
        (endTheta.current - startTheta.current) * eased;
      const r = orbitRadius.current;
      const cx = center.current.x;
      const cy = center.current.y;
      const cz = center.current.z;

      camera.position.set(
        cx + r * Math.sin(phi) * Math.cos(theta),
        cy + r * Math.cos(phi),
        cz + r * Math.sin(phi) * Math.sin(theta)
      );
      camera.lookAt(center.current);

      if (t >= 1) {
        phase.current = 'idle';
        onDone(center.current);
      }
    }
  });

  return null;
}

interface IModelViewerProps {
  onClose: () => void;
}

const ModelViewer = ({ onClose }: IModelViewerProps) => {
  const controlsRef = useRef<any>(null);
  const [controlsEnabled, setControlsEnabled] = useState(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    pointerStart.current = null;
    if (Math.sqrt(dx * dx + dy * dy) < 5) {
      onClose();
    }
  };

  return (
    <div
      className={styles.overlay}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <Suspense
        fallback={
          <div className={styles.loading}>Loading 3D Model...</div>
        }
      >
        <Canvas
          camera={{ position: [0, 10, 60], fov: 75 }}
          className={styles.canvas}
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[50, 50, 50]} intensity={1} />
          <directionalLight position={[-30, -10, -30]} intensity={0.4} />
          <Center>
            <Model />
          </Center>
          <CameraAnimation
            onDone={(target) => {
              const controls = controlsRef.current;
              if (!controls) return;
              controls.target.copy(target);
              controls.update();
              setControlsEnabled(true);
            }}
          />
          <OrbitControls
            ref={controlsRef}
            enabled={controlsEnabled}
            enableDamping
            dampingFactor={0.05}
            minDistance={5}
            maxDistance={200}
          />
        </Canvas>
      </Suspense>
    </div>
  );
};

export default ModelViewer;
