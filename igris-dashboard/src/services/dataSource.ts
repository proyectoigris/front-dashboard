/**
 * Capa de acceso a datos. El resto de la app solo conoce `IgrisDataSource`;
 * cambiar de datos simulados a FastAPI es cuestión de VITE_DATA_SOURCE=api.
 *
 * Contrato esperado del backend (fase siguiente):
 *   GET  /api/bootstrap        → BootstrapPayload (catálogo + historia agregada)
 *   GET  /api/history?sensor=…&from=…&to=…&bucket=10m → AggregatedPoint[]
 *   WS   /ws/readings          → mensajes { type: 'readings', data: SensorReading[] }
 *                                 y { type: 'devices', data: DeviceStatus[] }
 */
import { TIMING } from '../config/experiment';
import {
  ChamberSimulator,
  DEMO_BIOLOGICAL,
  buildDemoEvents,
  buildDevices,
} from '../data/simulator';
import type {
  AggregatedPoint,
  BiologicalMeasurement,
  DataOrigin,
  DeviceStatus,
  ExperimentalEvent,
  Plant,
  Sensor,
  SensorReading,
} from '../types/domain';

export interface BootstrapPayload {
  origin: DataOrigin;
  generatedAt: number;
  plants: Plant[];
  sensors: Sensor[];
  history: Record<string, AggregatedPoint[]>;
  events: ExperimentalEvent[];
  biological: BiologicalMeasurement[];
  devices: DeviceStatus[];
}

export interface LiveHandlers {
  onReadings: (readings: SensorReading[]) => void;
  onDevices?: (devices: DeviceStatus[]) => void;
  onConnection?: (state: 'open' | 'closed' | 'error') => void;
}

export interface IgrisDataSource {
  readonly origin: DataOrigin;
  bootstrap(): Promise<BootstrapPayload>;
  /** Devuelve una función para cancelar la suscripción. */
  subscribe(handlers: LiveHandlers): () => void;
}

// ---------- Simulado ----------

export class MockDataSource implements IgrisDataSource {
  readonly origin = 'simulated' as const;
  private sim: ChamberSimulator | null = null;

  async bootstrap(): Promise<BootstrapPayload> {
    const now = Date.now();
    this.sim = new ChamberSimulator(now);
    const hist = this.sim.generateHistory(now);
    return {
      origin: 'simulated',
      generatedAt: now,
      plants: this.sim.plants,
      sensors: this.sim.sensors,
      history: Object.fromEntries(hist),
      events: buildDemoEvents(now),
      biological: DEMO_BIOLOGICAL,
      devices: buildDevices(now),
    };
  }

  subscribe(handlers: LiveHandlers): () => void {
    if (!this.sim) throw new Error('bootstrap() debe llamarse antes de subscribe()');
    const sim = this.sim;
    handlers.onConnection?.('open');
    const tick = () => {
      const now = Date.now();
      handlers.onReadings(sim.tick(now));
      handlers.onDevices?.(buildDevices(now));
    };
    tick(); // primera lectura inmediata: el dashboard arranca con datos frescos
    const id = window.setInterval(tick, TIMING.acquisitionMs);
    return () => {
      window.clearInterval(id);
      handlers.onConnection?.('closed');
    };
  }
}

// ---------- FastAPI (preparado, no usado aún) ----------

export class ApiDataSource implements IgrisDataSource {
  readonly origin = 'measured' as const;
  constructor(private baseUrl = '') {}

  async bootstrap(): Promise<BootstrapPayload> {
    const res = await fetch(`${this.baseUrl}/api/bootstrap`);
    if (!res.ok) throw new Error(`API /bootstrap respondió ${res.status}`);
    return (await res.json()) as BootstrapPayload;
  }

  subscribe(handlers: LiveHandlers): () => void {
    let ws: WebSocket | null = null;
    let retry: number | undefined;
    let closed = false;

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws/readings`);
      ws.onopen = () => handlers.onConnection?.('open');
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data as string) as
          | { type: 'readings'; data: SensorReading[] }
          | { type: 'devices'; data: DeviceStatus[] };
        if (msg.type === 'readings') handlers.onReadings(msg.data);
        else if (msg.type === 'devices') handlers.onDevices?.(msg.data);
      };
      ws.onerror = () => handlers.onConnection?.('error');
      ws.onclose = () => {
        handlers.onConnection?.('closed');
        if (!closed) retry = window.setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      closed = true;
      window.clearTimeout(retry);
      ws?.close();
    };
  }
}

export function createDataSource(): IgrisDataSource {
  return import.meta.env.VITE_DATA_SOURCE === 'api' ? new ApiDataSource() : new MockDataSource();
}
