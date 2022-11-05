import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import create from 'zustand';
import { devtools } from 'zustand/middleware';
import './App.css';
import CameraDolly, { getCameraZoom } from './CameraDolly';
import { nanoid } from 'nanoid';
import { Stats } from '@react-three/drei';

/** Constants */
export const LAYER_HEIGHT = 0.5;
const INIT_LAYER_SIDE = 0.75;
const INIT_POSITION_X = { x: -2.5, z: 0 };
const INIT_POSITION_Z = { x: 0, z: -2.5 };
const SPEED = 0.01;
const WIREFRAME = false;
const GRID = false;
export const Y_OFFSET = INIT_LAYER_SIDE / 2;

/** Types */
interface StackState {
  layers: JSX.Element[];
  addLayer: (x: number, z: number, width: number, depth: number) => void;
  nextDirection: 'x' | 'z';
  status: GameStatus;
  setStatus: (status: GameStatus) => void;
  reset: () => void;
}

type GameStatus = 'READY' | 'RUNNING' | 'OVER';

/** Game State */
const initialState: Pick<StackState, 'status' | 'layers' | 'nextDirection'> = {
  status: 'READY',
  layers: [
    <Layer
      key={nanoid()}
      x={0}
      y={Y_OFFSET}
      z={0}
      width={INIT_LAYER_SIDE}
      depth={INIT_LAYER_SIDE}
    />,
  ],
  nextDirection: 'x',
};

export const useStackStore = create<StackState>()(
  devtools((set) => ({
    ...initialState,
    setStatus: (status: GameStatus) => set(() => ({ status })),
    addLayer: (x, z, width, depth) =>
      set((state) => {
        // Determine y position for new layer
        const y = LAYER_HEIGHT * state.layers.length + Y_OFFSET;
        return {
          layers: [
            ...state.layers,
            <Layer
              key={nanoid()}
              x={x}
              y={y}
              z={z}
              width={width}
              depth={depth}
              direction={state.nextDirection}
            />,
          ],
          nextDirection: state.nextDirection === 'x' ? 'z' : 'x',
          status: 'RUNNING',
        };
      }),
    reset: () => set(() => ({ ...initialState })),
  })),
);

interface LayerProps {
  x: number;
  y: number;
  z: number;
  direction?: 'x' | 'z';
  width: number;
  depth: number;
}

function Layer({ x, y, z, width, depth, direction }: LayerProps) {
  const ref = useRef<THREE.Mesh>(null);
  const { layers, status, setStatus } = useStackStore();
  const layerIndex = (y - Y_OFFSET) / LAYER_HEIGHT;
  const isLayerActive = useRef(true);
  const activeMaterial = useMemo(
    () =>
      new THREE.MeshLambertMaterial({ wireframe: WIREFRAME, color: 'green' }),
    [],
  );
  const inactiveMaterial = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        wireframe: WIREFRAME,
        color: `hsl(${250 + layers.length * 4}, 90%, 50%)`,
      }),
    [],
  );

  // Run every time the stack changes
  // Assign materials
  useEffect(() => {
    if (
      !ref.current ||
      !isLayerActive.current ||
      layers.length - layerIndex > 2
    ) {
      return;
    }
    isLayerActive.current = layerIndex > 0 && layers.length - 1 === layerIndex;

    // dont set first layer as active
    if (isLayerActive.current) {
      ref.current.material = activeMaterial;
    } else {
      ref.current.material = inactiveMaterial;
    }
  }, [layers]);

  useFrame(() => {
    if (!ref.current || !isLayerActive.current || status === 'OVER') return;

    // Move layer along x or z axis
    // Set game over if coords go over limit
    const position = ref.current.position;
    const positionAxis = position[direction as keyof typeof position];

    // Move blocks over axis until limit
    if (positionAxis < 5) {
      position.setComponent(
        direction === 'x' ? 0 : 2,
        (positionAxis as number) + SPEED,
      );
    } else {
      // update status only once
      if (status === 'RUNNING') {
        setStatus('OVER');
      }
    }
  });

  // Set first layer as inactive
  // maybe move this to the prep layer function
  useEffect(() => {
    if (ref.current && layerIndex === 0) {
      ref.current.material = inactiveMaterial;
      isLayerActive.current = false;
    }
  }, []);

  return (
    <mesh receiveShadow castShadow ref={ref} position={[x, y, z]}>
      <boxGeometry args={[width, LAYER_HEIGHT, depth]} />
    </mesh>
  );
}

