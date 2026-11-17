/**
 * Vistas de detalle de cada sección. Una idea por pantalla: un selector a la
 * izquierda o arriba y un gráfico grande; cifras en tablas alineadas.
 */
import { useMemo, useState } from 'react';
import { MOISTURE_DEPTHS, THRESHOLDS, TREATMENTS, TREATMENT_IDS, VARIABLE_META } from '../../config/experiment';
import {
  activePlants,
  currentValue,
  displaySeries,
  ENV_SENSORS,
  evapotranspiration,
  moistureStats,
  plantNow,
  plantsOf,
  type Depth,
} from '../../lib/analytics';
import { describe, fmt } from '../../lib/stats';
import { useSnapshot } from '../../store/igrisStore';
import { useUi } from '../../state/ui';
import type { PlantId, SensorType, TreatmentId } from '../../types/domain';
import { SensorChart } from '../charts/SensorChart';
import { Sparkline } from '../charts/Sparkline';
import { TreatmentSeriesChart } from '../charts/TreatmentSeriesChart';
import { Panel, Segmented } from '../common/primitives';
import { AlertsList } from './AlertsList';

const RANGE_OPTS = [
  { value: '24h' as const, label: '24 h' },
  { value: '72h' as const, label: '72 h' },
  { value: '7d' as const, label: '7 días' },
];
const DEPTH_OPTS = [
  { value: 'upper' as const, label: `${MOISTURE_DEPTHS.upper} cm` },
  { value: 'lower' as const, label: `${MOISTURE_DEPTHS.lower} cm` },
];
const SERIES_COLOR = '#0085de';

function useIrrigation() {
  const s = useSnapshot();
  return useMemo(() => s.events.filter((e) => e.type === 'irrigation').map((e) => ({ t: e.t, label: e.description })), [s.events]);
}

