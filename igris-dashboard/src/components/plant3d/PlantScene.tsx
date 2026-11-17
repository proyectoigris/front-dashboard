/**
 * Planta de tomate 3D (modelo GLB; respaldo procedural), sin rizotrón ni maceta (geometría ligera
 * para Raspberry Pi 5: sin sombras, materiales estándar, ~60 mallas).
 * Cada dato se ancla al punto físico donde se mide y "surge" desde allí.
 * Se puede rotar/zoom con mouse o tacto (OrbitControls).
 */
import { Html, Line, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { MOISTURE_DEPTHS } from '../../config/experiment';
import { FittedModel, MODEL_URLS, ModelBoundary, type ModelBounds } from '../three/FittedModel';

/** Ajustes del modelo GLB del tomate (altura sobre el suelo y corrección de orientación). */
const TOMATO_HEIGHT = 2.3;
/** El GLB viene "acostado" (su vertical es el eje Z): se gira 90° en X para ponerlo de pie. Su origen es el nivel del suelo. */
const TOMATO_ROTATION: [number, number, number] = [Math.PI / 2, 0, 0];
const TOMATO_MAX_WIDTH = 3.4;
/**
 * El tallo del modelo viene torcido (~19° y ~4°, medido siguiendo el tallo en la malla).
 * Esta corrección lo deja vertical (<1°) y la base del tallo queda en el centro, bajo la lámpara.
 */
const TOMATO_LEAN: [number, number] = [-0.33, 0.065];
const TOMATO_STEM_BASE: [number, number] = [-0.0194, 0.0325];

const CM = 0.1; // 1 cm = 0,1 unidades de escena
const SOIL_DEPTH = 25 * CM;
const STEM_TOP = 3.1;

export interface SceneValue {
  value: number | null;
  unit: string;
  decimals: number;
}

export interface SceneData {
  moistureUpper: SceneValue;
  moistureLower: SceneValue;
  soilTemp?: SceneValue;
  airTemp?: SceneValue;
  airHumidity?: SceneValue;
  co2?: SceneValue;
  par?: SceneValue;
  /** Texto bajo cada etiqueta: "P07" o "media T3 · n=6". */
  scopeLabel: string;
}

// ---------- utilidades ----------

function fmtV(v: SceneValue | undefined) {
  if (!v || v.value === null) return '—';
  return v.value.toFixed(v.decimals);
}

// ---------- planta ----------

const LEAF_GEO = new THREE.SphereGeometry(1, 10, 6);
const FRUIT_GEO = new THREE.SphereGeometry(1, 16, 12);

function CompoundLeaf({ length, color }: { length: number; color: string }) {
  // Hoja compuesta de tomate: raquis + pares de foliolos + foliolo terminal.
  const leaflets = [0.3, 0.55, 0.8].flatMap((t, i) => [
    { x: t * length, z: 0.09 + i * 0.01, s: 0.85 + i * 0.1, side: 1 },
    { x: t * length, z: -(0.09 + i * 0.01), s: 0.85 + i * 0.1, side: -1 },
  ]);
  return (
    <group>
      <mesh position={[length / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.016, length, 5]} />
        <meshStandardMaterial color="#3f8a3a" />
      </mesh>
      {leaflets.map((l, i) => (
        <mesh
          key={i}
          geometry={LEAF_GEO}
          position={[l.x, 0.01, l.z]}
          rotation={[l.side * 0.35, l.side * 0.5, 0]}
          scale={[0.13 * l.s, 0.018, 0.075 * l.s]}
        >
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
      ))}
      <mesh geometry={LEAF_GEO} position={[length + 0.1, 0, 0]} scale={[0.15, 0.018, 0.085]}>
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    </group>
  );
}

function TomatoPlant({ vigor }: { vigor: number }) {
  const { stemGeo, curve } = useMemo(() => {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.05, 0.8, 0.02),
      new THREE.Vector3(-0.04, 1.6, 0),
      new THREE.Vector3(0.03, 2.4, -0.02),
      new THREE.Vector3(0, STEM_TOP, 0),
    ]);
    return { curve: c, stemGeo: new THREE.TubeGeometry(c, 48, 0.045, 8) };
  }, []);

  const leaves = useMemo(() => {
    const hs = [0.45, 0.8, 1.15, 1.5, 1.85, 2.2, 2.5, 2.8, 3.0];
    return hs.map((h, i) => {
      const p = curve.getPointAt(h / STEM_TOP);
      return {
        p,
        rotY: (i * 137.5 * Math.PI) / 180,
        tilt: -0.25 - i * 0.03,
        length: 0.75 - i * 0.045,
        color: i < 2 ? '#4f8f3a' : i > 6 ? '#6cc04a' : '#3f9d44',
      };
    });
  }, [curve]);

  const trusses = useMemo(
    () => [
      { h: 1.0, rotY: 0.6, fruits: [{ r: 0.12, c: '#e0322a' }, { r: 0.11, c: '#e5452c' }, { r: 0.1, c: '#f08a2c' }] },
      { h: 1.75, rotY: 2.9, fruits: [{ r: 0.1, c: '#f2a53a' }, { r: 0.09, c: '#9bc53d' }, { r: 0.08, c: '#86b83a' }] },
      { h: 2.45, rotY: 4.6, fruits: [{ r: 0.07, c: '#7fb339' }, { r: 0.06, c: '#7fb339' }] },
    ],
    [],
  );

  const stemColor = vigor > 0.6 ? '#4d9a3c' : '#6f8f3c';
  return (
    <group>
      <mesh geometry={stemGeo}>
        <meshStandardMaterial color={stemColor} roughness={0.6} />
      </mesh>
      {leaves.map((l, i) => (
        <group key={i} position={l.p} rotation={[0, l.rotY, l.tilt * (0.6 + vigor * 0.6)]}>
          <CompoundLeaf length={l.length} color={l.color} />
        </group>
      ))}
      {trusses.map((t, i) => {
        const p = curve.getPointAt(t.h / STEM_TOP);
        return (
          <group key={i} position={p} rotation={[0, t.rotY, 0]}>
            <mesh position={[0.15, -0.08, 0]} rotation={[0, 0, -0.9]}>
              <cylinderGeometry args={[0.01, 0.012, 0.3, 5]} />
              <meshStandardMaterial color="#3f8a3a" />
            </mesh>
            {t.fruits.map((f, j) => (
              <mesh
                key={j}
                geometry={FRUIT_GEO}
                position={[0.24 + j * 0.13, -0.25 - (j % 2) * 0.1, (j - 1) * 0.1]}
                scale={[f.r, f.r * 0.88, f.r]}
              >
                <meshStandardMaterial color={f.c} roughness={0.35} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function GrowLamp({ par, y }: { par: number | null; y: number }) {
  const on = (par ?? 0) > 5;
  return (
    <group position={[0, y, 0]}>
      <mesh>
        <boxGeometry args={[2.4, 0.08, 0.5]} />
        <meshStandardMaterial color="#9fb3a6" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[2.2, 0.02, 0.38]} />
        <meshStandardMaterial
          color={on ? '#f5f3ff' : '#333'}
          emissive={on ? '#e9d5ff' : '#000'}
          emissiveIntensity={on ? 1.2 : 0}
        />
      </mesh>
    </group>
  );
}

// ---------- etiquetas ancladas ----------

function Probe({ position, color }: { position: THREE.Vector3; color: string }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const k = (clock.elapsedTime % 1.6) / 1.6;
    ring.current.scale.setScalar(1 + k * 2.2);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - k);
  });
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.04, 12, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={ring}>
        <sphereGeometry args={[0.04, 12, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}

export type TagKind = 'soil' | 'air' | 'light';

/**
 * Etiqueta compacta anclada a un punto de medición: punto de color, nombre corto y valor.
 * Tocarla abre el panel con el detalle de esa variable.
 */
function DataTag({
  anchor,
  offset,
  label,
  value,
  color,
  kind,
  onTag,
}: {
  anchor: [number, number, number];
  offset: [number, number, number];
  label: string;
  value: string;
  color: string;
  kind: TagKind;
  onTag?: (k: TagKind) => void;
}) {
  const a = new THREE.Vector3(...anchor);
  const end = a.clone().add(new THREE.Vector3(...offset));
  return (
    <group>
      <Probe position={a} color={color} />
      <Line points={[a, end]} color={color} lineWidth={1} transparent opacity={0.6} />
      <Html position={end} center zIndexRange={[30, 0]}>
        <button
          className="tag-pill"
          style={{ ['--tag-color' as string]: color }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onTag?.(kind)}
          title="Ver detalle"
        >
          <span className="tag-dot" />
          <span className="tag-name">{label}</span>
          <b>{value}</b>
        </button>
      </Html>
    </group>
  );
}
// ---------- zonas biológicas (raíces / hojas) ----------

export type BioZone = 'roots' | 'leaves';

/**
 * Volumen invisible que se puede tocar + botón visible. Un toque sin arrastre
 * (e.delta < 6 px) abre el panel; arrastrar sigue sirviendo para girar la planta.
 */
function ZoneHit({
  y0,
  y1,
  radius,
  zone,
  label,
  color,
  buttonAt,
  active,
  onSelect,
}: {
  y0: number;
  y1: number;
  radius: number;
  zone: BioZone;
  label: string;
  color: string;
  buttonAt: [number, number, number];
  active: boolean;
  onSelect: (z: BioZone) => void;
}) {
  return (
    <group>
      <mesh
        position={[0, (y0 + y1) / 2, 0]}
        onClick={(e) => {
          if (e.delta < 6) {
            e.stopPropagation();
            onSelect(zone);
          }
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      >
        <cylinderGeometry args={[radius, radius, y1 - y0, 24, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Html position={buttonAt} center zIndexRange={[40, 0]}>
        <button
          onClick={() => onSelect(zone)}
          className="zone-btn"
          style={{ ['--zone-color' as string]: color, opacity: active ? 1 : 0.92 }}
        >
          <span className="zone-dot" />
          {label}
        </button>
      </Html>
    </group>
  );
}
// ---------- encuadre automático ----------

/** Dirección desde la que mira la cámara (casi horizontal, levemente de lado). */
const VIEW_DIR = new THREE.Vector3(4.0, 0.1, 5.7).normalize();

/**
 * Ajusta la distancia de la cámara al tamaño del lienzo para que la planta, de las raíces
 * a la lámpara, llene todo el alto disponible (o el ancho, si el lienzo es angosto).
 * Se recalcula solo al cambiar el tamaño, así no pisa el zoom que haga el usuario.
 */
function CameraFit({ ymin, ymax, halfWidth, narrowHalfWidth }: { ymin: number; ymax: number; halfWidth: number; narrowHalfWidth?: number }) {
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  const size = useThree((st) => st.size);
  const controls = useThree((st) => st.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  useEffect(() => {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const aspect = size.width / Math.max(1, size.height);
    const dV = ((ymax - ymin) / 2) * 1.03 / t;
    // Lienzo vertical (móvil): se reserva más ancho para que las etiquetas laterales no se salgan.
    const hw = narrowHalfWidth && aspect < 0.85 ? Math.max(halfWidth, narrowHalfWidth) : halfWidth;
    const dH = hw / (t * aspect);
    const target = new THREE.Vector3(0, (ymin + ymax) / 2, 0);
    camera.position.copy(target).addScaledVector(VIEW_DIR, Math.max(dV, dH));
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
  }, [camera, controls, size.width, size.height, ymin, ymax, halfWidth, narrowHalfWidth]);
  return null;
}

// ---------- escena ----------

export default function PlantScene({
  data,
  sceneKey,
  zone = null,
  onZone,
  compact = false,
  mini = false,
  onTag,
}: {
  /** Franja mínima (móvil con panel abierto): sin etiquetas de datos, que ya se ven en el panel. */
  mini?: boolean;
  /** Toque en una etiqueta de datos: abre el panel con el detalle. */
  onTag?: (k: TagKind) => void;
  /** Columna angosta (panel abierto): se reserva ancho para que las etiquetas quepan junto a la planta. */
  compact?: boolean;
  data: SceneData;
  accent?: string;
  sceneKey: string;
  /** Zona biológica abierta (resaltada). */
  zone?: BioZone | null;
  /** Toque en raíces u hojas: abre el panel de microbioma o de proteínas. */
  onZone?: (z: BioZone) => void;
}) {
  const vigor = data.moistureUpper.value === null ? 0.6 : THREE.MathUtils.clamp((data.moistureUpper.value - 10) / 25, 0, 1);
  // Puntos de medición en el sistema radicular (sin rizotrón ni maceta visibles).
  const front = 0.15;
  const probeX = 0.35;
  // Gira sola, suave, hasta que el usuario la toca; desde ahí la controla él.
  const [spinning, setSpinning] = useState(true);
  // Caja real del modelo (escalado): define el encuadre, la lámpara y los botones.
  const [bounds, setBounds] = useState<ModelBounds | null>(null);
  const minY = bounds?.minY ?? -(SOIL_DEPTH - 0.1);
  const maxY = bounds?.maxY ?? TOMATO_HEIGHT;
  const lampY = maxY + 0.3;

  return (
    <Canvas
      onPointerDown={() => setSpinning(false)}
      dpr={[1, 1.5]}
      // Cámara casi a la altura de la planta: sin vista desde arriba, el tallo se ve vertical (sin distorsión de perspectiva).
      camera={{ position: [4.0, 0.1, 5.7], fov: 42 }}
      // Fondo transparente: la planta se ve sobre el degradado de la aplicación.
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.45; // más brillo en la planta
      }}
      style={{ touchAction: 'none' }}
    >
      <hemisphereLight args={['#ffffff', '#d9ecd0', 1.8]} />
      <directionalLight position={[3, 6, 4]} intensity={2.8} />
      <directionalLight position={[-4, 2, -3]} intensity={1.2} />
      <directionalLight position={[0, 1, 6]} intensity={0.9} />
      <pointLight position={[0, lampY - 0.3, 0]} intensity={(data.par?.value ?? 0) > 5 ? 3 : 0} distance={6} color="#f5e9ff" />

      <group position={[0, -0.4, 0]}>
        {/* Modelo original del tomate; si no carga, se usa la planta procedural. */}
        <ModelBoundary fallback={<group scale={0.75}><TomatoPlant vigor={vigor} /></group>}>
          <Suspense fallback={null}>
            <FittedModel
              url={MODEL_URLS.tomato}
              height={TOMATO_HEIGHT}
              rotation={TOMATO_ROTATION}
              groundAtOrigin
              maxWidth={TOMATO_MAX_WIDTH}
              lean={TOMATO_LEAN}
              pivotXZ={TOMATO_STEM_BASE}
              onBounds={setBounds}
              maxBelow={SOIL_DEPTH - 0.1}
            />
          </Suspense>
        </ModelBoundary>
        <GrowLamp par={data.par?.value ?? null} y={lampY} />
        {onZone && (
          <>
            <ZoneHit y0={minY} y1={-0.05} radius={0.75} zone="roots" label={mini ? "Microbioma" : "Microbioma de raíz"} color="#d3a23e" buttonAt={[0, minY + 0.3, 0.9]} active={zone === 'roots'} onSelect={onZone} />
            <ZoneHit y0={0.35} y1={maxY} radius={1.3} zone="leaves" label={mini ? "Proteínas" : "Proteínas de hoja"} color="#74b43b" buttonAt={[1.4, maxY * 0.45, 0.4]} active={zone === 'leaves'} onSelect={onZone} />
          </>
        )}

        {/* Cinco etiquetas compactas: suelo a los lados de las raíces, aire junto a la copa y luz bajo la lámpara. */}
        {!mini && (
        <group key={sceneKey}>
          <DataTag anchor={[probeX, -MOISTURE_DEPTHS.upper * CM, front]} offset={[1.1, 0.3, 0.3]} label={`${MOISTURE_DEPTHS.upper} cm`} value={`${fmtV(data.moistureUpper)} %`} color="#0085de" kind="soil" onTag={onTag} />
          <DataTag anchor={[probeX, -MOISTURE_DEPTHS.lower * CM, front]} offset={[1.1, 0.0, 0.3]} label={`${MOISTURE_DEPTHS.lower} cm`} value={`${fmtV(data.moistureLower)} %`} color="#d3a23e" kind="soil" onTag={onTag} />
          {data.soilTemp && (
            <DataTag anchor={[-probeX, -10 * CM, front]} offset={[-1.1, -0.3, 0.3]} label="Suelo" value={`${fmtV(data.soilTemp)} °C`} color="#08a1ba" kind="soil" onTag={onTag} />
          )}
          {data.airTemp && (
            <DataTag
              anchor={[-0.4, maxY * 0.6, 0.2]}
              offset={[-1.2, -0.1, 0.3]}
              label="Aire"
              value={`${fmtV(data.airTemp)} °C${data.airHumidity ? ` · ${fmtV(data.airHumidity)} %` : ''}`}
              color="#74b43b"
              kind="air"
              onTag={onTag}
            />
          )}
          {data.par && (
            <DataTag anchor={[0.6, lampY - 0.08, 0]} offset={[1.3, -0.6, 0.3]} label="Luz" value={`${fmtV(data.par)} PAR`} color="#24aecf" kind="light" onTag={onTag} />
          )}
        </group>
        )}
      </group>

      {/* Giro automático lento hasta el primer toque; después se gira arrastrando. */}
      {/* El grupo de la escena está desplazado 0,4 hacia abajo. */}
      <CameraFit ymin={-0.4 + minY - 0.3} ymax={-0.4 + maxY + 0.06} halfWidth={compact || mini ? 2.5 : (bounds?.halfWidth ?? 1.8)} narrowHalfWidth={compact || mini ? undefined : 2.7} />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        autoRotate={spinning}
        autoRotateSpeed={1}
        minDistance={3}
        maxDistance={20}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI * 0.62}
      />
    </Canvas>
  );
}
