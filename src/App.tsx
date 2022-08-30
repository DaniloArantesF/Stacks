import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react';
import create from 'zustand';
import { devtools } from 'zustand/middleware'
import './App.css'
import CameraDolly, { initialCameraPosition } from './CameraDolly';
import { nanoid } from 'nanoid';

/** Constants */
export const LAYER_HEIGHT = .5;
const INIT_LAYER_SIDE = .5;
const INIT_POSITION_X = { x: -2.5, z: 0 };
const INIT_POSITION_Z = { x: 0, z: -2.5 }
const SPEED = 0.01;

/** Types */
interface StackState {
  layers: any[];
  addLayer: (
    x: number,
    z: number,
    width: number,
    depth: number
  ) => void;
  nextDirection: 'x' | 'z'; // 0 -> move along x axis, 1 -> move along z axis
  status: GameStatus,
  setStatus: (status: GameStatus) => void;
  reset: () => void;
}

type GameStatus = 'READY' | 'RUNNING' | 'OVER';

/** Game State */
const initialState: Pick<StackState, "status" | "layers" | "nextDirection"> = {
  status: 'READY',
  layers: [<Layer key={nanoid()} x={0} y={0} z={0} width={INIT_LAYER_SIDE} depth={INIT_LAYER_SIDE} />],
  nextDirection: 'x',
}

export const useStackStore = create<StackState>()(
  devtools(
    (set) => ({
      ...initialState,
      setStatus: (status: GameStatus) => set((state) => ({ status })),
      addLayer: (x,z,width,depth) => set((state) => {
        // Determine y position for new layer
        const y = LAYER_HEIGHT * state.layers.length;
        return {
          layers: [...state.layers, <Layer key={nanoid()} x={x} y={y}  z={z} width={width} depth={depth} direction={state.nextDirection} />],
          nextDirection: state.nextDirection === 'x' ? 'z' : 'x',
          status: 'RUNNING',
        }
      }),
      reset: () => set(() => ({...initialState}))
    })
  )
);

interface LayerProps {
  x: number;
  y: number;
  z: number;
  direction?: 'x' | 'z';
  width: number;
  depth: number;
}

function Layer({x, y, z, width, depth, direction }: LayerProps) {
  const ref = useRef<THREE.Mesh>(null);
  const { layers, status, setStatus } = useStackStore();
  const layerIndex = y / LAYER_HEIGHT;
  const isLayerActive = useRef(true);
  const activeMaterial = useMemo(() => new THREE.MeshLambertMaterial({ wireframe: true, color: 'green' }), []);
  const inactiveMaterial = useMemo(() => new THREE.MeshLambertMaterial({ wireframe: true, color: 'red' }), []);

  // Run every time the stack changes
  // Assign materials
  useEffect(() => {
    if (!ref.current || !isLayerActive.current || layers.length - layerIndex > 2) {
      return;
    }
    isLayerActive.current = ((layerIndex > 0) && (layers.length - 1 === layerIndex));

    // dont set first layer as active
    if (isLayerActive.current) {
      ref.current.material = activeMaterial;
    } else {
      ref.current.material = inactiveMaterial;
    }
  }, [layers]);


  useFrame((state) => {
    if (!ref.current || !isLayerActive.current || status === 'OVER') return;

    // Move layer along x or z axis
    // Set game over if coords go over limit
    const position = ref.current.position;
    const positionAxis = position[direction as keyof typeof position];

    // Move blocks over axis until limit
    if (positionAxis < 5) {
      position.setComponent(direction === 'x' ? 0 : 2, (positionAxis as number) + SPEED);
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
  }, [])

  return (
    <mesh
      ref={ref}
      position={[x, y, z]}
    >
      <boxGeometry args={[width, LAYER_HEIGHT, depth]} />
    </mesh>
  )
}

function App() {
  const { reset, status, setStatus, layers, addLayer, nextDirection } = useStackStore();
  const groupRef = useRef<THREE.Group>(null);

  const prepNewLayer = () => {
    if (!groupRef.current || status === 'OVER') return;
    if (status === 'READY') {
      // First layer
      const width = INIT_LAYER_SIDE;
      const depth = INIT_LAYER_SIDE;
      let x = 0, z = 0;
      if (nextDirection === 'z') {
        x = INIT_POSITION_Z.x, z = INIT_POSITION_Z.z;
      } else {
        x = INIT_POSITION_X.x, z = INIT_POSITION_X.z;
      }
      addLayer(x, z, width, depth);
    } else {
      // Calculate intersection of current top with last position
      const topLayer = groupRef.current.children[groupRef.current.children.length - 1];
      const lastLayer = groupRef.current.children[groupRef.current.children.length - 2];

      const { width: topWidth, depth: topDepth } = layers[layers.length - 1].props;

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

      if (overlap > 0) {
        const newWidth = direction === 'x' ? overlap : topWidth;
        const newDepth = direction === 'z' ? overlap : topDepth;

        // Update model
        if (direction === 'x') {
          topLayer.scale.x = overlap / size;
          topLayer.position.x -= delta / 2;
        } else {
          topLayer.scale.z = overlap / size;
          topLayer.position.z -= delta / 2;
        }

        // Justify x or z coords with last layer
        const newX = direction === 'x' ? topLayer.position.x : INIT_POSITION_X.x;
        const newZ = direction === 'z' ? topLayer.position.z : INIT_POSITION_Z.z;

        // Add new layer with newWidth and newDepth
        addLayer(newX, newZ, newWidth, newDepth);
      } else {
        // Game over, objects did not intersect
        setStatus('OVER');
      }
    }
  }

  return (
    <>
      <div className='controls'>
        { status === 'OVER' && <h1 className='gameover'>GAME OVER</h1>}
        <button onClick={prepNewLayer}>Add Layer</button>
        <button onClick={reset}>Reset</button>
      </div>
      <Canvas orthographic camera={{position: initialCameraPosition, zoom: 250,}}>
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <gridHelper />
        <group ref={groupRef}>
        {
          layers.map((layer) => layer)
        }
        </group>
        <CameraDolly />
      </Canvas>
    </>
  )
}

export default App