/** Botón-lista de selección (columna izquierda de los detalles). */
function Choice({ active, onClick, label, value, unit }: { active: boolean; onClick: () => void; label: string; value: string; unit: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full flex-col rounded-xl border px-5 py-4 text-left transition-colors ${
        active ? 'border-[#74b43b] bg-white shadow-sm' : 'border-transparent bg-white/80 hover:bg-white'
      }`}
    >
      <span className={`text-sm ${active ? 'text-ink' : 'text-ink-3'}`}>{label}</span>
      <span className="mt-1 flex items-baseline gap-1.5">
        <span className="stat text-3xl font-semibold text-ink">{value}</span>
        <span className="text-sm text-ink-3">{unit}</span>
      </span>
    </button>
  );
}

// ---------- Ambiente ----------

export function EnvironmentDetail() {
  const s = useSnapshot();
  const ui = useUi();
  const irrigation = useIrrigation();
  const [type, setType] = useState<SensorType>(ENV_SENSORS[0].type);
  const sel = ENV_SENSORS.find((e) => e.type === type) ?? ENV_SENSORS[0];
  const meta = VARIABLE_META[sel.type];
  const th = (THRESHOLDS as Record<string, unknown>)[sel.type] as { min: number; max: number } | undefined;
  const pts = displaySeries(s.history.get(sel.id), ui.range, s.now);
  const d = describe(pts.map((p) => p.mean));

  return (
    <div className="grid h-full min-h-0 grid-cols-[280px_1fr] gap-4">
      <div className="flex flex-col gap-1">
        {ENV_SENSORS.map((e) => (
          <Choice
            key={e.id}
            active={e.type === sel.type}
            onClick={() => setType(e.type)}
            label={VARIABLE_META[e.type].label}
            value={fmt(currentValue(s, e.id).value, VARIABLE_META[e.type].decimals)}
            unit={VARIABLE_META[e.type].unit}
          />
        ))}
      </div>
      <Panel
        title={`${meta.label} (${meta.unit})`}
        right={<Segmented size="sm" value={ui.range} onChange={ui.setRange} options={RANGE_OPTS} />}
        bodyClassName="flex flex-col px-4 pb-4"
      >
        <div className="min-h-0 flex-1">
          <SensorChart
            series={[{ sensorId: sel.id, name: meta.short, color: SERIES_COLOR, band: true }]}
            range={ui.range}
            unit={meta.unit}
            decimals={meta.decimals}
            thresholds={th}
            events={irrigation}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-10 gap-y-2 border-t border-line pt-3 text-sm">
          <Stat label="Media del periodo" value={fmt(d.mean, meta.decimals)} unit={meta.unit} />
          <Stat label="Mínimo" value={fmt(d.min, meta.decimals)} unit={meta.unit} />
          <Stat label="Máximo" value={fmt(d.max, meta.decimals)} unit={meta.unit} />
          {th && <Stat label="Rango permitido" value={`${th.min}–${th.max}`} unit={meta.unit} />}
          <span className="ml-auto self-end text-xs text-ink-3">Banda: mín–máx de cada intervalo · líneas verticales: riegos</span>
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-0.5 text-lg font-medium text-ink">
        {value} <span className="text-xs font-normal text-ink-3">{unit}</span>
      </div>
    </div>
  );
}

// ---------- Suelo y tratamientos ----------

export function SoilDetail({ onTreatment }: { onTreatment: (t: TreatmentId) => void }) {
  const s = useSnapshot();
  const ui = useUi();
  const [depth, setDepth] = useState<Depth>('upper');
  const factor = (ids: TreatmentId[]) => moistureStats(s, ids.flatMap((t) => plantsOf(s, t)), depth);
  const contrasts = [
    { label: 'Riego normal vs déficit', a: factor(['T1', 'T2']), b: factor(['T3', 'T4']) },
    { label: 'Sin inocular vs inoculado', a: factor(['T1', 'T3']), b: factor(['T2', 'T4']) },
  ];

  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_440px] gap-4">
      <Panel
        title={`Humedad del suelo por tratamiento · ${depth === 'upper' ? MOISTURE_DEPTHS.upper : MOISTURE_DEPTHS.lower} cm (%)`}
        right={
          <div className="flex gap-3">
            <Segmented size="sm" value={depth} onChange={setDepth} options={DEPTH_OPTS} />
            <Segmented size="sm" value={ui.range} onChange={ui.setRange} options={RANGE_OPTS} />
          </div>
        }
        bodyClassName="px-3 pb-3"
      >
        <TreatmentSeriesChart depth={depth} range={ui.range} />
      </Panel>

      <div className="flex min-h-0 flex-col gap-4">
        <Panel title="Valor actual" bodyClassName="px-4 pb-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th className="py-1.5 font-normal">Tratamiento</th>
                <th className="py-1.5 text-right font-normal">Media ± DE</th>
                <th className="py-1.5 text-right font-normal">n</th>
              </tr>
            </thead>
            <tbody className="num">
              {TREATMENT_IDS.map((id) => {
                const m = moistureStats(s, plantsOf(s, id), depth);
                return (
                  <tr key={id} onClick={() => onTreatment(id)} className="cursor-pointer border-t border-line hover:bg-panel-2">
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: TREATMENTS[id].color }} />
                        <span className="font-medium text-ink">{id}</span>
                        <span className="text-xs text-ink-3">
                          {TREATMENTS[id].waterRegime === 'normal' ? 'Normal' : 'Déficit'} · {TREATMENTS[id].inoculated ? 'Inoc.' : 'Sin inoc.'}
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-ink">
                      {fmt(m.mean)} <span className="text-ink-3">± {fmt(m.sd)}</span>
                    </td>
                    <td className="py-2.5 text-right text-ink-3">{m.n}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
        <Panel title="Comparación por factor" className="flex-1" bodyClassName="px-4 pb-3">
          {contrasts.map((c) => {
            const diff = c.a.mean !== null && c.b.mean !== null ? c.b.mean - c.a.mean : null;
            return (
              <div key={c.label} className="flex items-baseline justify-between border-t border-line py-3 first:border-t-0">
                <span className="text-sm text-ink-2">{c.label}</span>
                <span className="num text-sm text-ink">
                  {fmt(c.a.mean)} → {fmt(c.b.mean)} %
                  <span className="ml-2 text-ink-3">({diff === null ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`})</span>
                </span>
              </div>
            );
          })}
          <p className="mt-1 text-xs text-ink-3">Descriptivo: sin prueba estadística. Cada planta pesa igual.</p>
        </Panel>
      </div>
    </div>
  );
}

// ---------- Plantas ----------

type SortKey = 'id' | 'et' | 'etHour';

