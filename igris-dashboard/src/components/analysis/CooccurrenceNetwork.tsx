/**
 * Red de coocurrencia de microorganismos de la raíz.
 * Nodos = géneros (tamaño ∝ abundancia media, color = filo).
 * Aristas = correlación de Spearman entre géneros a través de las 12 muestras:
 * verde = coocurren (ρ > 0), rojo = se excluyen (ρ < 0); grosor ∝ |ρ|.
 */
import { useMemo, useState } from 'react';
import { BIO } from '../../data/bio/bioData';
import { edgesFrom, forceLayout, spearmanMatrix } from '../../lib/network';
import { Panel, Segmented } from '../common/primitives';

const PHYLUM_COLORS = ['#74b43b', '#0085de', '#d3a23e', '#08a1ba', '#9a6fd6', '#e0703a', '#6d7d73'];
const POS = '#2f9d5a';
const NEG = '#e34948';

export function CooccurrenceNetwork() {
  const net = BIO.microbiome.network;
  const [threshold, setThreshold] = useState<'0.6' | '0.7' | '0.8'>('0.7');
  const [sign, setSign] = useState<'all' | 'pos' | 'neg'>('all');
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const R = useMemo(() => spearmanMatrix(net.matrix), [net]);
  const edges = useMemo(() => edgesFrom(R, Number(threshold), sign), [R, threshold, sign]);
  const pos = useMemo(() => forceLayout(net.taxa.length, edges), [net.taxa.length, edges]);

  const means = net.taxa.map((_, j) => net.matrix.reduce((s, r) => s + r[j], 0) / net.matrix.length);
  const degree = net.taxa.map((_, i) => edges.filter((e) => e.a === i || e.b === i).length);
  const phyla = [...new Set(net.taxa.map((t) => t.phylum))];
  const phylumColor = (p: string) => PHYLUM_COLORS[Math.min(phyla.indexOf(p), PHYLUM_COLORS.length - 1)];
  const hubs = net.taxa.map((t, i) => ({ t, i, d: degree[i] })).sort((a, b) => b.d - a.d).slice(0, 6);
  const focus = hover ?? selected;
  const neighbors = new Set(focus === null ? [] : edges.filter((e) => e.a === focus || e.b === focus).flatMap((e) => [e.a, e.b]));
  const nPos = edges.filter((e) => e.rho > 0).length;
  const possible = (net.taxa.length * (net.taxa.length - 1)) / 2;
  const showLabel = (i: number) => i === focus || neighbors.has(i) || degree[i] >= (hubs[3]?.d ?? 99) || means[i] > 5;

  const W = 1000;
  const H = 560;
  const r = (i: number) => 7 + Math.sqrt(means[i]) * 3.2;

  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_320px] gap-4">
      <Panel
        title="Red de coocurrencia · géneros de la rizosfera (Spearman, 12 muestras)"
        right={
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-3">|ρ| ≥</span>
            <Segmented size="sm" value={threshold} onChange={setThreshold} options={[{ value: '0.6', label: '0,6' }, { value: '0.7', label: '0,7' }, { value: '0.8', label: '0,8' }]} />
            <Segmented
              size="sm"
              value={sign}
              onChange={setSign}
              options={[
                { value: 'all', label: 'Todas' },
                { value: 'pos', label: 'Coocurren' },
                { value: 'neg', label: 'Se excluyen' },
              ]}
            />
          </div>
        }
        bodyClassName="relative px-2 pb-2"
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" onClick={() => setSelected(null)}>
          {edges.map((e, k) => {
            const dim = focus !== null && e.a !== focus && e.b !== focus;
            return (
              <line
                key={k}
                x1={pos[e.a][0] * W}
                y1={pos[e.a][1] * H}
                x2={pos[e.b][0] * W}
                y2={pos[e.b][1] * H}
                stroke={e.rho > 0 ? POS : NEG}
                strokeWidth={1 + (Math.abs(e.rho) - 0.5) * 6}
                strokeOpacity={dim ? 0.08 : 0.25 + Math.abs(e.rho) * 0.5}
                strokeDasharray={e.rho < 0 ? '6 4' : undefined}
              />
            );
          })}
          {net.taxa.map((t, i) => {
            const dim = focus !== null && i !== focus && !neighbors.has(i);
            const [x, y] = [pos[i][0] * W, pos[i][1] * H];
            return (
              <g
                key={t.taxon}
                transform={`translate(${x},${y})`}
                opacity={dim ? 0.25 : 1}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setSelected(i === selected ? null : i);
                }}
              >
                <circle r={r(i) + 8} fill="transparent" />
                <circle r={r(i)} fill={phylumColor(t.phylum)} stroke={i === selected ? '#0f241a' : '#ffffff'} strokeWidth={i === selected ? 3 : 2} />
                {showLabel(i) && (
                  <text y={-r(i) - 6} textAnchor="middle" fontSize={13} fontWeight={600} fill="#0f241a" stroke="#ffffff" strokeWidth={4} paintOrder="stroke">
                    {t.taxon}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute bottom-3 left-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          {phyla.map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: phylumColor(p) }} />
              {p}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5" style={{ background: POS }} /> coocurren
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 border-t-2 border-dashed" style={{ borderColor: NEG }} /> se excluyen
          </span>
        </div>
      </Panel>

      <div className="flex min-h-0 flex-col gap-3">
        <Panel title="Resumen de la red" bodyClassName="px-4 pb-3 text-sm">
          <Row k="Géneros (nodos)" v={`${net.taxa.length}`} />
          <Row k="Conexiones" v={`${edges.length} (${nPos} + / ${edges.length - nPos} −)`} />
          <Row k="Densidad" v={`${((edges.length / possible) * 100).toFixed(1)} %`} />
        </Panel>
        {selected !== null ? (
          <Panel title={net.taxa[selected].taxon} className="min-h-0 flex-1" bodyClassName="scroll-y px-4 pb-3 text-sm">
            <p className="mb-2 text-xs text-ink-3">
              {net.taxa[selected].phylum} · abundancia media {means[selected].toFixed(2)} % · {degree[selected]} conexiones
            </p>
            {edges
              .filter((e) => e.a === selected || e.b === selected)
              .sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho))
              .map((e) => {
                const other = e.a === selected ? e.b : e.a;
                return (
                  <button key={other} onClick={() => setSelected(other)} className="flex w-full items-center justify-between border-b border-line py-1.5 text-left last:border-0 hover:bg-panel-2">
                    <span className="truncate text-ink">{net.taxa[other].taxon}</span>
                    <span className="num font-semibold" style={{ color: e.rho > 0 ? POS : NEG }}>
                      ρ {e.rho > 0 ? '+' : ''}
                      {e.rho.toFixed(2)}
                    </span>
                  </button>
                );
              })}
          </Panel>
        ) : (
          <Panel title="Géneros más conectados (hubs)" className="min-h-0 flex-1" bodyClassName="scroll-y px-4 pb-3 text-sm">
            {hubs.map((h) => (
              <button key={h.t.taxon} onClick={() => setSelected(h.i)} className="flex w-full items-center justify-between border-b border-line py-1.5 text-left last:border-0 hover:bg-panel-2">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: phylumColor(h.t.phylum) }} />
                  <span className="truncate text-ink">{h.t.taxon}</span>
                </span>
                <span className="num text-ink-2">{h.d} conexiones</span>
              </button>
            ))}
            <p className="mt-2 text-xs text-ink-3">Toca un nodo para ver con quién coocurre. Datos de demostración; la red se recalcula con los datos reales.</p>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line py-1.5 last:border-0">
      <span className="text-ink-2">{k}</span>
      <span className="num font-semibold text-ink">{v}</span>
    </div>
  );
}
