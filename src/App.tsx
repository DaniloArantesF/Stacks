import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react';
import create from 'zustand';
import './App.css'
import CameraDolly, { initialCameraPosition } from './CameraDolly';
import { nanoid } from 'nanoid';
import { OrthographicCamera, OrbitControls } from '@react-three/drei';

export const LAYER_HEIGHT = .5;
const INIT_LAYER_SIDE = .5;

const INIT_POSITION_X = { x: -2.5, z: 0 };
const INIT_POSITION_Z = { x: 0, z: -2.5 }

const SPEED = 0.01;
interface StackState {
  layers: any[];
  addLayer: () => void;
  direction: number; // 0 -> move along x axis, 1 -> move along z axis
  status: GameStatus,
  setStatus: (status: GameStatus) => void;
  reset: () => void;
}

const initialState: Pick<StackState, "status" | "layers" | "direction"> = {
  status: 'READY',
  layers: [<Layer key={nanoid()} x={0} y={0} z={0} width={INIT_LAYER_SIDE} depth={INIT_LAYER_SIDE} />],
  direction: 0,
}

export const useStackStore = create<StackState>()(
  (set) => ({
    ...initialState,

    setStatus: (status: GameStatus) => set((state) => ({ status, })),
    addLayer: () => set((state) => {
      // Get next box y value
      const y = LAYER_HEIGHT * state.layers.length;
      const layerWidth = INIT_LAYER_SIDE;
      const layerDepth = INIT_LAYER_SIDE;

      let x = 0, z = 0;
      if (state.direction) { // move along z axis
        x = INIT_POSITION_Z.x, z = INIT_POSITION_Z.z;
      } else {
        x = INIT_POSITION_X.x, z = INIT_POSITION_X.z;
      }

      return {
        layers: [...state.layers, <Layer key={nanoid()} x={x} y={y}  z={z} width={layerWidth} depth={layerDepth} direction={state.direction} />],
        direction: state.direction ? 0 : 1,
        status: 'RUNNING',
      }
    }),
    reset: () => set(() => ({ status: 'READY', layers: [<Layer x={0} y={0} z={0} width={INIT_LAYER_SIDE} depth={INIT_LAYER_SIDE} />] }))
  })
);


interface LayerProps {
  x: number;
  y: number;
  z: number;
  direction?: number;
  width: number;
  depth: number;
}

function Layer({x, y, z, width, depth, direction }: LayerProps) {
  const ref = useRef<THREE.Mesh>(null);
  const { layers, setStatus } = useStackStore();
  const layerPosition = y / LAYER_HEIGHT;
  const isLayerActive = useRef(true);
  const activeMaterial = useMemo(() => new THREE.MeshLambertMaterial({ wireframe: true, color: 'green' }), []);
  const inactiveMaterial = useMemo(() => new THREE.MeshLambertMaterial({ wireframe: true, color: 'red' }), []);

  // Run every time the stack changes
  // Checks if current layer is last or second to last
  // If last set it as active, if second to last set it as inactive
  // maybe improve this later
  useEffect(() => {
    if (!ref.current || !isLayerActive.current || layers.length - layerPosition > 2) {
      return;
    }
    isLayerActive.current = layers.length - 1 === layerPosition;

    // dont set first layer as active
    if (isLayerActive.current && layerPosition > 0) {
      ref.current.material = activeMaterial;
    } else {
      ref.current.material = inactiveMaterial;
    }
  }, [layers]);


  useFrame((state) => {
    if (!ref.current || !isLayerActive.current) return;

    // Move layer along x or z axis
    // Set game over if coords go over limit
    if (direction === 1) {
      if (ref.current.position.z < 5) {
        ref.current.position.z += SPEED;
      } else {
        setStatus('OVER')
      }
    }
    if (direction === 0) {
      if (ref.current.position.x < 5) {
        ref.current.position.x += SPEED;
      } else {
        setStatus('OVER');
      }
    }
  });

  return (
    <mesh
      ref={ref}
      position={[x, y, z]}
    >
      <boxGeometry args={[width, LAYER_HEIGHT, depth]} />
    </mesh>
  )
}

type GameStatus = 'READY' | 'RUNNING' | 'OVER';

function App() {
  const { reset, status, layers, addLayer } = useStackStore();

  return (
    <>
      <div className='controls'>
        { status === 'OVER' && <h1 className='gameover'>GAME OVER</h1>}
        <button onClick={() => {
          addLayer();
        }}>Add Layer</button>
        <button onClick={reset}>Reset</button>
      </div>
      <Canvas orthographic camera={{position: initialCameraPosition, zoom: 250,}}>
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <gridHelper />
        {
          layers.map((layer) => layer)
        }
      </Canvas>
    </>
  )
}

export default App
