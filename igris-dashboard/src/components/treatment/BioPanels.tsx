/**
 * Paneles biológicos (se abren al tocar raíces u hojas de la planta 3D).
 *  - Microbioma: barras apiladas al 100 % por muestra, formato de publicación
 *    ("p. Filo g. Género", "Less abundant genus", "Not identified genus").
 *  - Proteoma: volcán (día 30 vs 0, t de Welch + BH), mapa de calor de valores z
 *    y composición funcional apilada.
 */
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
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
import { TREATMENT_IDS } from '../../config/experiment';
import { BIO } from '../../data/bio/bioData';
import type { TreatmentId } from '../../types/domain';
import { AXIS, GRID } from '../charts/chartTheme';
import { Segmented } from '../common/primitives';

// Paleta de taxones al estilo de figuras de metabarcoding (20 tonos + gris + negro).
const TAXON_COLORS = [
  '#0b1f8f', '#127a12', '#7a0a0a', '#f6d23c', '#2d6ca8', '#9b37c9', '#d0213e', '#0f8080', '#f3dcb0', '#f02aa0',
  '#8b4513', '#7fffd4', '#e7c600', '#22e02a', '#f6b8c8', '#3c6ee0', '#f08070', '#d2691e', '#556b2f', '#ff9f1a',
];
const LESS_COLOR = '#6b6b6b';
const NOTID_COLOR = '#000000';
const CAT_COLORS = ['#74b43b', '#0085de', '#d3a23e', '#08a1ba', '#9a6fd6', '#e0703a', '#2f9d5a', '#d0213e', '#556b2f', '#3c6ee0', '#f6b8c8', '#9aa59d'];

function DemoNote() {
  return (
    <p className="shrink-0 text-[11px] leading-snug text-ink-3" title={BIO.disclaimer}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-warn align-middle" />
      Demo: datos externos reasignados a T1–T4; se reemplazarán por las mediciones reales.
    </p>
  );
}

const sampleLabel = (t: TreatmentId, d: number) => `${t} · d${d}`;

// ======================= Microbioma =======================

