/**
 * Selectores derivados. Reciben el snapshot y devuelven valores listos para
 * mostrar, siempre con su n efectivo y su ámbito (cámara / tratamiento / planta).
 */
import { SENSOR_AVAILABILITY, THRESHOLDS, TIMING, TREATMENT_IDS } from '../config/experiment';
import { SENSOR_IDS } from '../data/simulator';
import type { IgrisSnapshot } from '../store/igrisStore';
import type { AggregatedPoint, PlantId, SensorType, TreatmentId } from '../types/domain';
import { describe, slopePerHour, type Descriptive } from './stats';

export type ValueStatus = 'ok' | 'stale' | 'no-data' | 'disabled';
export type Depth = 'upper' | 'lower';

export interface CurrentValue {
  value: number | null;
  t: number | null;
  status: ValueStatus;
}

export function currentValue(s: IgrisSnapshot, sensorId: string): CurrentValue {
  const sensor = s.sensorById.get(sensorId);
  if (!sensor || sensor.status === 'disabled') return { value: null, t: null, status: 'disabled' };
  const r = s.lastValid.get(sensorId);
  if (!r || r.value === null) return { value: null, t: null, status: 'no-data' };
  const fresh = s.now - r.t <= THRESHOLDS.staleAfterSec * 1000;
  return { value: fresh ? r.value : null, t: r.t, status: fresh ? 'ok' : 'stale' };
}

export const ENV_SENSORS: { type: SensorType; id: string }[] = [
  { type: 'air_temperature', id: SENSOR_IDS.airTemp },
  { type: 'air_humidity', id: SENSOR_IDS.airHum },
  { type: 'co2', id: SENSOR_IDS.co2 },
  { type: 'par', id: SENSOR_IDS.par },
].filter((x) => SENSOR_AVAILABILITY[x.type as SensorType]) as { type: SensorType; id: string }[];

export const depthSensor = (p: PlantId, d: Depth) => (d === 'upper' ? SENSOR_IDS.upper(p) : SENSOR_IDS.lower(p));

export interface PlantNow {
  upper: CurrentValue;
  lower: CurrentValue;
  soilTemp: CurrentValue;
  /** Superior − inferior (puntos de %), solo si ambas son válidas. */
  diff: number | null;
  status: 'ok' | 'partial' | 'no-data';
}

export function plantNow(s: IgrisSnapshot, p: PlantId): PlantNow {
  const upper = currentValue(s, SENSOR_IDS.upper(p));
  const lower = currentValue(s, SENSOR_IDS.lower(p));
  const soilTemp = currentValue(s, SENSOR_IDS.soilTemp(p));
  const diff = upper.value !== null && lower.value !== null ? upper.value - lower.value : null;
  const okCount = [upper, lower].filter((v) => v.status === 'ok').length;
  return { upper, lower, soilTemp, diff, status: okCount === 2 ? 'ok' : okCount === 1 ? 'partial' : 'no-data' };
}

/** Media de humedad (ambas profundidades o una) sobre un conjunto de plantas. */
export function moistureStats(
  s: IgrisSnapshot,
  plants: PlantId[],
  depth: Depth | 'both',
): Descriptive & { nTotal: number } {
  const vals: (number | null)[] = [];
  for (const p of plants) {
    if (depth === 'both') {
      // Media por planta solo si ambas profundidades son válidas.
      const n = plantNow(s, p);
      vals.push(n.upper.value !== null && n.lower.value !== null ? (n.upper.value + n.lower.value) / 2 : null);
    } else vals.push(currentValue(s, depthSensor(p, depth)).value);
  }
  return { ...describe(vals), nTotal: plants.length };
}

export function plantsOf(s: IgrisSnapshot, t: TreatmentId): PlantId[] {
  return s.plants.filter((p) => p.treatmentId === t && p.status === 'active').map((p) => p.id);
}

export function activePlants(s: IgrisSnapshot): PlantId[] {
  return s.plants.filter((p) => p.status === 'active').map((p) => p.id);
}

// ---------- series históricas ----------

export type RangeKey = '24h' | '72h' | '7d';
export const RANGE_HOURS: Record<RangeKey, number> = { '24h': 24, '72h': 72, '7d': 168 };
/** Resolución de visualización por rango (minutos), múltiplo del bucket base. */
const DISPLAY_RES_MIN: Record<RangeKey, number> = { '24h': 10, '72h': 30, '7d': 60 };

/** Re-agrega una serie a la resolución de visualización (media ponderada por n). */
export function displaySeries(points: AggregatedPoint[] | undefined, range: RangeKey, now: number): AggregatedPoint[] {
  if (!points) return [];
  const from = now - RANGE_HOURS[range] * 3_600_000;
  const res = Math.max(DISPLAY_RES_MIN[range], TIMING.historyBucketMin) * 60_000;
  const out: AggregatedPoint[] = [];
  let cur: AggregatedPoint | null = null;
  let sum = 0;
  for (const p of points) {
    if (p.t < from) continue;
    const bt = Math.floor(p.t / res) * res;
    if (!cur || cur.t !== bt) {
      if (cur) out.push(finish(cur, sum));
      cur = { t: bt, mean: null, min: null, max: null, n: 0 };
      sum = 0;
    }
    if (p.mean !== null && p.n > 0) {
      sum += p.mean * p.n;
      cur.n += p.n;
      cur.min = cur.min === null ? p.min : Math.min(cur.min, p.min ?? cur.min);
      cur.max = cur.max === null ? p.max : Math.max(cur.max, p.max ?? cur.max);
    }
  }
  if (cur) out.push(finish(cur, sum));
  return out;
}