/** Tabla de plantas centrada en la evapotranspiración (balance hídrico del suelo de cada rizotrón). */
export function PlantsDetail({ onPlant }: { onPlant: (t: TreatmentId, p: PlantId) => void }) {
  const s = useSnapshot();
  const [sort, setSort] = useState<SortKey>('id');
  const [filter, setFilter] = useState<TreatmentId | 'all'>('all');

  const all = useMemo(
    () => activePlants(s).map((p) => ({ p, plant: s.plantById.get(p)!, n: plantNow(s, p), et: evapotranspiration(s, p) })),
    [s.version], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const trMean = (t: TreatmentId) => {
    const v = all.filter((r) => r.plant.treatmentId === t).map((r) => r.et.daily).filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const maxEt = Math.max(1, ...all.map((r) => r.et.daily ?? 0));
  const rows = all
    .filter((r) => filter === 'all' || r.plant.treatmentId === filter)
    .sort((a, b) => {
      if (sort === 'id') return a.p.localeCompare(b.p);
      const av = (sort === 'et' ? a.et.daily : a.et.lastHour) ?? -Infinity;
      const bv = (sort === 'et' ? b.et.daily : b.et.lastHour) ?? -Infinity;
      return bv - av;
    });

  const Th = ({ k, children, right }: { k?: SortKey; children: string; right?: boolean }) => (
    <th className={`sticky top-0 z-10 bg-panel py-2.5 font-normal ${right ? 'text-right' : 'text-left'}`}>
      {k ? (
        <button onClick={() => setSort(k)} className={`rounded px-1 ${sort === k ? 'font-semibold text-ink' : 'text-ink-2 underline decoration-dotted underline-offset-4 hover:text-ink'}`}>
          {children}
          {sort === k && (k === 'id' ? ' ↑' : ' ↓ mayor')}
        </button>
      ) : (
        <span className="text-ink-3">{children}</span>
      )}
    </th>
  );

  return (
    <Panel
      title="Evapotranspiración de las 24 plantas"
      right={
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all' as const, label: 'Todas' }, ...TREATMENT_IDS.map((t) => ({ value: t, label: t }))]}
        />
      }
      bodyClassName="scroll-y px-4 pb-2"
    >
      <table className="w-full text-sm">
        <thead className="text-xs">
          <tr>
            <Th k="id">Planta</Th>
            <Th>Tratamiento</Th>
            <Th>Posición</Th>
            <Th k="et" right>ET 24 h (mm/día)</Th>
            <Th>{''}</Th>
            <Th k="etHour" right>ET última hora</Th>
            <Th>Perfil horario 24 h</Th>
            <Th right>Frente a su tratamiento</Th>
            <Th right>Estado</Th>
          </tr>
        </thead>
        <tbody className="num">
          {rows.map(({ p, plant, n, et }) => {
            const m = trMean(plant.treatmentId);
            const vs = et.daily !== null && m ? ((et.daily - m) / m) * 100 : null;
            const color = TREATMENTS[plant.treatmentId].color;
            return (
              <tr key={p} onClick={() => onPlant(plant.treatmentId, p)} className="cursor-pointer border-t border-line hover:bg-panel-2">
                <td className="py-2 font-medium text-ink">{p}</td>
                <td className="py-2">
                  <span className="inline-flex items-center gap-2 text-ink-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                    {plant.treatmentId}
                  </span>
                </td>
                <td className="py-2 text-ink-3">{plant.position.label}</td>
                <td className="py-2 text-right font-semibold text-ink">{et.daily === null ? 'sin datos' : et.daily.toFixed(2)}</td>
                <td className="w-40 py-2 pl-3">
                  <div className="h-2 rounded-full bg-panel-2">
                    <div className="h-full rounded-full" style={{ width: `${((et.daily ?? 0) / maxEt) * 100}%`, background: color }} />
                  </div>
                </td>
                <td className="py-2 text-right text-ink-2">{et.lastHour === null ? '—' : `${et.lastHour.toFixed(2)} mm/h`}</td>
                <td className="h-9 w-44 py-1 pl-4">
                  <Sparkline values={et.hourly} color={color} />
                </td>
                <td className={`py-2 text-right ${vs === null ? 'text-ink-3' : Math.abs(vs) > 15 ? 'font-semibold text-ink' : 'text-ink-2'}`}>
                  {vs === null ? '—' : `${vs > 0 ? '+' : ''}${vs.toFixed(0)} %`}
                </td>
                <td className="py-2 text-right">
                  {n.status === 'ok' ? <span className="text-ink-3">En línea</span> : <span className="text-warn">Datos incompletos</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="py-2 text-xs text-ink-3">
        ET estimada por balance hídrico del suelo: pérdida de agua almacenada entre 0–25 cm (sensores a 3 y 15 cm), sin contar los riegos ni el drenaje. Es una
        estimación operativa, no una medición lisimétrica.
      </p>
    </Panel>
  );
}

// ---------- Alertas ----------

export function AlertsDetail({ onPlant }: { onPlant: (t: TreatmentId, p: PlantId) => void }) {
  return <AlertsList onOpenPlant={(t, p) => onPlant(t, p as PlantId)} />;
}
