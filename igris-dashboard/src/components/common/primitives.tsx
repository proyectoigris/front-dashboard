import type { ReactNode } from 'react';
import { TREATMENTS } from '../../config/experiment';
import type { AlertOrigin, AlertSeverity, TreatmentId } from '../../types/domain';

export function Panel({
  title,
  right,
  children,
  className = '',
  bodyClassName = '',
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`panel flex min-h-0 flex-col ${className}`}>
      {(title || right) && (
        <header className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <h2 className="panel-title">{title}</h2>
          {right}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** Marca obligatoria para todo dato simulado. */
export function SimBadge({ compact = false, onDark = false }: { compact?: boolean; onDark?: boolean }) {
  return (
    <span
      title="Datos simulados de demostración. No constituyen evidencia experimental."
      className={`inline-flex items-center gap-1.5 text-xs ${onDark ? 'text-white/75' : 'text-ink-3'}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-warn" />
      {compact ? 'SIM' : 'Datos simulados'}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex rounded-lg border border-line-strong bg-white p-0.5 shadow-sm">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md font-medium transition-colors ${
            size === 'sm' ? 'min-h-9 px-3 text-xs' : 'min-h-10 px-3.5 text-sm'
          } ${value === o.value ? 'bg-accent-ink text-white shadow-sm' : 'text-ink-2 hover:bg-panel-2 hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TreatmentChip({ id, full = false }: { id: TreatmentId; full?: boolean }) {
  const t = TREATMENTS[id];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
      <span className="font-medium text-ink-2">{t.id}</span>
      {full && <span>{t.label}</span>}
    </span>
  );
}

const SEV_STYLE: Record<AlertSeverity, string> = {
  critical: 'bg-crit/15 text-crit border-crit/40',
  warning: 'bg-warn/15 text-warn border-warn/40',
  info: 'bg-info/15 text-info border-info/40',
};
const SEV_LABEL: Record<AlertSeverity, string> = { critical: 'Crítica', warning: 'Aviso', info: 'Info' };
const ORIGIN_LABEL: Record<AlertOrigin, string> = { threshold: 'Umbral', device: 'Dispositivo', model: 'Modelo' };

export function SeverityTag({ s }: { s: AlertSeverity }) {
  return <span className={`rounded border px-1.5 py-px text-[10px] font-semibold uppercase ${SEV_STYLE[s]}`}>{SEV_LABEL[s]}</span>;
}

export function OriginTag({ o }: { o: AlertOrigin }) {
  return (
    <span className="rounded border border-line-strong px-1.5 py-px text-[10px] font-medium tracking-wide text-ink-2 uppercase">
      {ORIGIN_LABEL[o]}
    </span>
  );
}

export function StatusDot({ status }: { status: 'ok' | 'warn' | 'crit' | 'off' }) {
  const c = { ok: 'bg-bio', warn: 'bg-warn', crit: 'bg-crit', off: 'bg-ink-3' }[status];
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${c}`} />;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line p-4 text-center">
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {children && <p className="max-w-md text-xs text-ink-3">{children}</p>}
    </div>
  );
}

// ---------- formato de tiempo ----------

export const fmtTime = (t: number) =>
  new Date(t).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const fmtTimeSec = (t: number) =>
  new Date(t).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export const fmtDateTime = (t: number) =>
  new Date(t).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const fmtDay = (t: number) => new Date(t).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });

export function relTime(t: number, now: number) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}
