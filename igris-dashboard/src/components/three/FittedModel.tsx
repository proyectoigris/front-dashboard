import { useGLTF } from '@react-three/drei';
import { Component, useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';

/**
 * Carga un GLB y lo normaliza: altura = `height`, centrado en X/Z, base en y = 0.
 * `rotation` corrige modelos exportados con otro eje "arriba".
 */
export function FittedModel({
  url,
  height,
  rotation = NO_ROTATION,
  groundAtOrigin = false,
  maxWidth,
  maxBelow,
  lean,
  pivotXZ,
  onBounds,
}: {
  /** Recibe la caja real del modelo ya escalado (en el sistema de su grupo padre), p. ej. para encuadrar la cámara. */
  onBounds?: (b: ModelBounds) => void;
  /**
   * Corrección de inclinación tras `rotation`, en radianes: primero en X y luego en Z
   * (ejes de la escena). Sirve para dejar vertical un tallo modelado torcido.
   */
  lean?: [number, number];
  /** Punto (x, z) del modelo, ya rotado y corregido, que queda en el centro de la escena (p. ej. la base del tallo). */
  pivotXZ?: [number, number];
  /** Límite de ancho (máx. de X y Z) tras escalar. */
  maxWidth?: number;
  /** Con groundAtOrigin: profundidad máxima de lo que queda bajo el suelo. */
  maxBelow?: number;
  url: string;
  height: number;
  rotation?: [number, number, number];
  /** El origen del modelo es el nivel del suelo (lo que queda bajo y = 0 son raíces): `height` mide solo la parte aérea. */
  groundAtOrigin?: boolean;
}) {
  const { scene } = useGLTF(url);
  const key = [rotation, lean ?? [], pivotXZ ?? []].map((a) => a.join(',')).join('|');
  const { object, scale, offset, bounds } = useMemo(() => {
    const obj = scene.clone(true);
    obj.rotation.set(...rotation);
    // Corrección de inclinación: X (interior) y luego Z (exterior), igual que se midió.
    const leanX = new THREE.Group();
    leanX.rotation.x = lean?.[0] ?? 0;
    leanX.add(obj);
    const root = new THREE.Group();
    root.rotation.z = lean?.[1] ?? 0;
    root.add(leanX);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    let s = height / ((groundAtOrigin ? box.max.y : size.y) || 1);
    if (maxWidth) s = Math.min(s, maxWidth / Math.max(size.x, size.z));
    if (groundAtOrigin && maxBelow && box.min.y < 0) s = Math.min(s, maxBelow / -box.min.y);
    const center = box.getCenter(new THREE.Vector3());
    const [cx, cz] = pivotXZ ?? [center.x, center.z];
    const y = groundAtOrigin ? 0 : -box.min.y * s;
    const bounds: ModelBounds = {
      minY: groundAtOrigin ? box.min.y * s : 0,
      maxY: groundAtOrigin ? box.max.y * s : size.y * s,
      halfWidth: Math.max(Math.abs(box.min.x - cx), Math.abs(box.max.x - cx), Math.abs(box.min.z - cz), Math.abs(box.max.z - cz)) * s,
    };
    return { object: root, scale: s, offset: new THREE.Vector3(-cx * s, y, -cz * s), bounds };
  }, [scene, height, key, groundAtOrigin, maxWidth, maxBelow]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onBounds?.(bounds);
  }, [bounds]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group position={offset} scale={scale}>
      <primitive object={object} />
    </group>
  );
}

/** Si el modelo no carga, muestra `fallback` en lugar de romper la escena. */
export class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const NO_ROTATION: [number, number, number] = [0, 0, 0];

export interface ModelBounds {
  minY: number;
  maxY: number;
  /** Mayor distancia horizontal desde el eje del modelo. */
  halfWidth: number;
}

/** true si la URL existe y es un modelo (el servidor de desarrollo responde HTML para rutas inexistentes). */
export async function modelAvailable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const type = res.headers.get('content-type') ?? '';
    return res.ok && !type.includes('text/html');
  } catch {
    return false;
  }
}

export const MODEL_URLS = {
  igris: '/models/igris.glb',
  tomato: '/models/tomate.glb',
};
