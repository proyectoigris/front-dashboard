/**
 * Análisis IGRIS: vista estadística que entrelaza sensores, diseño experimental y
 * datos biológicos. Exploratorio y descriptivo (sin pruebas inferenciales).
 */
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { TREATMENTS, TREATMENT_IDS } from '../../config/experiment';
import { bioTable, microbiomeProfiles, plantTable, type AnalysisTable, type Observation } from '../../lib/analysisData';
import { brayCurtis, linearFit, pca, pcoa, pearson } from '../../lib/multivariate';
import { useSnapshot } from '../../store/igrisStore';
import { AXIS, GRID } from '../charts/chartTheme';
import { Panel, Segmented, TreatmentChip } from '../common/primitives';
import { CooccurrenceNetwork } from './CooccurrenceNetwork';

type Tab = 'corr' | 'scatter' | 'pca' | 'network' | 'pcoa';
type DatasetKey = 'plants' | 'bio';

/** Escala divergente: azul (−1) → gris neutro (0) → rojo (+1). */
function divergent(r: number | null): string {
  if (r === null) return '#eef1ec';
  const t = Math.max(-1, Math.min(1, r));
  const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const mid = [238, 241, 236];
  const neg = [42, 120, 214];
  const pos = [227, 73, 72];
  const c = t < 0 ? mix(mid, neg, -t) : mix(mid, pos, t);
  return `rgb(${c.join(',')})`;
}

export function AnalysisView() {
  const s = useSnapshot();
  const [tab, setTab] = useState<Tab>('corr');
  const [dataset, setDataset] = useState<DatasetKey>('plants');
  // Recalcular con cada snapshot (los sensores cambian); los datos biológicos son fijos.
  const tables = useMemo(() => ({ plants: plantTable(s), bio: bioTable() }), [s.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const table = tables[dataset];
  const [pair, setPair] = useState<{ x: string; y: string } | null>(null);

  const openPair = (x: string, y: string) => {
    setPair({ x, y });
    setTab('scatter');
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'corr', label: 'Correlaciones' },
            { value: 'scatter', label: 'Dispersión' },
            { value: 'pca', label: 'PCA de plantas' },
            { value: 'network', label: 'Red de coocurrencia' },
            { value: 'pcoa', label: 'PCoA microbioma' },
          ]}
        />
        {(tab === 'corr' || tab === 'scatter') && (
          <Segmented
            value={dataset}
            onChange={(d) => {
              setDataset(d);
              setPair(null);
            }}
            options={[
              { value: 'plants', label: 'Plantas · sensores (n=24)' },
              { value: 'bio', label: 'Microbioma + proteoma (n=12)' },
            ]}
          />
        )}
        <span className="ml-auto text-xs text-white/85">Exploratorio · descriptivo · sensores simulados y datos biológicos de demostración</span>
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'corr' && <CorrelationMatrix table={table} onPick={openPair} />}
        {tab === 'scatter' && <ScatterExplorer key={dataset} table={table} initial={pair} />}
        {tab === 'pca' && <PcaPlants table={tables.plants} />}
        {tab === 'network' && <CooccurrenceNetwork />}
        {tab === 'pcoa' && <PcoaMicrobiome />}
      </div>
    </div>
  );
}

// ---------- Correlaciones ----------

