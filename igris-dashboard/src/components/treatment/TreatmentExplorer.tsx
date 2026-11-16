/**
 * Vista de un tratamiento (panel derecho). La planta 3D vive en el primer tercio
 * de la pantalla (PlantStage); aquí van las cifras y UNA sección a la vez.
 * Tratamiento, planta y sección se comparten con la planta 3D vía useUi().
 */
import { useMemo, useState } from 'react';
import { MOISTURE_DEPTHS, THRESHOLDS, TREATMENTS } from '../../config/experiment';
import { SENSOR_IDS } from '../../data/simulator';
import {
  currentValue,
  depthSensor,
  moistureStats,
  plantNow,
  plantsOf,
  sensorTrend,
  valueAt,
  type Depth,
  type RangeKey,
} from '../../lib/analytics';
import { describe, fmt } from '../../lib/stats';
import { useSnapshot } from '../../store/igrisStore';
import { useUi } from '../../state/ui';
import type { PlantId, TreatmentId } from '../../types/domain';
import { SensorChart, type SeriesSpec } from '../charts/SensorChart';
import { fmtDateTime, Segmented } from '../common/primitives';
import { MicrobiomePanel, ProteinPanel } from './BioPanels';

/** Plantas individuales en gris (contexto); la planta seleccionada usa colores de serie. */
const CONTEXT_GREY = '#a7b8ad';
const DEPTH_COLORS = { upper: '#0085de', lower: '#d3a23e' };