function App() {
  const { reset, status, setStatus, layers, addLayer, nextDirection } =
    useStackStore();
  const groupRef = useRef<THREE.Group>(null);

  const aspect = useMemo(() => window.innerWidth / window.innerHeight, []);
  const width = useMemo(() => 10, []);
  const height = useMemo(() => width / aspect, []);
  const cameraProps = useMemo(
    () => ({
      position: new THREE.Vector3(5, 2.5, 5),
      left: width / -2,
      right: width / 2,
      top: height / 2,
      bottom: height / -2,
    }),
    [],
  );

  useEffect(() => {
    // Add keyboard event listener
    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'r') {
      reset();
    }
  };

  const prepNewLayer = () => {
    if (!groupRef.current) return;
    if (status === 'OVER') return reset();
    if (status === 'READY') {
      // First layer
      const width = INIT_LAYER_SIDE;
      const depth = INIT_LAYER_SIDE;
      let x = 0,
        z = 0;
      if (nextDirection === 'z') {
        (x = INIT_POSITION_Z.x), (z = INIT_POSITION_Z.z);
      } else {
        (x = INIT_POSITION_X.x), (z = INIT_POSITION_X.z);
      }
      addLayer(x, z, width, depth);
    } else {
      // Calculate intersection of current top with last position
      const topLayer =
        groupRef.current.children[groupRef.current.children.length - 1];
      const lastLayer =
        groupRef.current.children[groupRef.current.children.length - 2];

      const { width: topWidth, depth: topDepth } =
        layers[layers.length - 1].props;

      let delta = 0;
      const direction = nextDirection === 'x' ? 'z' : 'x';

      if (direction === 'x') {
        // top layer is moving along x axis
        delta = topLayer.position.x - lastLayer.position.x;
      } else {
        // top layer is moving along z axis
        delta = topLayer.position.z - lastLayer.position.z;
      }

      const size = direction === 'x' ? topWidth : topDepth;
      const overhangSize = Math.abs(delta);
      const overlap = size - overhangSize;

      // TODO: set threshold to ignore really small gaps
      if (overlap > 0) {
        const newWidth = direction === 'x' ? overlap : topWidth;
        const newDepth = direction === 'z' ? overlap : topDepth;

        // Update model
        topLayer.scale.setComponent(direction === 'x' ? 0 : 2, overlap / size);
        const newPosition =
          topLayer.position.getComponent(direction === 'x' ? 0 : 2) - delta / 2;
        topLayer.position.setComponent(direction === 'x' ? 0 : 2, newPosition);

        // Justify x or z coords with last layer
        const newX =
          direction === 'x' ? topLayer.position.x : INIT_POSITION_X.x;
        const newZ =
          direction === 'z' ? topLayer.position.z : INIT_POSITION_Z.z;

        // Add new layer with newWidth and newDepth
        addLayer(newX, newZ, newWidth, newDepth);
      } else {
        // Game over, objects did not intersect
        setStatus('OVER');
      }
    }
  };

  return (
    <>
      <div className="score">
        <h2>{layers.length - 1}</h2>
      </div>
      {status === 'READY' && (
        <div className="welcome">
          <h1>Welcome!</h1>
          <p>Click anywhere to start</p>
          <p>Press R to reset</p>
        </div>
      )}
      {status === 'OVER' && <h1 className="gameover">Game Over</h1>}
      <div className="controls">
        <button onClick={prepNewLayer}>Add Layer (LMB)</button>
        <button onClick={reset}>Reset (R)</button>
      </div>
      <Canvas
        shadows
        orthographic
        dpr={[1, 2]}
        camera={{
          ...cameraProps,
          near: 0,
          far: 100,
          zoom: getCameraZoom(window.innerWidth),
        }}
        onClick={prepNewLayer}
      >
        <Suspense fallback={null}>
          <color attach="background" args={['#069']} />
          <Stats showPanel={0} className="stats" />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 30, 10]} intensity={0.6} />
          {GRID && <gridHelper />}
          <group ref={groupRef}>{layers.map((layer) => layer)}</group>
          <CameraDolly />
        </Suspense>
      </Canvas>
    </>
  );
}

export default App;
