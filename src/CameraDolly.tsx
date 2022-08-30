import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LAYER_HEIGHT, useStackStore, Y_OFFSET } from './App';

export const initialCameraPosition = new THREE.Vector3(5, 2.5, 5);

export const getCameraZoom = (windowWidth: number) => {
  // lg=500,md=300,sm=200
  return windowWidth > 500
    ? windowWidth > 1000
      ? windowWidth > 1500
        ? 500
        : 400
      : 300
    : 200;
};

const CameraDolly = () => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const zoom = useMemo(() => getCameraZoom(windowWidth), [windowWidth]);
  const { status, layers } = useStackStore();
  const moved = useRef(false);
  const { camera } = useThree();

  useEffect(() => {
    camera.lookAt(0, (LAYER_HEIGHT * layers.length + Y_OFFSET) / 2, 0);

    // Resize event listener
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Reset camera position
  useEffect(() => {
    if (camera.position.y > 1 && status === 'READY') {
      camera.position.copy(initialCameraPosition);
    }
  }, [status]);

  // Set move to false when new layer is added
  // moved is set to true inside useFrame during the first
  // iteration after a new layer is added
  useEffect(() => {
    if (moved.current) {
      moved.current = false;
    }
  }, [layers]);

  useFrame(({ camera }) => {
    // Only move camera after a new layer is added
    if (status === 'RUNNING' && !moved.current) {
      // Move camera along y axis
      const newPosition = new THREE.Vector3(
        camera.position.x,
        camera.position.y,
        camera.position.z,
      );
      newPosition.y += LAYER_HEIGHT * 2;
      camera.position.lerp(newPosition, 0.5);
      moved.current = true;
    }
  });

  // Adjust zoom if canvas is resized
  useEffect(() => {
    if (camera.zoom !== zoom) {
      console.log('Adjusting zoom');
      camera.zoom = zoom;
    }
  }, [windowWidth, zoom]);

  const handleResize = (e: UIEvent) => {
    setWindowWidth((e.target as Window).innerWidth);
  };

  return null;
};

export default CameraDolly;