export function TreatmentExplorer() {
  const s = useSnapshot();
  const ui = useUi();
  const tr = ui.treatment;
  const plants = plantsOf(s, tr);
  const plant = ui.selectedPlant && plants.includes(ui.selectedPlant) ? ui.selectedPlant : null;
  const setPlant = ui.openPlant;
  const section = ui.section;
  const setSection = ui.setSection;
  const [depth, setDepth] = useState<Depth>('upper');
  const [range, setRange] = useState<RangeKey>('24h');
  const t = TREATMENTS[tr];

  const up = moistureStats(s, plants, 'upper');
  const lo = moistureStats(s, plants, 'lower');
  const st = describe(plants.map((p) => currentValue(s, SENSOR_IDS.soilTemp(p)).value));
  const pn = plant ? plantNow(s, plant) : null;

  const series: SeriesSpec[] = useMemo(
    () =>
      plant
        ? [
            { sensorId: SENSOR_IDS.upper(plant), name: `${MOISTURE_DEPTHS.upper} cm`, color: DEPTH_COLORS.upper, band: true },
            { sensorId: SENSOR_IDS.lower(plant), name: `${MOISTURE_DEPTHS.lower} cm`, color: DEPTH_COLORS.lower, band: true },
          ]
        : plants.map((p) => ({ sensorId: depthSensor(p, depth), name: p, color: CONTEXT_GREY })),
    [plant, plants.join(), depth], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const irrigation = useMemo(
    () => s.events.filter((e) => e.type === 'irrigation').map((e) => ({ t: e.t, label: e.description })),
    [s.events],
  );
  const relevantEvents = s.events
    .filter((e) => e.type !== 'irrigation' && (e.scope === 'chamber' || e.scope === tr || e.scope === plant))
    .slice(-6)
    .reverse();
  const bio = plant ? s.biological.filter((b) => b.plantId === plant) : s.biological.filter((b) => plants.includes(b.plantId));

  const m = {
    upper: pn ? pn.upper.value : up.mean,
    lower: pn ? pn.lower.value : lo.mean,
    soilT: pn ? pn.soilTemp.value : st.mean,
  };
  const diff = m.upper !== null && m.lower !== null ? m.upper - m.lower : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Selección de planta (el tratamiento se elige junto a la planta 3D). */}
      <div className="flex shrink-0 flex-wrap items-center gap-4">
        <span className="inline-flex items-center gap-2 text-base font-medium text-white">
          <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
          {tr} · {t.label}
        </span>
        <div className="ml-auto flex gap-1 rounded-xl bg-white/90 p-1 shadow-sm">
          <Chip active={plant === null} onClick={() => setPlant(null)}>
            Media
          </Chip>
          {plants.map((p) => (
            <Chip key={p} active={plant === p} onClick={() => setPlant(p)} warn={plantNow(s, p).status !== 'ok'}>
              {p}
            </Chip>
          ))}
        </div>
      </div>

      {/* En las vistas biológicas se ocultan las cifras de sensores para dar altura a los gráficos. */}
      <div className={`grid shrink-0 grid-cols-4 gap-4 ${section === 'microbiome' || section === 'proteins' ? 'hidden' : ''}`}>
        <Metric label={`Humedad ${MOISTURE_DEPTHS.upper} cm`} value={fmt(m.upper)} unit="%" low={m.upper !== null && m.upper < THRESHOLDS.soil_moisture.min} />
        <Metric label={`Humedad ${MOISTURE_DEPTHS.lower} cm`} value={fmt(m.lower)} unit="%" low={m.lower !== null && m.lower < THRESHOLDS.soil_moisture.min} />
        <Metric label="Diferencia 3 − 15 cm" value={diff === null ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`} unit="pts" />
        <Metric label="Temperatura del suelo" value={fmt(m.soilT)} unit="°C" />
      </div>

      <div className="panel flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-3 px-4 pt-3">
          <Segmented
            size="sm"
            value={section}
            onChange={setSection}
            options={[
              { value: 'history', label: 'Historial' },
              { value: 'analysis', label: 'Análisis' },
              { value: 'microbiome', label: 'Microbioma (raíz)' },
              { value: 'proteins', label: 'Proteínas (hoja)' },
              { value: 'biology', label: 'Eventos' },
            ]}
          />
          <span className="text-xs text-ink-3">
            {plant ? `Planta ${plant} · posición ${s.plantById.get(plant)?.position.label}` : `Media de ${tr} · n = ${up.n} de ${up.nTotal}`}
          </span>
          {section === 'history' && (
            <div className="ml-auto flex gap-2">
              {!plant && (
                <Segmented
                  size="sm"
                  value={depth}
                  onChange={setDepth}
                  options={[
                    { value: 'upper', label: '3 cm' },
                    { value: 'lower', label: '15 cm' },
                  ]}
                />
              )}
              <Segmented
                size="sm"
                value={range}
                onChange={setRange}
                options={[
                  { value: '24h', label: '24 h' },
                  { value: '72h', label: '72 h' },
                  { value: '7d', label: '7 d' },
                ]}
              />
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 px-4 pt-2 pb-4">
          {section === 'history' && (
            <div className="flex h-full flex-col">
              <p className="mb-1 text-xs text-ink-3">
                {plant ? (
                  <>
                    <Legend color={DEPTH_COLORS.upper}>3 cm</Legend>
                    <Legend color={DEPTH_COLORS.lower}>15 cm</Legend>
                  </>
                ) : (
                  `Una línea por planta de ${tr} · humedad a ${depth === 'upper' ? 3 : 15} cm (%)`
                )}
              </p>
              <div className="min-h-0 flex-1">
                <SensorChart series={series} range={range} unit="%" yDomain={[0, 50]} thresholds={{ min: THRESHOLDS.soil_moisture.min }} events={irrigation} />
              </div>
            </div>
          )}
          {section === 'analysis' && (plant ? <PlantAnalysis plant={plant} tr={tr} /> : <TreatmentAnalysis tr={tr} />)}
          {section === 'microbiome' && <MicrobiomePanel key={tr} treatment={tr} />}
          {section === 'proteins' && <ProteinPanel key={tr} treatment={tr} />}
          {section === 'biology' && (
            <div className="scroll-y h-full text-sm">
              {bio.length === 0 ? (
                <p className="text-ink-3">
                  Sin mediciones biológicas registradas{plant ? ` para ${plant}` : ''}. Se incorporarán desde el laboratorio; no se extrapolan datos faltantes.
                </p>
              ) : (
                bio.map((b) => (
                  <div key={b.id}>
                    {b.type}: {String(b.result)} {b.unit}
                  </div>
                ))
              )}
              <h4 className="mt-4 mb-2 text-xs text-ink-3">Eventos</h4>
              <ul className="space-y-2">
                {relevantEvents.map((e) => (
                  <li key={e.id} className="flex gap-4">
                    <span className="num w-28 shrink-0 text-ink-3">{fmtDateTime(e.t)}</span>
                    <span className="text-ink-2">{e.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function PlantAnalysis({ plant, tr }: { plant: PlantId; tr: TreatmentId }) {
    const rows = (['upper', 'lower'] as Depth[]).map((d) => {
      const id = depthSensor(plant, d);
      const now = currentValue(s, id).value;
      const prev = valueAt(s, id, 24);
      const mean = moistureStats(s, plantsOf(s, tr), d);
      return {
        d,
        trend: sensorTrend(s, id, 6),
        change: now !== null && prev !== null ? now - prev : null,
        vsMean: now !== null && mean.mean !== null ? now - mean.mean : null,
      };
    });
    return (
      <AnalysisTable
        head={['Profundidad', 'Tendencia 6 h', 'Cambio en 24 h', `Frente a media ${tr}`]}
        rows={rows.map((r) => [r.d === 'upper' ? '3 cm' : '15 cm', `${signed(r.trend, 2)} /h`, `${signed(r.change)} pts`, `${signed(r.vsMean)} pts`])}
      />
    );
  }

  function TreatmentAnalysis({ tr }: { tr: TreatmentId }) {
    const ps = plantsOf(s, tr);
    const rows = (['upper', 'lower'] as Depth[]).map((d) => {
      const mm = moistureStats(s, ps, d);
      const trend = describe(ps.map((p) => sensorTrend(s, depthSensor(p, d), 6))).mean;
      return [d === 'upper' ? '3 cm' : '15 cm', `${fmt(mm.mean)} ± ${fmt(mm.sd)} %`, `${fmt(mm.min)}–${fmt(mm.max)} %`, `${signed(trend, 2)} /h`, `${mm.n}`];
    });
    return <AnalysisTable head={['Profundidad', 'Media ± DE', 'Rango', 'Tendencia 6 h', 'n']} rows={rows} />;
  }
}

function AnalysisTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-ink-3">
            {head.map((h, i) => (
              <th key={h} className={`py-2 font-normal ${i ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="num">
          {rows.map((r) => (
            <tr key={r[0]} className="border-t border-line">
              {r.map((c, i) => (
                <td key={i} className={`py-3 ${i ? 'text-right text-ink' : 'text-ink-2'}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-ink-3">Estadística descriptiva sobre mediciones válidas; no es una prueba inferencial.</p>
    </div>
  );
}

function Chip({ active, onClick, warn, children }: { active: boolean; onClick: () => void; warn?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative h-10 rounded-lg px-3.5 text-sm transition-colors ${
        active ? 'bg-[#e3f2d6] font-medium text-ink' : 'text-ink-3 hover:bg-panel-2 hover:text-ink-2'
      }`}
    >
      {children}
      {warn && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-warn" />}
    </button>
  );
}

function Metric({ label, value, unit, low }: { label: string; value: string; unit: string; low?: boolean }) {
  return (
    <div className="panel px-4 py-3">
      <div className="text-xs whitespace-nowrap text-ink-3">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`stat text-3xl font-semibold ${low ? 'text-warn' : 'text-ink'}`}>{value}</span>
        <span className="text-sm text-ink-3">{unit}</span>
      </div>
    </div>
  );
}

function Legend({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="mr-4 inline-flex items-center gap-1.5">
      <span className="h-0.5 w-4 rounded" style={{ background: color }} />
      {children}
    </span>
  );
}

function signed(v: number | null, d = 1) {
  return v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}`;
}
