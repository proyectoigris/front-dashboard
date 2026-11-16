/**
 * Avatar IGRIS en 3D (modelo original GLB). No se anima solo: se gira
 * arrastrando con el mouse o el dedo. Tocar sin arrastrar abre el chat.
 * frameloop="demand": solo se dibuja mientras se gira, para no cargar la GPU.
 */
import { OrbitControls } from '@react-three/drei';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { Suspense } from 'react';
import { FittedModel, MODEL_URLS } from '../three/FittedModel';

export default function Avatar3D({ onTap }: { onTap: () => void }) {
  const tap = (e: ThreeEvent<MouseEvent>) => {
    // e.delta = píxeles recorridos entre pulsar y soltar: si hubo arrastre, no es un toque.
    if (e.delta < 6) onTap();
  };
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.5, 2.7], fov: 30 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      style={{ touchAction: 'none', cursor: 'grab' }}
    >
      <hemisphereLight args={['#ffffff', '#e3f1d6', 1.3]} />
      <directionalLight position={[2, 3, 3]} intensity={1.5} />
      <directionalLight position={[-3, 1, -2]} intensity={0.5} color="#bfe8ff" />
      <Suspense fallback={null}>
        <group onClick={tap} rotation={[0, -0.25, 0]}>
          <FittedModel url={MODEL_URLS.igris} height={1} />
        </group>
      </Suspense>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[0.32, 40]} />
        <meshBasicMaterial color="#1f6b3a" transparent opacity={0.12} />
      </mesh>
      <OrbitControls
        target={[0, 0.48, 0]}
        enablePan={false}
        enableZoom={false}
        enableDamping
        minPolarAngle={Math.PI * 0.3}
        maxPolarAngle={Math.PI * 0.56}
      />
    </Canvas>
  );
}