function finish(p: AggregatedPoint, sum: number): AggregatedPoint {
  return { ...p, mean: p.n > 0 ? sum / p.n : null };
}

export interface GroupRow {
  t: number;
  [key: string]: number | null;
}

/**
 * Serie temporal por tratamiento: en cada instante, media entre plantas de la
 * media de la planta (cada planta pesa igual). Incluye `${T}_n` y `${T}_sd`.
 */
export function treatmentSeries(s: IgrisSnapshot, depth: Depth, range: RangeKey): GroupRow[] {
  const rows = new Map<number, GroupRow>();
  for (const tr of TREATMENT_IDS) {
    const perPlant = plantsOf(s, tr).map((p) => displaySeries(s.history.get(depthSensor(p, depth)), range, s.now));
    const byT = new Map<number, (number | null)[]>();
    for (const series of perPlant) for (const pt of series) {
      if (!byT.has(pt.t)) byT.set(pt.t, []);
      byT.get(pt.t)!.push(pt.mean);
    }
    for (const [t, vals] of byT) {
      const d = describe(vals);
      const row = rows.get(t) ?? { t };
      row[tr] = d.mean;
      row[`${tr}_n`] = d.n;
      row[`${tr}_sd`] = d.sd;
      rows.set(t, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.t - b.t);
}

/** Tendencia de las últimas `hours` horas de un sensor (unidades/h). */
export function sensorTrend(s: IgrisSnapshot, sensorId: string, hours = 6): number | null {
  const pts = s.history.get(sensorId);
  if (!pts) return null;
  const from = s.now - hours * 3_600_000;
  return slopePerHour(pts.filter((p) => p.t >= from).map((p) => ({ t: p.t, v: p.mean })));
}

/** Valor medio del sensor hace `hoursAgo` horas (bucket más cercano con datos). */
export function valueAt(s: IgrisSnapshot, sensorId: string, hoursAgo: number): number | null {
  const pts = s.history.get(sensorId);
  if (!pts) return null;
  const target = s.now - hoursAgo * 3_600_000;
  let best: AggregatedPoint | null = null;
  for (const p of pts) {
    if (p.mean === null) continue;
    if (!best || Math.abs(p.t - target) < Math.abs(best.t - target)) best = p;
  }
  return best && Math.abs(best.t - target) < 3_600_000 ? best.mean : null;
}

// ---------- Evapotranspiración (balance hídrico del suelo) ----------

/** Espesor de suelo que representa cada sensor de humedad (mm): 0–9 cm y 9–25 cm. */
export const LAYER_MM = { upper: 90, lower: 160 } as const;

export interface EtEstimate {
  /** ET acumulada en las últimas 24 h (mm/día). */
  daily: number | null;
  /** ET de la última hora (mm/h). */
  lastHour: number | null;
  /** Serie horaria de las últimas 24 h (mm/h) para gráficos. */
  hourly: (number | null)[];
}

/**
 * ET estimada por balance hídrico: almacenamiento S = θ3·90 mm + θ15·160 mm.
 * Solo se suman las DISMINUCIONES de S (las subidas son riegos), sin drenaje profundo:
 * es una estimación operativa, no una medición lisimétrica.
 */
export function evapotranspiration(s: IgrisSnapshot, plant: PlantId): EtEstimate {
  const up = s.history.get(depthSensor(plant, 'upper')) ?? [];
  const lo = new Map((s.history.get(depthSensor(plant, 'lower')) ?? []).map((p) => [p.t, p.mean]));
  const from = s.now - 24 * 3_600_000;
  // Almacenamiento promediado por hora: así el ruido del sensor no se suma como pérdida de agua.
  const byHour = new Map<number, number[]>();
  for (const p of up) {
    if (p.t < from) continue;
    const l = lo.get(p.t);
    if (p.mean === null || l == null) continue;
    const h = Math.floor((p.t - from) / 3_600_000);
    if (!byHour.has(h)) byHour.set(h, []);
    byHour.get(h)!.push((p.mean / 100) * LAYER_MM.upper + (l / 100) * LAYER_MM.lower);
  }
  const storage = Array.from({ length: 24 }, (_, h) => {
    const v = byHour.get(h);
    return { t: from + h * 3_600_000, S: v && v.length ? v.reduce((a, b) => a + b, 0) / v.length : null };
  });
  const hourly = new Map<number, number>();
  let total = 0;
  let pairs = 0;
  for (let i = 1; i < storage.length; i++) {
    const a = storage[i - 1].S;
    const b = storage[i].S;
    if (a === null || b === null) continue;
    pairs++;
    const loss = Math.max(0, a - b);
    total += loss;
    const h = Math.floor((storage[i].t - from) / 3_600_000);
    hourly.set(h, (hourly.get(h) ?? 0) + loss);
  }
  if (pairs < 6) return { daily: null, lastHour: null, hourly: [] };
  const coverage = pairs / Math.max(1, storage.length - 1);
  const series = Array.from({ length: 24 }, (_, h) => hourly.get(h) ?? null);
  return { daily: total / coverage, lastHour: series[23] ?? series[22] ?? null, hourly: series };
}
