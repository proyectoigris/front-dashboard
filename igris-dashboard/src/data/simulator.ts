/**
 * Simulador de datos de DEMOSTRACIÓN. Nada de lo generado aquí es evidencia
 * experimental: todo objeto lleva origin/dataOrigin = 'simulated'.
 *
 * Modelo (deliberadamente simple, solo para validar visualización):
 *  - Fotoperiodo 16 h (06:00–22:00). PAR, temperatura, HR y CO₂ siguen el ciclo.
 *  - Riego diario a las 08:00. Riego normal recarga a ~36 % (3 cm) / ~40 % (15 cm);
 *    déficit hídrico recarga con el 50 % del volumen de referencia.
 *  - El sensor superior responde de inmediato y se seca más rápido; el inferior
 *    responde con retardo (primer orden) y se seca más lento.
 *  - La inoculación NO tiene efecto en el simulador (para no sugerir resultados).
 *  - Se inyectan fallos de calidad: huecos, una lectura sospechosa y un sensor offline.
 */
import {
  CHAMBER_LAYOUT,
  MOISTURE_DEPTHS,
  PLANT_ASSIGNMENT,
  SENSOR_AVAILABILITY,
  TIMING,
  TREATMENTS,
  VARIABLE_META,
} from '../config/experiment';
import type {
  AggregatedPoint,
  BiologicalMeasurement,
  DeviceStatus,
  ExperimentalEvent,
  Plant,
  PlantId,
  Sensor,
  SensorReading,
  SensorType,
} from '../types/domain';

