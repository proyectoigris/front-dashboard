import type { TooltipProps } from 'recharts';
import { fmtDateTime, fmtDay, fmtTime } from '../common/primitives';
import type { RangeKey } from '../../lib/analytics';

// Cromo recesivo: ejes y cuadrícula como líneas finas sólidas, un tono sobre la superficie.
export const AXIS = {
  stroke: '#c9dccf',
  tick: { fill: '#6b8574' },
  tickLine: false,
} as const;

export const GRID = { stroke: '#e6efe8', vertical: false } as const;

/** Línea de umbral configurado (discontinua = umbral, no dato). */
export const THRESHOLD_LINE = { stroke: '#d03b3b', strokeDasharray: '4 4', strokeOpacity: 0.7 } as const;

export const timeTick = (range: RangeKey) => (t: number) => (range === '7d' ? fmtDay(t) : fmtTime(t));

export function timeDomain(now: number, hours: number): [number, number] {
  return [now - hours * 3_600_000, now];
}

/** Tooltip compacto: muestra cada serie con su n efectivo cuando existe `${key}_n`. */
export function DarkTooltip({
  active,
  payload,
  label,
  unit,
  decimals = 1,
}: TooltipProps<number, string> & { unit?: string; decimals?: number }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as Record<string, number | null> | undefined;
  return (
    <div className="rounded-lg border border-line-strong bg-panel px-3 py-2 text-xs shadow-lg">
      <div className="num mb-1 text-ink-3">{fmtDateTime(Number(label))}</div>
      {payload
        .filter((p) => typeof p.value === 'number' && !String(p.dataKey).includes('range'))
        .map((p) => {
          const n = row?.[`${p.dataKey}_n`];
          return (
            <div key={String(p.dataKey)} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              <span className="text-ink-2">{p.name}</span>
              <span className="num ml-auto pl-3 text-ink">
                {(p.value as number).toFixed(decimals)}
                {unit ? ` ${unit}` : ''}
              </span>
              {typeof n === 'number' && <span className="num text-ink-3">n={n}</span>}
            </div>
          );
        })}
    </div>
  );
}
