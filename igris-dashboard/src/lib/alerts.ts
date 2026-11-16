/**
 * Motor de alertas. Cada alerta declara su origen:
 *  - 'threshold': valor fuera de un umbral configurado (config/experiment.ts),
 *  - 'device':    ausencia de datos / fallo de comunicación / lectura de baja calidad,
 *  - 'model':     resultado de un modelo de análisis (aquí: un detector simple de demo).
 * Nunca se etiqueta una planta como "estresada": solo se reporta la condición medida.
 */
import { THRESHOLDS, VARIABLE_META } from '../config/experiment';
import { SENSOR_IDS } from '../data/simulator';
import type { IgrisSnapshot } from '../store/igrisStore';
import type { Alert, AlertSeverity, PlantId } from '../types/domain';
import { fmt } from './stats';

type Draft = Omit<Alert, 'state' | 'dataOrigin'>;

export function computeAlerts(s: IgrisSnapshot, now: number, acknowledged: Set<string>): Alert[] {
  const out: Draft[] = [];
  const staleMs = THRESHOLDS.staleAfterSec * 1000;

  for (const sensor of s.sensors) {
    if (sensor.status === 'disabled') continue;
    const last = s.lastValid.get(sensor.id);
    const plantId = sensor.scope === 'chamber' ? undefined : (sensor.scope as PlantId);

    // Dispositivo: sin datos recientes.
    if (!last || now - last.t > staleMs) {
      const mins = last ? Math.round((now - last.t) / 60_000) : null;
      out.push({
        id: `dev-stale-${sensor.id}`,
        origin: 'device',
        severity: mins !== null && mins > 15 ? 'critical' : 'warning',
        t: last?.t ?? now,
        plantId,
        sensorId: sensor.id,
        title: `Sin datos recientes · ${sensor.id}`,
        detail: mins !== null
          ? `Última lectura válida hace ${mins} min (${sensor.location}). Revisar conexión del sensor.`
          : `No se han recibido lecturas válidas (${sensor.location}).`,
      });
      continue;
    }

    // Dispositivo: última lectura de baja calidad.
    const latest = s.latest.get(sensor.id);
    if (latest && latest.quality === 'suspect') {
      out.push({
        id: `dev-suspect-${sensor.id}`,
        origin: 'device',
        severity: 'info',
        t: latest.t,
        plantId,
        sensorId: sensor.id,
        title: `Lectura sospechosa · ${sensor.id}`,
        detail: `Valor ${fmt(latest.value, 1)} marcado como sospechoso y excluido de los promedios.`,
      });
    }

    // Umbrales configurados.
    const th = (THRESHOLDS as Record<string, unknown>)[sensor.type] as { min: number; max: number } | undefined;
    if (th && last.value !== null && (last.value < th.min || last.value > th.max)) {
      const meta = VARIABLE_META[sensor.type];
      const low = last.value < th.min;
      const sev: AlertSeverity =
        Math.abs(last.value - (low ? th.min : th.max)) > (th.max - th.min) * 0.15 ? 'critical' : 'warning';
      out.push({
        id: `th-${sensor.id}-${low ? 'low' : 'high'}`,
        origin: 'threshold',
        severity: sev,
        t: last.t,
        plantId,
        sensorId: sensor.id,
        title: `${meta.label} ${low ? 'bajo' : 'sobre'} umbral${plantId ? ` · ${plantId}` : ''}${sensor.depthCm ? ` (${sensor.depthCm} cm)` : ''}`,
        detail: `${fmt(last.value, meta.decimals)} ${meta.unit} (umbral ${low ? 'mín.' : 'máx.'} ${low ? th.min : th.max} ${meta.unit}). Umbral operativo de monitoreo; no implica diagnóstico fisiológico.`,
      });
    }
  }

  // Modelo (demo): perfil vertical invertido persistente → posible problema de sensor o de riego.
  for (const p of s.plants) {
    const up = s.lastValid.get(SENSOR_IDS.upper(p.id));
    const lo = s.lastValid.get(SENSOR_IDS.lower(p.id));
    if (!up?.value || !lo?.value || now - up.t > staleMs || now - lo.t > staleMs) continue;
    if (up.value - lo.value > 12) {
      out.push({
        id: `model-profile-${p.id}`,
        origin: 'model',
        severity: 'info',
        t: now,
        plantId: p.id,
        title: `Perfil vertical atípico · ${p.id}`,
        detail: `Diferencia 3 cm − 15 cm = ${fmt(up.value - lo.value, 1)} pts. Detector heurístico de demostración; requiere validación.`,
      });
    }
  }

  const rank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return out
    .map<Alert>((a) => ({ ...a, state: acknowledged.has(a.id) ? 'acknowledged' : 'active', dataOrigin: s.origin }))
    .sort((a, b) => (a.state === b.state ? rank[a.severity] - rank[b.severity] || b.t - a.t : a.state === 'active' ? -1 : 1));
}
