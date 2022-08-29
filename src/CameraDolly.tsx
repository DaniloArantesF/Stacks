import * as THREE from 'three';
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { LAYER_HEIGHT, useStackStore } from "./App";

export const initialCameraPosition = new THREE.Vector3(5, 2.5, 5);

const CameraDolly = () => {
  const { status, layers } = useStackStore();
  const moved = useRef(false);
  const { camera } = useThree();

  useEffect(() => {
    camera.lookAt(0, (LAYER_HEIGHT * layers.length) / 2, 0);
  }, [])

  // Reset camera position
  useEffect(() => {
    if (camera.position.y > 1 && status === 'READY') {
      camera.position.copy(initialCameraPosition);
    }
  }, [status])

  // Set move to false when new layer is added
  // moved is set to true inside useFrame during the first
  // iteration after a new layer is added
  useEffect(() => {
    if (moved.current) {
      moved.current = false;
    }
  }, [layers])


  useFrame(({ camera }) => {
    // Only move camera after a new layer is added
    if (status === 'RUNNING' && !moved.current) {
      // Move camera along y axis
      const newPosition = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);
      newPosition.y += LAYER_HEIGHT * 2;
      camera.position.lerp(newPosition, .5);
      moved.current = true;
    }
  });

  return null;
}

export default CameraDolly;