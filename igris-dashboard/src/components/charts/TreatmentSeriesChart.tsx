import { memo, useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { THRESHOLDS, TREATMENTS, TREATMENT_IDS } from '../../config/experiment';
import { RANGE_HOURS, treatmentSeries, type Depth, type RangeKey } from '../../lib/analytics';
import { useSnapshot } from '../../store/igrisStore';
import type { TreatmentId } from '../../types/domain';
import { AXIS, DarkTooltip, GRID, THRESHOLD_LINE, timeDomain, timeTick } from './chartTheme';

/** Media por tratamiento en el tiempo (cada planta pesa igual; n en el tooltip). */
export const TreatmentSeriesChart = memo(function TreatmentSeriesChart({
  depth,
  range,
  visible = TREATMENT_IDS,
  compact = false,
}: {
  depth: Depth;
  range: RangeKey;
  visible?: TreatmentId[];
  compact?: boolean;
}) {
  const s = useSnapshot();
  // Recalcula solo al publicar un snapshot nuevo (cada TIMING.uiRefreshMs).
  const data = useMemo(() => treatmentSeries(s, depth, range), [s.version, depth, range]); // eslint-disable-line react-hooks/exhaustive-deps

  const labelOffsets = endLabelOffsets(data[data.length - 1] as Record<string, number | null> | undefined, visible);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 40, bottom: 0, left: compact ? -16 : -8 }}>
        <CartesianGrid {...GRID} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={timeDomain(s.now, RANGE_HOURS[range])}
          tickFormatter={timeTick(range)}
          minTickGap={48}
          {...AXIS}
        />
        <YAxis domain={[0, 50]} width={44} unit="" {...AXIS} />
        <ReferenceLine
          y={THRESHOLDS.soil_moisture.min}
          {...THRESHOLD_LINE}
          label={{ value: `umbral ${THRESHOLDS.soil_moisture.min} %`, fill: '#6b8574', fontSize: 11, position: 'insideBottomLeft' }}
        />
        <Tooltip content={<DarkTooltip unit="%" />} cursor={{ stroke: '#b9d4c1' }} />
        {visible.map((id) => (
          <Line
            key={id}
            dataKey={id}
            name={id}
            stroke={TREATMENTS[id].color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 2 }}
            isAnimationActive={false}
            connectNulls={false}
            label={endLabel(id, data.length, labelOffsets[id] ?? 0)}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
});

/**
 * Desplazamiento vertical (px) de cada etiqueta final para que no se monten:
 * las series que terminan a menos de 2,5 puntos de otra se apilan en filas de 13 px.
 */
function endLabelOffsets(row: Record<string, number | null> | undefined, ids: TreatmentId[]): Record<string, number> {
  const ends = ids
    .map((id) => ({ id, v: row?.[id] ?? null }))
    .filter((e): e is { id: TreatmentId; v: number } => e.v !== null)
    .sort((a, b) => b.v - a.v);
  const out: Record<string, number> = {};
  let group: typeof ends = [];
  const flush = () => {
    group.forEach((e, i) => (out[e.id] = (i - (group.length - 1) / 2) * 13));
    group = [];
  };
  for (const e of ends) {
    if (group.length && group[group.length - 1].v - e.v >= 2.5) flush();
    group.push(e);
  }
  flush();
  return out;
}

/** Etiqueta directa solo en el último punto: nombre del tratamiento en tinta de texto, no en el color de la serie. */
function endLabel(id: string, count: number, dy: number) {
  return (p: { x?: number; y?: number; index?: number; value?: number | null }) =>
    p.index === count - 1 && p.value != null && p.x !== undefined && p.y !== undefined ? (
      <text x={p.x + 8} y={p.y + dy} dy={4} fontSize={12} fontWeight={600} fill="#3f5a48">
        {id}
      </text>
    ) : (
      <g />
    );
}