function CorrelationMatrix({ table, onPick }: { table: AnalysisTable; onPick: (x: string, y: string) => void }) {
  const vars = table.variables;
  const col = (k: string) => table.rows.map((r) => r.values[k]);
  const R = vars.map((a) => vars.map((b) => pearson(col(a.key), col(b.key)).r));
  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_300px] gap-4">
      <Panel title={`Matriz de correlación de Pearson · ${table.name}`} bodyClassName="scroll-y px-4 pb-4">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `minmax(210px,1.4fr) repeat(${vars.length}, minmax(0,1fr))` }}>
          <div />
          {vars.map((v, j) => (
            <div key={v.key} className="pb-1 text-center text-[11px] font-semibold text-ink-2" title={v.label}>
              {j + 1}
            </div>
          ))}
          {vars.map((a, i) => (
            <div key={a.key} className="contents">
              <div className="flex items-center gap-2 truncate pr-2 text-xs text-ink">
                <span className="w-4 shrink-0 text-right font-semibold text-ink-3">{i + 1}</span>
                <span className="truncate" title={a.label}>{a.label}</span>
              </div>
              {vars.map((b, j) => {
                const r = R[i][j];
                const strong = r !== null && Math.abs(r) > 0.55;
                return (
                  <button
                    key={b.key}
                    disabled={i === j}
                    onClick={() => onPick(b.key, a.key)}
                    title={`${a.label} × ${b.label}: r = ${r === null ? '—' : r.toFixed(2)}`}
                    className="num grid h-10 place-items-center rounded text-[11px] transition-transform enabled:hover:scale-105 enabled:hover:ring-2 enabled:hover:ring-ink"
                    style={{ background: i === j ? '#dfe7da' : divergent(r), color: strong ? '#ffffff' : '#0f241a' }}
                  >
                    {i === j ? '' : r === null ? '—' : r.toFixed(2)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Cómo leerla" bodyClassName="px-4 pb-4 text-sm text-ink-2">
        <div className="mb-3 h-3 rounded-full" style={{ background: 'linear-gradient(90deg, rgb(42,120,214), rgb(238,241,236), rgb(227,73,72))' }} />
        <div className="mb-4 flex justify-between text-xs text-ink-3">
          <span>−1 inversa</span>
          <span>0 sin relación</span>
          <span>+1 directa</span>
        </div>
        <p className="mb-2">Cada celda es el coeficiente r de Pearson entre dos variables ({table.description.toLowerCase()})</p>
        <p className="mb-2">
          <b>Toca una celda</b> para ver la dispersión de ese par.
        </p>
        <p className="text-xs text-ink-3">
          Correlación no implica causalidad. Las variables 0/1 (déficit, inoculación) dan una correlación punto-biserial con el factor del diseño.
        </p>
      </Panel>
    </div>
  );
}

// ---------- Dispersión ----------

function ScatterExplorer({ table, initial }: { table: AnalysisTable; initial: { x: string; y: string } | null }) {
  const vars = table.variables;
  const [x, setX] = useState(initial?.x ?? vars[0].key);
  const [y, setY] = useState(initial?.y ?? vars[1].key);
  const vx = vars.find((v) => v.key === x)!;
  const vy = vars.find((v) => v.key === y)!;
  const xs = table.rows.map((r) => r.values[x]);
  const ys = table.rows.map((r) => r.values[y]);
  const { r, n } = pearson(xs, ys);
  const fit = linearFit(xs, ys);
  const valid = xs.filter((v): v is number => v !== null);
  const [xmin, xmax] = valid.length ? [Math.min(...valid), Math.max(...valid)] : [0, 1];

  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_300px] gap-4">
      <Panel
        title={`${vy.label} frente a ${vx.label}`}
        right={
          <div className="flex gap-3">
            {TREATMENT_IDS.map((t) => (
              <TreatmentChip key={t} id={t} />
            ))}
          </div>
        }
        bodyClassName="px-3 pb-3"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 24, left: 10 }}>
            <CartesianGrid {...GRID} vertical />
            <XAxis type="number" dataKey="x" name={vx.label} domain={['auto', 'auto']} {...AXIS} label={{ value: `${vx.label}${vx.unit ? ` (${vx.unit})` : ''}`, position: 'insideBottom', offset: -14, fill: '#4b6455', fontSize: 12 }} />
            <YAxis type="number" dataKey="y" name={vy.label} domain={['auto', 'auto']} width={56} {...AXIS} label={{ value: vy.label, angle: -90, position: 'insideLeft', fill: '#4b6455', fontSize: 12 }} />
            <ZAxis range={[90, 90]} />
            <Tooltip content={<PointTip xl={vx.label} yl={vy.label} />} />
            {fit && <ReferenceLine segment={[{ x: xmin, y: fit.a + fit.b * xmin }, { x: xmax, y: fit.a + fit.b * xmax }]} stroke="#0f241a" strokeDasharray="5 4" strokeOpacity={0.6} />}
            {TREATMENT_IDS.map((t) => (
              <Scatter
                key={t}
                name={t}
                data={table.rows.filter((o) => o.treatment === t && o.values[x] !== null && o.values[y] !== null).map((o) => ({ x: o.values[x], y: o.values[y], label: o.label }))}
                fill={TREATMENTS[t].color}
                stroke="#ffffff"
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </Panel>
      <div className="flex min-h-0 flex-col gap-3">
        <Panel title="Variables" bodyClassName="space-y-3 px-4 pb-4">
          <VarSelect label="Eje X" value={x} vars={vars} onChange={setX} />
          <VarSelect label="Eje Y" value={y} vars={vars} onChange={setY} />
        </Panel>
        <Panel title="Resumen" className="flex-1" bodyClassName="px-4 pb-4 text-sm">
          <Stat k="r de Pearson" v={r === null ? '—' : r.toFixed(3)} />
          <Stat k="R²" v={r === null ? '—' : (r * r).toFixed(3)} />
          <Stat k="Pendiente" v={fit ? `${fit.b.toFixed(3)} ${vy.unit}/${vx.unit || 'u'}` : '—'} />
          <Stat k="n (pares completos)" v={`${n}`} />
          <p className="mt-3 text-xs text-ink-3">Línea discontinua: ajuste lineal por mínimos cuadrados (todas las observaciones).</p>
        </Panel>
      </div>
    </div>
  );
}

function VarSelect({ label, value, vars, onChange }: { label: string; value: string; vars: AnalysisTable['variables']; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-ink-3">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-sm text-ink outline-none focus:border-[#08a1ba]"
      >
        {vars.map((v) => (
          <option key={v.key} value={v.key}>
            {v.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line py-2 last:border-0">
      <span className="text-ink-2">{k}</span>
      <span className="num font-semibold text-ink">{v}</span>
    </div>
  );
}

function PointTip({ active, payload, xl, yl }: { active?: boolean; payload?: { payload: { x: number; y: number; label: string } }[]; xl: string; yl: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line-strong bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-ink">{p.label}</div>
      <div className="text-ink-2">
        {xl}: <b className="num text-ink">{p.x.toFixed(2)}</b>
      </div>
      <div className="text-ink-2">
        {yl}: <b className="num text-ink">{p.y.toFixed(2)}</b>
      </div>
    </div>
  );
}

// ---------- PCA ----------

function PcaPlants({ table }: { table: AnalysisTable }) {
  // Solo variables medidas (los factores del diseño se usan para colorear, no para ordenar).
  const vars = table.variables.filter((v) => v.key !== 'deficit' && v.key !== 'inoc');
  const res = pca(table.rows.map((r) => vars.map((v) => r.values[v.key])));
  const pts = table.rows.map((o, i) => ({ o, x: res.coords[i][0], y: res.coords[i][1] }));
  const loadings = vars
    .map((v, j) => ({ v, l1: res.loadings![j][0], l2: res.loadings![j][1] }))
    .sort((a, b) => Math.abs(b.l1) - Math.abs(a.l1));
  return (
    <OrdinationLayout
      title={`PCA · ${vars.length} variables de sensores estandarizadas · 24 plantas`}
      axis={['PC1', 'PC2']}
      explained={res.explained}
      points={pts}
      side={
        <Panel title="Cargas (qué explica cada eje)" className="flex-1" bodyClassName="scroll-y px-4 pb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-ink-3">
                <th className="py-1 text-left font-normal">Variable</th>
                <th className="py-1 text-right font-normal">PC1</th>
                <th className="py-1 text-right font-normal">PC2</th>
              </tr>
            </thead>
            <tbody className="num">
              {loadings.map((l) => (
                <tr key={l.v.key} className="border-t border-line">
                  <td className="py-1.5 font-sans text-ink-2">{l.v.label}</td>
                  <td className="py-1.5 text-right" style={{ color: Math.abs(l.l1) > 0.6 ? '#0f241a' : '#4b6455', fontWeight: Math.abs(l.l1) > 0.6 ? 700 : 400 }}>{l.l1.toFixed(2)}</td>
                  <td className="py-1.5 text-right" style={{ color: Math.abs(l.l2) > 0.6 ? '#0f241a' : '#4b6455', fontWeight: Math.abs(l.l2) > 0.6 ? 700 : 400 }}>{l.l2.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-3">Si los colores se separan en el gráfico, los tratamientos difieren en el conjunto de variables.</p>
        </Panel>
      }
    />
  );
}

// ---------- PCoA ----------

function PcoaMicrobiome() {
  const { obs, matrix } = useMemo(() => microbiomeProfiles(), []);
  const D = matrix.map((a) => matrix.map((b) => brayCurtis(a, b)));
  const res = pcoa(D);
  const pts = obs.map((o, i) => ({ o, x: res.coords[i][0], y: res.coords[i][1] }));
  return (
    <OrdinationLayout
      title="PCoA · disimilitud de Bray-Curtis · comunidades microbianas de raíz (géneros)"
      axis={['PCoA 1', 'PCoA 2']}
      explained={res.explained}
      points={pts}
      trajectories
      side={
        <Panel title="Cómo leerlo" className="flex-1" bodyClassName="px-4 pb-4 text-sm text-ink-2">
          <p className="mb-2">Cada punto es la comunidad de un tratamiento en un día (d0, d15, d30). Puntos cercanos = comunidades parecidas.</p>
          <p className="mb-2">Las líneas unen los días de un mismo tratamiento: muestran cómo cambia la comunidad en el tiempo.</p>
          <p className="text-xs text-ink-3">Datos de demostración derivados de un dataset 16S externo; se reemplazarán por los reales.</p>
        </Panel>
      }
    />
  );
}

function OrdinationLayout({
  title,
  axis,
  explained,
  points,
  side,
  trajectories = false,
}: {
  title: string;
  axis: [string, string];
  explained: [number, number];
  points: { o: Observation; x: number; y: number }[];
  side: React.ReactNode;
  trajectories?: boolean;
}) {
  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_320px] gap-4">
      <Panel
        title={title}
        right={
          <div className="flex gap-3">
            {TREATMENT_IDS.map((t) => (
              <TreatmentChip key={t} id={t} />
            ))}
          </div>
        }
        bodyClassName="px-3 pb-3"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 10 }}>
            <CartesianGrid {...GRID} vertical />
            <XAxis type="number" dataKey="x" domain={['auto', 'auto']} tickFormatter={(v: number) => v.toFixed(1)} {...AXIS} label={{ value: `${axis[0]} (${explained[0].toFixed(1)} %)`, position: 'insideBottom', offset: -14, fill: '#4b6455', fontSize: 12 }} />
            <YAxis type="number" dataKey="y" domain={['auto', 'auto']} tickFormatter={(v: number) => v.toFixed(1)} width={52} {...AXIS} label={{ value: `${axis[1]} (${explained[1].toFixed(1)} %)`, angle: -90, position: 'insideLeft', fill: '#4b6455', fontSize: 12 }} />
            <ZAxis range={[110, 110]} />
            <ReferenceLine x={0} stroke="#c3dcae" />
            <ReferenceLine y={0} stroke="#c3dcae" />
            <Tooltip content={<PointTip xl={axis[0]} yl={axis[1]} />} />
            {TREATMENT_IDS.map((t) => (
              <Scatter
                key={t}
                name={t}
                data={points
                  .filter((p) => p.o.treatment === t)
                  .sort((a, b) => (a.o.day ?? 0) - (b.o.day ?? 0))
                  .map((p) => ({ x: p.x, y: p.y, label: p.o.label, tag: p.o.day !== undefined ? `d${p.o.day}` : '' }))}
                fill={TREATMENTS[t].color}
                stroke="#ffffff"
                strokeWidth={1.5}
                line={trajectories ? { stroke: TREATMENTS[t].color, strokeWidth: 2 } : false}
                isAnimationActive={false}
              >
                {trajectories && <LabelList dataKey="tag" position="top" style={{ fill: '#2a4433', fontSize: 11, fontWeight: 600 }} />}
              </Scatter>
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </Panel>
      <div className="flex min-h-0 flex-col gap-3">
        <Panel title="Varianza explicada" bodyClassName="px-4 pb-4">
          {[0, 1].map((i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between text-sm">
                <span className="text-ink-2">{axis[i]}</span>
                <span className="num font-semibold text-ink">{explained[i].toFixed(1)} %</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-panel-2">
                <div className="h-full rounded-full bg-[#08a1ba]" style={{ width: `${Math.min(100, explained[i])}%` }} />
              </div>
            </div>
          ))}
        </Panel>
        {side}
      </div>
    </div>
  );
}
