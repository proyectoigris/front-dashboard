/**
 * Inicio: resumen de un vistazo. Pocas tarjetas grandes, una cifra principal
 * cada una; el detalle se abre al tocar (progressive disclosure).
 * El color solo aparece cuando algo se sale de lo normal.
 */
import { useMemo, type ReactNode } from 'react';
import { THRESHOLDS, TREATMENTS, TREATMENT_IDS } from '../../config/experiment';
import { SENSOR_IDS } from '../../data/simulator';
import { activePlants, currentValue, displaySeries, evapotranspiration, moistureStats, plantNow, plantsOf, treatmentSeries } from '../../lib/analytics';
import { AlertRing, MiniBars, Sparkline } from '../charts/Sparkline';
import { fmt } from '../../lib/stats';
import { useSnapshot } from '../../store/igrisStore';
import type { TabKey } from '../../state/ui';
import type { PlantId, TreatmentId } from '../../types/domain';

export function Home({ onSection, onTreatment }: { onSection: (t: TabKey) => void; onTreatment: (t: TreatmentId, p?: PlantId) => void }) {
  const s = useSnapshot();
  const plants = activePlants(s);
  const up = moistureStats(s, plants, 'upper');
  const lo = moistureStats(s, plants, 'lower');
  const complete = plants.filter((p) => plantNow(s, p).status === 'ok').length;
  const alerts = s.alerts.filter((a) => a.state === 'active');
  const critical = alerts.filter((a) => a.severity === 'critical').length;
  const temp = currentValue(s, SENSOR_IDS.airTemp).value;
  const hr = currentValue(s, SENSOR_IDS.airHum).value;
  const co2 = currentValue(s, SENSOR_IDS.co2).value;
  const par = currentValue(s, SENSOR_IDS.par).value;
  const tempOut = temp !== null && (temp < THRESHOLDS.air_temperature.min || temp > THRESHOLDS.air_temperature.max);

  // Series de los mini gráficos (se recalculan con cada snapshot, cada ~5 s).
  const charts = useMemo(() => {
    const tempSeries = displaySeries(s.history.get(SENSOR_IDS.airTemp), '24h', s.now).slice(-36).map((p) => p.mean);
    const rows = treatmentSeries(s, 'upper', '24h');
    const byTreatment = Object.fromEntries(TREATMENT_IDS.map((t) => [t, rows.map((r) => r[t] ?? null)])) as Record<TreatmentId, (number | null)[]>;
    const chamber = rows.map((r) => {
      const v = TREATMENT_IDS.map((t) => r[t]).filter((x): x is number => typeof x === 'number');
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    });
    const et = activePlants(s).map((p) => ({
      title: p,
      value: evapotranspiration(s, p).daily,
      color: TREATMENTS[s.plantById.get(p)!.treatmentId].color,
    }));
    const etVals = et.map((e) => e.value).filter((v): v is number => v !== null);
    const etMean = etVals.length ? etVals.reduce((a, b) => a + b, 0) / etVals.length : null;
    return { tempSeries, byTreatment, chamber, et, etMean };
  }, [s.version]); // eslint-disable-line react-hooks/exhaustive-deps
  // Sensores con alguna alerta activa (por sensor, o por planta cuando la alerta es de un modelo).
  const enabledSensors = s.sensors.filter((x) => x.status !== 'disabled');
  const alertSensorIds = new Set(alerts.flatMap((a) => (a.sensorId ? [a.sensorId] : enabledSensors.filter((x) => x.scope === a.plantId).map((x) => x.id))));
  const sensorsAlert = enabledSensors.filter((x) => alertSensorIds.has(x.id)).length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <section className="grid min-h-0 flex-1 grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <SectionCard
          title="Ambiente"
          icon="temp"
          tint="#24aecf"
          value={fmt(temp, 1)}
          unit="°C"
          warn={tempOut}
          caption="Temperatura del aire"
          detail={`HR ${fmt(hr, 0)} %   ·   CO₂ ${fmt(co2, 0)} ppm   ·   PAR ${fmt(par, 0)}`}
          onClick={() => onSection('environment')}
          chart={<Sparkline values={charts.tempSeries} color="#24aecf" label="Últimas 6 h" />}
        />
        <SectionCard
          title="Suelo"
          icon="drop"
          tint="#d3a23e"
          value={fmt(up.mean, 1)}
          unit="%"
          caption="Humedad media a 3 cm"
          detail={`A 15 cm: ${fmt(lo.mean, 1)} %   ·   n = ${up.n} plantas`}
          onClick={() => onSection('soil')}
          chart={<Sparkline values={charts.chamber} color="#d3a23e" label="Humedad 3 cm · últimas 24 h" />}
        />
        <SectionCard
          title="Plantas"
          icon="leaf"
          tint="#74b43b"
          value={fmt(charts.etMean, 1)}
          unit="mm/día"
          caption="Evapotranspiración media · 24 h"
          detail={`${complete} de ${plants.length} plantas con sensores en línea`}
          onClick={() => onSection('plants')}
          chart={
            <MiniBars
              label="Evapotranspiración estimada por planta (mm/día)"
              max={Math.max(1, ...charts.et.map((e) => e.value ?? 0))}
              bars={charts.et}
            />
          }
        />
        <SectionCard
          title="Alertas"
          icon="bell"
          tint="#0085de"
          value={`${alerts.length}`}
          unit={alerts.length === 1 ? 'activa' : 'activas'}
          warn={alerts.length > 0}
          caption={critical ? `${critical} crítica${critical > 1 ? 's' : ''}` : 'Ninguna crítica'}
          detail={alerts[0]?.title ?? 'Todo en orden'}
          onClick={() => onSection('alerts')}
          chart={
            <AlertRing alerts={alerts.length} sensorsOk={enabledSensors.length - sensorsAlert} sensorsAlert={sensorsAlert} />
          }
        />
      </section>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="text-base font-medium text-white">Tratamientos</h2>
          <span className="text-sm text-white/85 max-md:hidden">Toca uno para ver sus datos y su planta 3D</span>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          {TREATMENT_IDS.map((id) => {
            const t = TREATMENTS[id];
            const m = moistureStats(s, plantsOf(s, id), 'upper');
            const low = m.mean !== null && m.mean < THRESHOLDS.soil_moisture.min;
            return (
              <Card key={id} onClick={() => onTreatment(id)} accent={t.color}>
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                  <span className="text-lg font-semibold text-ink">{id}</span>
                  <OpenPill>Ver planta</OpenPill>
                </div>
                <div className="my-2 min-h-0 flex-1 in-[.m-flow]:h-12 in-[.m-flow]:flex-none">
                  <Sparkline values={charts.byTreatment[id]} color={t.color} label="Humedad 3 cm · 24 h" />
                </div>
                <p className="text-xs text-ink-3 md:text-sm">
                  {t.waterRegime === 'normal' ? 'Riego normal' : 'Déficit hídrico'} · {t.inoculated ? 'Inoculado' : 'Sin inocular'}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className={`stat text-3xl font-semibold md:text-4xl ${low ? 'text-warn' : 'text-ink'}`}>{fmt(m.mean, 1)}</span>
                  <span className="text-base text-ink-3">%</span>
                </div>
                <p className="text-xs text-ink-3 md:text-sm">Humedad a 3 cm · n = {m.n}</p>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Card({ onClick, accent, children }: { onClick: () => void; accent?: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-panel p-3.5 text-left md:p-6 shadow-sm transition-colors hover:border-line-strong hover:bg-panel-2 active:bg-panel-2"
    >
      {accent && <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: accent }} />}
      {children}
    </button>
  );
}

function SectionCard({
  title,
  value,
  unit,
  caption,
  detail,
  warn,
  icon,
  tint,
  chart,
  onClick,
}: {
  chart?: ReactNode;
  icon: IconName;
  tint: string;
  title: string;
  value: string;
  unit: string;
  caption: string;
  detail: string;
  warn?: boolean;
  onClick: () => void;
}) {
  return (
    <Card onClick={onClick}>
      <div className="flex items-center gap-2 md:gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl md:h-11 md:w-11" style={{ background: `${tint}22`, color: tint }}>
          <Icon name={icon} />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-ink md:text-base">{title}</h3>
        <OpenPill>Ver detalle</OpenPill>
      </div>
      <div className="my-3 min-h-0 flex-1 in-[.m-flow]:h-14 in-[.m-flow]:flex-none">{chart}</div>
      <div className="flex items-baseline gap-2">
        <span className={`stat text-3xl leading-none md:text-5xl font-semibold ${warn ? 'text-warn' : 'text-ink'}`}>{value}</span>
        <span className="text-sm text-ink-3 md:text-lg">{unit}</span>
      </div>
      <p className="mt-2 truncate text-xs text-ink-2 md:text-sm">{caption}</p>
      <p className="mt-1 truncate text-sm whitespace-pre text-ink-3 max-md:hidden">{detail}</p>
    </Card>
  );
}

export const SECTION_TITLES: Record<TabKey, string> = {
  home: 'Inicio',
  environment: 'Ambiente',
  soil: 'Suelo y tratamientos',
  plants: 'Plantas',
  alerts: 'Alertas',
  analysis: 'Análisis IGRIS',
};

type IconName = 'temp' | 'drop' | 'leaf' | 'bell';

/** Íconos de línea simples (sin librerías externas: funciona offline). */
function Icon({ name }: { name: IconName }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" {...p}>
      {name === 'temp' && <path d="M14 14.76V4a2 2 0 0 0-4 0v10.76a4 4 0 1 0 4 0zM12 9v7" />}
      {name === 'drop' && <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />}
      {name === 'leaf' && <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7" />}
      {name === 'bell' && <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 20a2 2 0 0 1-3.4 0" />}
    </svg>
  );
}

/** Indicador visible de "esto se puede tocar" (las tarjetas completas son botones). */
function OpenPill({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-ink px-2.5 py-1.5 md:px-3 text-xs font-semibold text-white shadow-sm transition-colors group-hover:bg-[#3f7619]">
      <span className="max-md:hidden">{children}</span> <span aria-hidden>›</span>
    </span>
  );
}
