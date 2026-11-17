import { useState } from 'react';
import { igrisStore, useSnapshot } from '../../store/igrisStore';
import { useUi } from '../../state/ui';
import type { AlertOrigin, TreatmentId } from '../../types/domain';
import { OriginTag, Panel, relTime, Segmented, SeverityTag, StatusDot } from '../common/primitives';

export function AlertsList({ compact = false, onOpenPlant }: { compact?: boolean; onOpenPlant?: (t: TreatmentId, p: string) => void }) {
  const s = useSnapshot();
  const ui = useUi();
  const [filter, setFilter] = useState<AlertOrigin | 'all'>('all');
  const alerts = s.alerts.filter((a) => filter === 'all' || a.origin === filter);
  const active = s.alerts.filter((a) => a.state === 'active').length;

  return (
    <Panel
      title={
        <span>
          Alertas <span className="ml-1 rounded bg-crit/20 px-1.5 text-crit">{active}</span>
        </span>
      }
      right={
        !compact && (
          <Segmented
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'threshold', label: 'Umbral' },
              { value: 'device', label: 'Dispositivo' },
              { value: 'model', label: 'Modelo' },
            ]}
          />
        )
      }
      bodyClassName="scroll-y px-3 pb-3"
    >
      <ul className="space-y-1.5">
        {alerts.length === 0 && <li className="py-6 text-center text-sm text-ink-3">Sin alertas.</li>}
        {(compact ? alerts.slice(0, 12) : alerts).map((a) => {
          const plant = a.plantId ? s.plantById.get(a.plantId) : undefined;
          return (
            <li
              key={a.id}
              className={`rounded-lg border px-3 py-2 ${a.state === 'active' ? 'border-line bg-panel-2/60' : 'border-line/50 opacity-55'}`}
            >
              <div className="flex items-center gap-1.5">
                <SeverityTag s={a.severity} />
                <OriginTag o={a.origin} />
                <span className="ml-auto text-[10px] text-ink-3">{relTime(a.t, s.now)}</span>
              </div>
              <div className="mt-1 text-[13px] leading-snug font-medium text-ink">{a.title}</div>
              {!compact && <div className="mt-0.5 text-xs text-ink-2">{a.detail}</div>}
              <div className="mt-1.5 flex gap-2">
                {plant && onOpenPlant && (
                  <button
                    onClick={() => {
                      ui.openPlant(plant.id);
                      onOpenPlant(plant.treatmentId, plant.id);
                    }}
                    className="min-h-8 rounded-md border border-line-strong px-2.5 text-xs text-ink-2 hover:text-ink"
                  >
                    Ver {plant.id}
                  </button>
                )}
                {a.state === 'active' && (
                  <button
                    onClick={() => igrisStore.acknowledge(a.id)}
                    className="min-h-8 rounded-md border border-line-strong px-2.5 text-xs text-ink-2 hover:text-ink"
                  >
                    Reconocer
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {!compact && (
        <div className="mt-4">
          <h3 className="panel-title mb-2">Dispositivos</h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {s.devices.map((d) => (
              <li key={d.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                <StatusDot status={d.status === 'connected' ? 'ok' : d.status === 'degraded' ? 'warn' : 'crit'} />
                <span>{d.label}</span>
                <span className="ml-auto text-xs text-ink-3">{d.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
