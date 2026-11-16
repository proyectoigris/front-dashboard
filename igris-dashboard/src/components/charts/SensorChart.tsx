import { memo, useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { displaySeries, RANGE_HOURS, type RangeKey } from '../../lib/analytics';
import { useSnapshot } from '../../store/igrisStore';
import { AXIS, DarkTooltip, GRID, THRESHOLD_LINE, timeDomain, timeTick } from './chartTheme';

export interface SeriesSpec {
  sensorId: string;
  name: string;
  color: string;
  /** Muestra banda mín–máx del bucket. */
  band?: boolean;
  dashed?: boolean;
}

/** Serie(s) de sensores con banda mín–máx opcional y marcas de eventos. */
export const SensorChart = memo(function SensorChart({
  series,
  range,
  unit,
  decimals = 1,
  yDomain,
  thresholds,
  events = [],
  extra,
}: {
  series: SeriesSpec[];
  range: RangeKey;
  unit?: string;
  decimals?: number;
  yDomain?: [number | 'auto', number | 'auto'];
  thresholds?: { min?: number; max?: number };
  events?: { t: number; label: string }[];
  /** Serie adicional precalculada (p. ej. media del tratamiento). */
  extra?: { key: string; name: string; color: string; data: { t: number; v: number | null }[] };
}) {
  const s = useSnapshot();
  const data = useMemo(() => {
    const rows = new Map<number, Record<string, number | null | [number, number]>>();
    for (const spec of series) {
      for (const p of displaySeries(s.history.get(spec.sensorId), range, s.now)) {
        const row = rows.get(p.t) ?? { t: p.t };
        row[spec.sensorId] = p.mean;
        if (spec.band && p.min !== null && p.max !== null) row[`${spec.sensorId}_range`] = [p.min, p.max];
        rows.set(p.t, row);
      }
    }
    if (extra) for (const p of extra.data) {
      const row = rows.get(p.t) ?? { t: p.t };
      row[extra.key] = p.v;
      rows.set(p.t, row);
    }
    return [...rows.values()].sort((a, b) => (a.t as number) - (b.t as number));
  }, [s.version, series, range, extra]); // eslint-disable-line react-hooks/exhaustive-deps

  const domain = timeDomain(s.now, RANGE_HOURS[range]);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="t" type="number" scale="time" domain={domain} tickFormatter={timeTick(range)} minTickGap={48} {...AXIS} />
        <YAxis domain={yDomain ?? ['auto', 'auto']} width={48} allowDecimals={decimals > 0} {...AXIS} />
        {thresholds?.min !== undefined && <ReferenceLine y={thresholds.min} {...THRESHOLD_LINE} />}
        {thresholds?.max !== undefined && <ReferenceLine y={thresholds.max} {...THRESHOLD_LINE} />}
        {events
          .filter((e) => e.t >= domain[0])
          .map((e) => (
            <ReferenceLine key={e.t} x={e.t} stroke="#d5e5d9" />
          ))}
        <Tooltip content={<DarkTooltip unit={unit} decimals={decimals} />} cursor={{ stroke: '#b9d4c1' }} />
        {series
          .filter((sp) => sp.band)
          .map((sp) => (
            <Area
              key={`${sp.sensorId}_range`}
              dataKey={`${sp.sensorId}_range`}
              stroke="none"
              fill={sp.color}
              fillOpacity={0.1}
              isAnimationActive={false}
              activeDot={false}
            />
          ))}
        {series.map((sp) => (
          <Line
            key={sp.sensorId}
            dataKey={sp.sensorId}
            name={sp.name}
            stroke={sp.color}
            strokeWidth={2}
            strokeDasharray={sp.dashed ? '5 4' : undefined}
            dot={false}
            isAnimationActive={false}
          />
        ))}
        {extra && (
          <Line
            dataKey={extra.key}
            name={extra.name}
            stroke={extra.color}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
});
