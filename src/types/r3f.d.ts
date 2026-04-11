import type { ThreeElements } from '@react-three/fiber';
import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
