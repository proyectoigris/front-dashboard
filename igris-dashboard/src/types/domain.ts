/**
 * Modelo conceptual de datos IGRIS (sección 13 de la especificación).
 * Estas interfaces son el contrato entre el frontend y la futura API FastAPI:
 * el backend debe devolver objetos con esta misma forma (JSON, ISO-8601 UTC).
 */

export type TreatmentId = 'T1' | 'T2' | 'T3' | 'T4';
export type PlantId = `P${string}`;
export type WaterRegime = 'normal' | 'deficit';
export type DataOrigin = 'simulated' | 'measured';

export interface Treatment {
  id: TreatmentId;
  waterRegime: WaterRegime;
  inoculated: boolean;
  label: string;
  description: string;
  /** Color de identificación visual del tratamiento. */
  color: string;
}

export type PlantStatus = 'active' | 'paused' | 'excluded';

export interface Plant {
  id: PlantId;
  treatmentId: TreatmentId;
  /** Posición física en la cámara, p. ej. "B3" (fila B, columna 3). */
  position: { row: number; col: number; label: string };
  establishedAt: string;
  status: PlantStatus;
}

export type SensorType =
  | 'air_temperature'
  | 'air_humidity'
  | 'co2'
  | 'par'
  | 'soil_moisture'
  | 'soil_temperature'
  | 'soil_ph'
  | 'soil_ec';

export type SensorStatus = 'online' | 'stale' | 'offline' | 'disabled';

export interface Sensor {
  id: string;
  type: SensorType;
  unit: string;
  /** 'chamber' para sensores ambientales; id de planta para sensores de rizotrón. */
  scope: 'chamber' | PlantId;
  /** Profundidad en cm del centro del sensor (solo sensores de suelo). */
  depthCm?: number;
  location: string;
  calibration?: { method: string; date: string; notes?: string };
  status: SensorStatus;
}

/** Calidad de una medición. Solo 'valid' entra en promedios. */
export type ReadingQuality = 'valid' | 'suspect' | 'missing' | 'out_of_range';

export interface SensorReading {
  sensorId: string;
  /** Epoch ms (UTC). */
  t: number;
  value: number | null;
  quality: ReadingQuality;
}

/** Punto agregado para series históricas (bucket de tiempo). */
export interface AggregatedPoint {
  t: number;
  mean: number | null;
  min: number | null;
  max: number | null;
  /** Número de mediciones válidas en el bucket. */
  n: number;
}

export interface BiologicalMeasurement {
  id: string;
  plantId: PlantId;
  date: string;
  type: string;
  result: number | string;
  unit?: string;
  method: string;
  metadata?: Record<string, unknown>;
  origin: DataOrigin;
}

/** Origen de la alerta: umbral configurable, fallo de dispositivo o modelo de análisis. */
export type AlertOrigin = 'threshold' | 'device' | 'model';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertState = 'active' | 'acknowledged' | 'resolved';

export interface Alert {
  id: string;
  origin: AlertOrigin;
  severity: AlertSeverity;
  state: AlertState;
  t: number;
  plantId?: PlantId;
  sensorId?: string;
  title: string;
  detail: string;
  dataOrigin: DataOrigin;
}

export type ExperimentalEventType =
  | 'irrigation'
  | 'inoculation'
  | 'sampling'
  | 'maintenance'
  | 'note';

export interface ExperimentalEvent {
  id: string;
  t: number;
  scope: 'chamber' | TreatmentId | PlantId;
  type: ExperimentalEventType;
  description: string;
  origin: DataOrigin;
}

export type AssistantStatus = 'pending' | 'answered' | 'failed';

export interface AssistantInteraction {
  id: string;
  t: number;
  query: string;
  response: string;
  /** Referencias a los datos usados para construir la respuesta (trazabilidad). */
  dataRefs: { sensorId?: string; plantId?: PlantId; treatmentId?: TreatmentId; t?: number; note?: string }[];
  status: AssistantStatus;
}

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'responding' | 'alert';

export type DeviceLinkStatus = 'connected' | 'degraded' | 'disconnected';

export interface DeviceStatus {
  id: string;
  label: string;
  status: DeviceLinkStatus;
  lastSeen: number;
}