// ---------- utilidades ----------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261026);
const gauss = () => {
  const u = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const HOUR = 3_600_000;
const BUCKET_MS = TIMING.historyBucketMin * 60_000;

function localHour(t: number) {
  const d = new Date(t);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/** Nivel de luz 0–1 con rampas de 30 min al encender/apagar. */
function lightLevel(t: number) {
  const h = localHour(t);
  if (h < 6 || h >= 22) return 0;
  if (h < 6.5) return (h - 6) / 0.5;
  if (h > 21.5) return (22 - h) / 0.5;
  return 1;
}

// ---------- catálogo ----------

export const SENSOR_IDS = {
  airTemp: 'ENV-TA',
  airHum: 'ENV-HR',
  co2: 'ENV-CO2',
  par: 'ENV-PAR',
  upper: (p: PlantId) => `${p}-SM03`,
  lower: (p: PlantId) => `${p}-SM15`,
  soilTemp: (p: PlantId) => `${p}-ST`,
};

const ESTABLISHED_DAYS_AGO = 21;

export function buildCatalog(now: number): { plants: Plant[]; sensors: Sensor[] } {
  const established = new Date(now - ESTABLISHED_DAYS_AGO * 24 * HOUR).toISOString().slice(0, 10);
  const plants: Plant[] = [];
  const ids = Object.keys(PLANT_ASSIGNMENT) as PlantId[];
  ids.forEach((id, i) => {
    // Posición física: también configurable; aquí se recorre la cámara por filas.
    const row = Math.floor(i / CHAMBER_LAYOUT.cols);
    const col = i % CHAMBER_LAYOUT.cols;
    plants.push({
      id,
      treatmentId: PLANT_ASSIGNMENT[id],
      position: { row, col, label: `${String.fromCharCode(65 + row)}${col + 1}` },
      establishedAt: established,
      status: 'active',
    });
  });

  const env = (id: string, type: SensorType, location: string): Sensor => ({
    id,
    type,
    unit: VARIABLE_META[type].unit,
    scope: 'chamber',
    location,
    status: SENSOR_AVAILABILITY[type] ? 'online' : 'disabled',
  });

  const sensors: Sensor[] = [
    env(SENSOR_IDS.airTemp, 'air_temperature', 'Cámara · nivel de dosel'),
    env(SENSOR_IDS.airHum, 'air_humidity', 'Cámara · nivel de dosel'),
    env(SENSOR_IDS.co2, 'co2', 'Cámara · centro'),
    env(SENSOR_IDS.par, 'par', 'Cámara · nivel de dosel'),
  ];
  for (const p of plants) {
    sensors.push(
      {
        id: SENSOR_IDS.upper(p.id), type: 'soil_moisture', unit: VARIABLE_META.soil_moisture.unit,
        scope: p.id, depthCm: MOISTURE_DEPTHS.upper, location: `Rizotrón ${p.id} · ${MOISTURE_DEPTHS.upper} cm`,
        calibration: { method: 'Curva gravimétrica (pendiente)', date: established }, status: 'online',
      },
      {
        id: SENSOR_IDS.lower(p.id), type: 'soil_moisture', unit: VARIABLE_META.soil_moisture.unit,
        scope: p.id, depthCm: MOISTURE_DEPTHS.lower, location: `Rizotrón ${p.id} · ${MOISTURE_DEPTHS.lower} cm`,
        calibration: { method: 'Curva gravimétrica (pendiente)', date: established }, status: 'online',
      },
      {
        id: SENSOR_IDS.soilTemp(p.id), type: 'soil_temperature', unit: VARIABLE_META.soil_temperature.unit,
        scope: p.id, depthCm: 10, location: `Rizotrón ${p.id} · 10 cm`,
        status: SENSOR_AVAILABILITY.soil_temperature ? 'online' : 'disabled',
      },
    );
  }
  return { plants, sensors };
}

// ---------- fallos inyectados (demo de calidad de datos) ----------

/** Sensor que deja de reportar 25 min antes de "ahora" → alerta de dispositivo. */
export const DEMO_OFFLINE_SENSOR = SENSOR_IDS.lower('P17');
/** Sensor con lecturas sospechosas esporádicas. */
export const DEMO_SUSPECT_SENSOR = SENSOR_IDS.upper('P09');

// ---------- modelo físico simplificado ----------

interface SoilState {
  upper: number;
  lower: number;
  soilTemp: number;
  /** Factor individual de consumo hídrico (variabilidad entre plantas). */
  factor: number;
  lastIrrigationDay: number;
}

interface EnvState {
  temp: number;
  rh: number;
  co2: number;
}

const REFERENCE = { upper: 36, lower: 40 };
const RESIDUAL = { upper: 9, lower: 15 };

function irrigationTarget(plant: Plant) {
  const deficit = TREATMENTS[plant.treatmentId].waterRegime === 'deficit';
  // Déficit: se aporta el 50 % del volumen de referencia.
  const f = deficit ? 0.5 : 1;
  return {
    upper: RESIDUAL.upper + (REFERENCE.upper - RESIDUAL.upper) * f,
    lower: RESIDUAL.lower + (REFERENCE.lower - RESIDUAL.lower) * f,
  };
}

function dayIndex(t: number) {
  const d = new Date(t);
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / (24 * HOUR));
}

export class ChamberSimulator {
  readonly plants: Plant[];
  readonly sensors: Sensor[];
  private soil = new Map<PlantId, SoilState>();
  private env: EnvState = { temp: 21, rh: 70, co2: 600 };
  private t: number;

  constructor(now: number) {
    const cat = buildCatalog(now);
    this.plants = cat.plants;
    this.sensors = cat.sensors;
    // Alineado a buckets para que la agregación en vivo continúe la historia.
    this.t = Math.floor((now - TIMING.historyDays * 24 * HOUR) / BUCKET_MS) * BUCKET_MS;
    for (const p of this.plants) {
      const tgt = irrigationTarget(p);
      this.soil.set(p.id, {
        upper: tgt.upper - 4,
        lower: tgt.lower - 3,
        soilTemp: 20,
        factor: 0.85 + rand() * 0.3,
        lastIrrigationDay: dayIndex(this.t),
      });
    }
  }

  /** Avanza el modelo dt ms. */
  private step(dtMs: number) {
    this.t += dtMs;
    const dtH = dtMs / HOUR;
    const light = lightLevel(this.t);

    // Ambiente: relajación de primer orden hacia el objetivo del ciclo.
    const a = 1 - Math.exp(-dtH / 0.4);
    this.env.temp += (21 + 4 * light - this.env.temp) * a;
    this.env.rh += (72 - 14 * light - this.env.rh) * a;
    this.env.co2 += (640 - 210 * light - this.env.co2) * a;

    const today = dayIndex(this.t);
    const irrigateNow = localHour(this.t) >= 8;
    // Calibrado para una ET plausible de tomate en cámara (~2–6 mm/día según tratamiento).
    const dryRate = 0.3 * (0.012 + 0.03 * light) * (1 + (this.env.temp - 21) * 0.04);

    for (const p of this.plants) {
      const s = this.soil.get(p.id)!;
      const tgt = irrigationTarget(p);
      if (irrigateNow && s.lastIrrigationDay !== today) {
        s.lastIrrigationDay = today;
        s.upper = Math.max(s.upper, tgt.upper + gauss() * 0.6);
      }
      // Superior: secado exponencial hacia el residual.
      s.upper -= (s.upper - RESIDUAL.upper) * dryRate * s.factor * dtH;
      // Inferior: recibe infiltración del superior con retardo y se seca más lento.
      const infiltration = Math.max(0, s.upper - tgt.upper * 0.82) * 0.9 * dtH;
      s.lower += infiltration - (s.lower - RESIDUAL.lower) * dryRate * 0.55 * s.factor * dtH;
      s.lower = Math.min(s.lower, tgt.lower + 1.5);
      // Temperatura del suelo: sigue al aire con inercia.
      s.soilTemp += (this.env.temp - 1.2 - s.soilTemp) * (1 - Math.exp(-dtH / 2.5));
    }
  }

  /** Valores instantáneos con ruido de medición. */
  private sample(): Map<string, number> {
    const m = new Map<string, number>();
    const light = lightLevel(this.t);
    m.set(SENSOR_IDS.airTemp, this.env.temp + gauss() * 0.12);
    m.set(SENSOR_IDS.airHum, clamp(this.env.rh + gauss() * 0.8, 0, 100));
    m.set(SENSOR_IDS.co2, Math.max(300, this.env.co2 + gauss() * 9));
    m.set(SENSOR_IDS.par, Math.max(0, light * (455 + gauss() * 10)));
    for (const p of this.plants) {
      const s = this.soil.get(p.id)!;
      m.set(SENSOR_IDS.upper(p.id), clamp(s.upper + gauss() * 0.25, 0, 100));
      m.set(SENSOR_IDS.lower(p.id), clamp(s.lower + gauss() * 0.2, 0, 100));
      m.set(SENSOR_IDS.soilTemp(p.id), s.soilTemp + gauss() * 0.08);
    }
    return m;
  }

  private enabled(sensorId: string) {
    return this.sensors.find((s) => s.id === sensorId)?.status !== 'disabled';
  }

  /** Genera la historia agregada (buckets) desde el inicio hasta `now`. */
  generateHistory(now: number): Map<string, AggregatedPoint[]> {
    const hist = new Map<string, AggregatedPoint[]>();
    for (const s of this.sensors) if (this.enabled(s.id)) hist.set(s.id, []);
    const subSteps = 5;
    const offlineFrom = now - 25 * 60_000;
    const suspectBucket = now - 31 * HOUR;

    while (this.t + BUCKET_MS <= now) {
      const bucketStart = this.t;
      const acc = new Map<string, number[]>();
      for (let i = 0; i < subSteps; i++) {
        this.step(BUCKET_MS / subSteps);
        for (const [id, v] of this.sample()) {
          if (!hist.has(id)) continue;
          if (!acc.has(id)) acc.set(id, []);
          acc.get(id)!.push(v);
        }
      }
      for (const [id, vals] of acc) {
        let usable = vals;
        if (id === DEMO_OFFLINE_SENSOR && bucketStart >= offlineFrom) usable = [];
        else if (rand() < 0.004) usable = []; // hueco de transmisión
        const point: AggregatedPoint =
          usable.length === 0
            ? { t: bucketStart, mean: null, min: null, max: null, n: 0 }
            : {
                t: bucketStart,
                mean: usable.reduce((a, b) => a + b, 0) / usable.length,
                min: Math.min(...usable),
                max: Math.max(...usable),
                n: usable.length,
              };
        // Una lectura sospechosa aislada (se excluye del promedio: n intacto, max marcado).
        if (id === DEMO_SUSPECT_SENSOR && Math.abs(bucketStart - suspectBucket) < BUCKET_MS / 2 && point.max !== null) {
          point.max = 78.4;
        }
        hist.get(id)!.push(point);
      }
    }
    return hist;
  }

  /** Una ronda de adquisición en vivo (cada ~3–4 s). */
  tick(now: number): SensorReading[] {
    if (now > this.t) this.step(now - this.t);
    const out: SensorReading[] = [];
    for (const [id, v] of this.sample()) {
      if (!this.enabled(id)) continue;
      if (id === DEMO_OFFLINE_SENSOR) continue; // sin datos: dispositivo caído
      if (id === DEMO_SUSPECT_SENSOR && rand() < 0.01) {
        out.push({ sensorId: id, t: now, value: 78 + rand() * 4, quality: 'suspect' });
        continue;
      }
      if (rand() < 0.003) {
        out.push({ sensorId: id, t: now, value: null, quality: 'missing' });
        continue;
      }
      out.push({ sensorId: id, t: now, value: v, quality: 'valid' });
    }
    return out;
  }
}

export function buildDemoEvents(now: number): ExperimentalEvent[] {
  const events: ExperimentalEvent[] = [];
  const day = 24 * HOUR;
  const start = new Date(now - ESTABLISHED_DAYS_AGO * day);
  start.setHours(10, 0, 0, 0);
  events.push({
    id: 'EV-EST', t: start.getTime(), scope: 'chamber', type: 'note',
    description: 'Establecimiento de las 24 plantas en rizotrones.', origin: 'simulated',
  });
  for (const tr of ['T2', 'T4'] as const) {
    events.push({
      id: `EV-INOC-${tr}`, t: start.getTime() + 2 * day, scope: tr, type: 'inoculation',
      description: `Inoculación bacteriana del tratamiento ${tr}.`, origin: 'simulated',
    });
  }
  events.push({
    id: 'EV-DEF', t: start.getTime() + 7 * day, scope: 'chamber', type: 'note',
    description: 'Inicio del régimen de déficit hídrico (T3, T4).', origin: 'simulated',
  });
  for (let d = TIMING.historyDays; d >= 0; d--) {
    const t = new Date(now - d * day);
    t.setHours(8, 0, 0, 0);
    if (t.getTime() <= now) {
      events.push({
        id: `EV-IRR-${t.toISOString().slice(0, 10)}`, t: t.getTime(), scope: 'chamber', type: 'irrigation',
        description: 'Riego programado (manual, según protocolo).', origin: 'simulated',
      });
    }
  }
  events.push({
    id: 'EV-MAINT', t: now - 3 * day - 5 * HOUR, scope: 'P17', type: 'maintenance',
    description: 'Revisión de cableado del sensor inferior.', origin: 'simulated',
  });
  return events.sort((a, b) => a.t - b.t);
}

/** Sin mediciones biológicas: no se inventan. El backend las proveerá. */
export const DEMO_BIOLOGICAL: BiologicalMeasurement[] = [];

export function buildDevices(now: number): DeviceStatus[] {
  return [
    { id: 'DEV-ENV', label: 'Nodo ambiental', status: 'connected', lastSeen: now },
    { id: 'DEV-SOIL-A', label: 'Nodo suelo A (P01–P12)', status: 'connected', lastSeen: now },
    { id: 'DEV-SOIL-B', label: 'Nodo suelo B (P13–P24)', status: 'degraded', lastSeen: now },
    { id: 'DEV-LAB', label: 'Servidor laboratorio', status: 'connected', lastSeen: now },
  ];
}
