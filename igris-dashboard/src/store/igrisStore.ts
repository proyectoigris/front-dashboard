/**
 * Almacén central. Separa explícitamente:
 *  - adquisición: `ingest()` se llama con cada lote (~3,5 s),
 *  - agregación: buckets de TIMING.historyBucketMin minutos,
 *  - visualización: se publica un snapshot nuevo cada TIMING.uiRefreshMs.
 * Así los gráficos no se redibujan con cada medición.
 */
import { useSyncExternalStore } from 'react';
import { TIMING } from '../config/experiment';
import { computeAlerts } from '../lib/alerts';
import { createDataSource, type IgrisDataSource } from '../services/dataSource';
import type {
  AggregatedPoint,
  Alert,
  BiologicalMeasurement,
  DataOrigin,
  DeviceStatus,
  ExperimentalEvent,
  Plant,
  PlantId,
  Sensor,
  SensorReading,
} from '../types/domain';

const BUCKET_MS = TIMING.historyBucketMin * 60_000;
const KEEP_MS = TIMING.historyDays * 24 * 3_600_000;

export interface IgrisSnapshot {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  origin: DataOrigin;
  /** Instante de publicación del snapshot (referencia para "datos recientes"). */
  now: number;
  version: number;
  plants: Plant[];
  plantById: Map<PlantId, Plant>;
  sensors: Sensor[];
  sensorById: Map<string, Sensor>;
  history: Map<string, AggregatedPoint[]>;
  /** Última lectura recibida (cualquier calidad). */
  latest: Map<string, SensorReading>;
  /** Última lectura válida. */
  lastValid: Map<string, SensorReading>;
  events: ExperimentalEvent[];
  biological: BiologicalMeasurement[];
  devices: DeviceStatus[];
  connection: 'open' | 'closed' | 'error' | 'idle';
  lastReadingAt: number | null;
  readingsReceived: number;
  alerts: Alert[];
}

const empty: IgrisSnapshot = {
  status: 'loading',
  origin: 'simulated',
  now: Date.now(),
  version: 0,
  plants: [],
  plantById: new Map(),
  sensors: [],
  sensorById: new Map(),
  history: new Map(),
  latest: new Map(),
  lastValid: new Map(),
  events: [],
  biological: [],
  devices: [],
  connection: 'idle',
  lastReadingAt: null,
  readingsReceived: 0,
  alerts: [],
};

class IgrisStore {
  private snap: IgrisSnapshot = empty;
  private work: IgrisSnapshot = { ...empty };
  private listeners = new Set<() => void>();
  private dirty = false;
  private timer: number | undefined;
  private unsub: (() => void) | undefined;
  private acknowledged = new Set<string>();

  constructor(private source: IgrisDataSource) {}

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getSnapshot = () => this.snap;

  async start() {
    if (this.timer !== undefined) return;
    this.timer = window.setInterval(() => this.dirty && this.publish(), TIMING.uiRefreshMs);
    try {
      const b = await this.source.bootstrap();
      const history = new Map(Object.entries(b.history));
      const lastValid = new Map<string, SensorReading>();
      // Inicializa "última válida" con el último bucket con datos (marca su tiempo real).
      for (const [id, pts] of history) {
        for (let i = pts.length - 1; i >= 0; i--) {
          const p = pts[i];
          if (p.mean !== null) {
            lastValid.set(id, { sensorId: id, t: p.t + BUCKET_MS, value: p.mean, quality: 'valid' });
            break;
          }
        }
      }
      this.work = {
        ...this.work,
        status: 'ready',
        origin: b.origin,
        plants: b.plants,
        plantById: new Map(b.plants.map((p) => [p.id, p])),
        sensors: b.sensors,
        sensorById: new Map(b.sensors.map((s) => [s.id, s])),
        history,
        latest: new Map(lastValid),
        lastValid,
        events: b.events,
        biological: b.biological,
        devices: b.devices,
        lastReadingAt: b.generatedAt,
      };
      this.unsub = this.source.subscribe({
        onReadings: (r) => this.ingest(r),
        onDevices: (d) => {
          this.work.devices = d;
          this.dirty = true;
        },
        onConnection: (c) => {
          this.work.connection = c;
          this.dirty = true;
        },
      });
      this.publish();
    } catch (e) {
      this.work = { ...this.work, status: 'error', error: e instanceof Error ? e.message : String(e) };
      this.publish();
    }
  }

  stop() {
    this.unsub?.();
    window.clearInterval(this.timer);
    this.timer = undefined;
  }

  ingest(readings: SensorReading[]) {
    const w = this.work;
    for (const r of readings) {
      w.latest.set(r.sensorId, r);
      w.readingsReceived++;
      if (w.lastReadingAt === null || r.t > w.lastReadingAt) w.lastReadingAt = r.t;
      if (r.quality !== 'valid' || r.value === null) continue;
      w.lastValid.set(r.sensorId, r);
      const series = w.history.get(r.sensorId);
      if (!series) continue;
      const bt = Math.floor(r.t / BUCKET_MS) * BUCKET_MS;
      const last = series[series.length - 1];
      if (last && last.t === bt) {
        if (last.mean === null) {
          last.mean = last.min = last.max = r.value;
          last.n = 1;
        } else {
          last.mean = (last.mean * last.n + r.value) / (last.n + 1);
          last.min = Math.min(last.min ?? r.value, r.value);
          last.max = Math.max(last.max ?? r.value, r.value);
          last.n++;
        }
      } else {
        series.push({ t: bt, mean: r.value, min: r.value, max: r.value, n: 1 });
        while (series.length && series[0].t < r.t - KEEP_MS) series.shift();
      }
    }
    this.dirty = true;
  }

  acknowledge(alertId: string) {
    this.acknowledged.add(alertId);
    this.publish();
  }

  private publish() {
    const now = Date.now();
    this.dirty = false;
    const alerts = this.work.status === 'ready' ? computeAlerts(this.work, now, this.acknowledged) : [];
    this.snap = { ...this.work, now, alerts, version: this.snap.version + 1 };
    this.listeners.forEach((l) => l());
  }
}

export const igrisStore = new IgrisStore(createDataSource());

export function useIgris<T>(selector: (s: IgrisSnapshot) => T): T {
  const snap = useSyncExternalStore(igrisStore.subscribe, igrisStore.getSnapshot);
  return selector(snap);
}

export function useSnapshot(): IgrisSnapshot {
  return useSyncExternalStore(igrisStore.subscribe, igrisStore.getSnapshot);
}