export function MicrobiomePanel({ treatment }: { treatment: TreatmentId }) {
  const [scope, setScope] = useState<'all' | 'one'>('all');
  const comp = BIO.microbiome.composition;
  const keys = comp.taxa.map((_, i) => `g${i}`);

  const data = useMemo(
    () =>
      comp.samples
        .filter((s) => scope === 'all' || s.treatment === treatment)
        .map((s) => {
          const row: Record<string, number | string> = { id: s.id, label: sampleLabel(s.treatment, s.day), treatment: s.treatment };
          // Orden de apilado (de abajo hacia arriba): no identificado, menos abundantes, géneros (menor → mayor).
          row.notId = s.notIdentified;
          row.less = s.less;
          s.values.forEach((v, i) => (row[`g${i}`] = v));
          return row;
        }),
    [comp, scope, treatment],
  );
  const stackOrder = ['notId', 'less', ...[...keys].reverse()];
  const colorOf = (k: string) => (k === 'notId' ? NOTID_COLOR : k === 'less' ? LESS_COLOR : TAXON_COLORS[Number(k.slice(1)) % TAXON_COLORS.length]);
  const nameOf = (k: string) => {
    if (k === 'notId') return 'Not identified genus';
    if (k === 'less') return 'Less abundant genus';
    const t = comp.taxa[Number(k.slice(1))];
    return `p. ${t.phylum} g. ${t.genus}`;
  };
  const sh = BIO.microbiome.data[treatment];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Segmented
          size="sm"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: 'Todas las muestras (4 tratamientos × 3 días)' },
            { value: 'one', label: `Solo ${treatment}` },
          ]}
        />
        <span className="ml-auto text-xs text-ink-3">
          Shannon {treatment}: <b className="num text-ink">{sh[0].shannon.toFixed(2)}</b> → <b className="num text-ink">{sh[15].shannon.toFixed(2)}</b> →{' '}
          <b className="num text-ink">{sh[30].shannon.toFixed(2)}</b> (d0 → d15 → d30)
        </span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_330px] gap-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 4 }} barCategoryGap="18%">
            <CartesianGrid {...GRID} />
            <XAxis
              dataKey="label"
              interval={0}
              {...AXIS}
              tick={(p: { x: number; y: number; payload: { value: string } }) => {
                const own = p.payload.value.startsWith(treatment);
                return (
                  <text x={p.x} y={p.y + 12} textAnchor="middle" fontSize={11} fontStyle="italic" fontWeight={own ? 700 : 400} fill={own ? '#0f241a' : '#4b6455'}>
                    {p.payload.value}
                  </text>
                );
              }}
            />
            <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} width={44} {...AXIS} label={{ value: 'Relative abundance (%)', angle: -90, position: 'insideLeft', fill: '#2a4433', fontSize: 12, dy: 60 }} />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="max-h-72 overflow-hidden rounded-lg border border-line-strong bg-white px-3 py-2 text-xs shadow-lg">
                    <div className="mb-1 font-semibold text-ink">{label}</div>
                    {[...payload]
                      .filter((x) => (x.value as number) > 0.5)
                      .sort((a, b) => (b.value as number) - (a.value as number))
                      .slice(0, 10)
                      .map((x) => (
                        <div key={String(x.dataKey)} className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(String(x.dataKey)) }} />
                          <span className="text-ink-2">{nameOf(String(x.dataKey))}</span>
                          <span className="num ml-auto pl-3 text-ink">{(x.value as number).toFixed(1)} %</span>
                        </div>
                      ))}
                  </div>
                ) : null
              }
            />
            {stackOrder.map((k) => (
              <Bar key={k} dataKey={k} stackId="s" fill={colorOf(k)} stroke="#ffffff" strokeWidth={0.4} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        {/* Leyenda en el orden de la figura (más abundante arriba) */}
        <div className="scroll-y min-h-0 pr-1 text-[11.5px] leading-[1.35]">
          <div className="mb-1 font-semibold text-ink">Taxonomic level</div>
          {[...keys, 'less', 'notId'].map((k) => {
            const isG = k.startsWith('g');
            const t = isG ? comp.taxa[Number(k.slice(1))] : null;
            return (
              <div key={k} className="flex items-center gap-2 py-[1px]">
                <span className="h-3 w-5 shrink-0 border border-black/20" style={{ background: colorOf(k) }} />
                <span className="truncate text-ink">
                  {t ? (
                    <>
                      p. {t.phylum} g. <i>{t.genus}</i>
                      {t.genus === BIO.microbiome.inoculant && <b className="ml-1 text-accent-ink">(inoculante)</b>}
                    </>
                  ) : (
                    nameOf(k)
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <DemoNote />
    </div>
  );
}

// ======================= Proteoma =======================

type ProtView = 'volcano' | 'heatmap' | 'function';

export function ProteinPanel({ treatment }: { treatment: TreatmentId }) {
  const [view, setView] = useState<ProtView>('volcano');
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-3">
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'volcano', label: `Volcán ${treatment} (d30 vs d0)` },
            { value: 'heatmap', label: 'Mapa de calor (z-score)' },
            { value: 'function', label: 'Composición funcional' },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1">
        {view === 'volcano' && <Volcano treatment={treatment} />}
        {view === 'heatmap' && <Heatmap treatment={treatment} />}
        {view === 'function' && <FunctionalComposition treatment={treatment} />}
      </div>
      <DemoNote />
    </div>
  );
}

const LFC = 1;
const P = 0.05;
const UP = '#d0213e';
const DOWN = '#0085de';
const NS = '#b9c4bc';

function Volcano({ treatment }: { treatment: TreatmentId }) {
  const v = BIO.proteins.volcano;
  const pts = useMemo(
    () =>
      v.results[treatment].map(([lfc, p, q], i) => ({
        x: lfc,
        y: -Math.log10(Math.max(p, 1e-12)),
        p,
        q,
        name: v.proteins[i].name,
        cat: v.proteins[i].category,
        cls: p < P && lfc >= LFC ? 'up' : p < P && lfc <= -LFC ? 'down' : 'ns',
      })),
    [v, treatment],
  );
  const up = pts.filter((x) => x.cls === 'up');
  const down = pts.filter((x) => x.cls === 'down');
  const ns = pts.filter((x) => x.cls === 'ns');
  const top = [...up, ...down].sort((a, b) => a.p - b.p);
  const labeled = new Set(top.slice(0, 8).map((x) => x.name));
  const anyQ = pts.some((x) => x.q < 0.05);

  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_340px] gap-3">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 16, bottom: 22, left: 6 }}>
          <CartesianGrid {...GRID} vertical />
          <XAxis type="number" dataKey="x" domain={['auto', 'auto']} tickFormatter={(x: number) => x.toFixed(0)} {...AXIS} label={{ value: 'log₂ fold change (día 30 / día 0)', position: 'insideBottom', offset: -12, fill: '#2a4433', fontSize: 12 }} />
          <YAxis type="number" dataKey="y" width={44} {...AXIS} label={{ value: '−log₁₀ p', angle: -90, position: 'insideLeft', fill: '#2a4433', fontSize: 12 }} />
          <ZAxis range={[22, 22]} />
          <ReferenceLine x={-LFC} stroke="#6b8573" strokeDasharray="4 4" />
          <ReferenceLine x={LFC} stroke="#6b8573" strokeDasharray="4 4" />
          <ReferenceLine y={-Math.log10(P)} stroke="#6b8573" strokeDasharray="4 4" />
          <Tooltip
            content={({ active, payload }) => {
              const d = active && payload?.[0]?.payload;
              return d ? (
                <div className="rounded-lg border border-line-strong bg-white px-3 py-2 text-xs shadow-lg">
                  <div className="mb-1 font-semibold text-ink">{d.name}</div>
                  <div className="text-ink-3">{d.cat}</div>
                  <div className="num text-ink-2">
                    log₂FC <b className="text-ink">{d.x.toFixed(2)}</b> · p <b className="text-ink">{d.p.toPrecision(2)}</b> · q <b className="text-ink">{d.q.toPrecision(2)}</b>
                  </div>
                </div>
              ) : null;
            }}
          />
          <Scatter data={ns} fill={NS} isAnimationActive={false} />
          <Scatter data={down} fill={DOWN} isAnimationActive={false}>
            <LabelList dataKey="name" content={(p) => <VLabel {...(p as LabelProps)} show={labeled} />} />
          </Scatter>
          <Scatter data={up} fill={UP} isAnimationActive={false}>
            <LabelList dataKey="name" content={(p) => <VLabel {...(p as LabelProps)} show={labeled} />} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex min-h-0 flex-col text-xs">
        <div className="mb-2 grid shrink-0 grid-cols-3 gap-2 text-center">
          <Count n={up.length} label="Aumentan" color={UP} />
          <Count n={down.length} label="Disminuyen" color={DOWN} />
          <Count n={ns.length} label="Sin cambio" color="#6b8573" />
        </div>
        <p className="mb-1 shrink-0 text-ink-3">
          Criterio: p &lt; 0,05 y |log₂FC| ≥ 1. {anyQ ? '' : 'Ninguna proteína supera FDR (q) < 0,05: interpretar como exploratorio.'}
        </p>
        <div className="scroll-y min-h-0 flex-1">
          <table className="w-full">
            <thead className="sticky top-0 bg-white text-ink-3">
              <tr>
                <th className="py-1 text-left font-normal">Proteína</th>
                <th className="py-1 text-right font-normal">log₂FC</th>
                <th className="py-1 text-right font-normal">p</th>
              </tr>
            </thead>
            <tbody className="num">
              {top.slice(0, 40).map((x) => (
                <tr key={x.name + x.x} className="border-t border-line">
                  <td className="max-w-0 truncate py-1 font-sans text-ink" title={`${x.name} · ${x.cat}`}>
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: x.cls === 'up' ? UP : DOWN }} />
                    {x.name}
                  </td>
                  <td className="py-1 text-right text-ink">{x.x.toFixed(2)}</td>
                  <td className="py-1 text-right text-ink-2">{x.p.toPrecision(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 shrink-0 text-[10.5px] text-ink-3">{BIO.proteins.volcano.method}</p>
      </div>
    </div>
  );
}

interface LabelProps {
  x?: number;
  y?: number;
  value?: string;
}
function VLabel({ x, y, value, show }: LabelProps & { show: Set<string> }) {
  if (x === undefined || y === undefined || !value || !show.has(value)) return null;
  const text = value.length > 28 ? `${value.slice(0, 27)}…` : value;
  return (
    <text x={x + 6} y={y - 6} fontSize={10.5} fill="#0f241a" stroke="#ffffff" strokeWidth={3} paintOrder="stroke">
      {text}
    </text>
  );
}

function Count({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="rounded-lg border border-line px-2 py-1.5">
      <div className="num text-lg font-semibold" style={{ color }}>
        {n}
      </div>
      <div className="text-[11px] text-ink-3">{label}</div>
    </div>
  );
}

/** Escala divergente para z: azul (−) · blanco (0) · rojo (+). */
function zColor(z: number) {
  const t = Math.max(-2.5, Math.min(2.5, z)) / 2.5;
  const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const c = t < 0 ? mix([255, 255, 255], [0, 102, 190], -t) : mix([255, 255, 255], [196, 26, 48], t);
  return `rgb(${c.join(',')})`;
}

function Heatmap({ treatment }: { treatment: TreatmentId }) {
  const hm = BIO.proteins.heatmap;
  const cats = [...new Set(hm.rows.map((r) => r.category))];
  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_200px] gap-3">
      <div className="scroll-y min-h-0">
        <div className="grid gap-px" style={{ gridTemplateColumns: `minmax(220px,1.6fr) 10px repeat(${hm.samples.length}, minmax(0,1fr))` }}>
          <div />
          <div />
          {hm.samples.map((s, i) => (
            <div
              key={s.id}
              className={`pb-1 text-center text-[10px] leading-tight ${s.treatment === treatment ? 'font-bold text-ink' : 'text-ink-3'} ${i % 3 === 0 ? 'border-l border-line-strong' : ''}`}
            >
              {s.treatment}
              <br />d{s.day}
            </div>
          ))}
          {hm.rows.map((r) => (
            <div key={r.name} className="contents">
              <div className="truncate pr-2 text-[11px] leading-[18px] text-ink" title={`${r.name} · ${r.category}`}>
                {r.name}
              </div>
              <div className="my-[3px] rounded-sm" style={{ background: CAT_COLORS[cats.indexOf(r.category) % CAT_COLORS.length] }} title={r.category} />
              {r.z.map((z, i) => (
                <div
                  key={i}
                  title={`${r.name} · ${hm.samples[i].treatment} d${hm.samples[i].day} · z = ${z.toFixed(2)}`}
                  className={`h-[18px] ${i % 3 === 0 ? 'ml-[2px]' : ''} ${hm.samples[i].treatment === treatment ? 'outline outline-1 -outline-offset-1 outline-black/15' : ''}`}
                  style={{ background: zColor(z) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="text-xs">
        <div className="mb-1 font-semibold text-ink">z-score (por proteína)</div>
        <div className="mb-1 h-3 rounded" style={{ background: 'linear-gradient(90deg, rgb(0,102,190), #fff, rgb(196,26,48))' }} />
        <div className="mb-3 flex justify-between text-ink-3">
          <span>−2,5</span>
          <span>0</span>
          <span>+2,5</span>
        </div>
        <div className="mb-1 font-semibold text-ink">Función</div>
        {cats.map((c) => (
          <div key={c} className="flex items-center gap-2 py-[1px] text-ink-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CAT_COLORS[cats.indexOf(c) % CAT_COLORS.length] }} />
            <span className="truncate">{c}</span>
          </div>
        ))}
        <p className="mt-3 text-ink-3">30 proteínas más variables entre las 12 muestras (log₂ abundancia relativa), ordenadas por su respuesta temporal.</p>
      </div>
    </div>
  );
}

function FunctionalComposition({ treatment }: { treatment: TreatmentId }) {
  const cats = useMemo(() => {
    const tot = new Map<string, number>();
    for (const t of TREATMENT_IDS) for (const d of [0, 15, 30] as const) for (const c of BIO.proteins.categories[t][d]) tot.set(c.category, (tot.get(c.category) ?? 0) + c.pct);
    return [...tot.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, []);
  const data = TREATMENT_IDS.flatMap((t) =>
    ([0, 15, 30] as const).map((d) => {
      const row: Record<string, number | string> = { label: sampleLabel(t, d) };
      for (const c of BIO.proteins.categories[t][d]) row[c.category] = c.pct;
      return row;
    }),
  );
  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_250px] gap-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 4 }} barCategoryGap="18%">
          <CartesianGrid {...GRID} />
          <XAxis
            dataKey="label"
            interval={0}
            {...AXIS}
            tick={(p: { x: number; y: number; payload: { value: string } }) => (
              <text x={p.x} y={p.y + 12} textAnchor="middle" fontSize={11} fontWeight={p.payload.value.startsWith(treatment) ? 700 : 400} fill={p.payload.value.startsWith(treatment) ? '#0f241a' : '#4b6455'}>
                {p.payload.value}
              </text>
            )}
          />
          <YAxis domain={[0, 100]} width={44} {...AXIS} label={{ value: '% de la abundancia proteica', angle: -90, position: 'insideLeft', fill: '#2a4433', fontSize: 12, dy: 70 }} />
          <Tooltip
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            formatter={(v: number, n: string) => [`${v.toFixed(1)} %`, n]}
            contentStyle={{ borderRadius: 8, border: '1px solid #c3dcae', fontSize: 12 }}
          />
          {[...cats].reverse().map((c) => (
            <Bar key={c} dataKey={c} stackId="f" fill={CAT_COLORS[cats.indexOf(c) % CAT_COLORS.length]} stroke="#ffffff" strokeWidth={0.4} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="scroll-y text-xs">
        <div className="mb-1 font-semibold text-ink">Categoría funcional</div>
        {cats.map((c) => (
          <div key={c} className="flex items-center gap-2 py-[1px] text-ink-2">
            <span className="h-3 w-5 shrink-0 border border-black/20" style={{ background: CAT_COLORS[cats.indexOf(c) % CAT_COLORS.length] }} />
            <span className="truncate">{c}</span>
          </div>
        ))}
        <p className="mt-3 text-ink-3">Suma de la abundancia relativa de todas las proteínas de cada categoría (clasificación del Excel + palabras clave).</p>
      </div>
    </div>
  );
}

