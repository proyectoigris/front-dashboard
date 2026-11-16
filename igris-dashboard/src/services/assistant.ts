/**
 * Asistente IGRIS — implementación SIMULADA basada en reglas.
 * Principio: toda cifra de la respuesta se obtiene del snapshot de datos,
 * nunca se genera libremente. Cada respuesta incluye dataRefs (trazabilidad).
 *
 * Para integrar un LLM local más adelante: implementar `AssistantService`
 * (p. ej. POST /api/assistant) haciendo que el modelo use herramientas que
 * llamen a estas mismas funciones de consulta, en vez de inventar valores.
 */
import { MOISTURE_DEPTHS, TREATMENTS, TREATMENT_IDS, VARIABLE_META } from '../config/experiment';
import { SENSOR_IDS } from '../data/simulator';
import {
  activePlants,
  currentValue,
  ENV_SENSORS,
  moistureStats,
  plantNow,
  plantsOf,
  valueAt,
  depthSensor,
  type Depth,
} from '../lib/analytics';
import { describe, fmt } from '../lib/stats';
import type { IgrisSnapshot } from '../store/igrisStore';
import type { TabKey } from '../state/ui';
import type { AssistantInteraction, PlantId, SensorType, TreatmentId } from '../types/domain';

export type AssistantAction =
  | { type: 'openTreatment'; treatmentId: TreatmentId; plantId?: PlantId }
  | { type: 'tab'; tab: TabKey };

export interface AssistantReply extends AssistantInteraction {
  action?: AssistantAction;
}

export interface AssistantService {
  ask(query: string, snapshot: IgrisSnapshot): Promise<AssistantReply>;
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,]/g, ' ');

let seq = 0;
const SIM_NOTE = ' (Datos simulados.)';

export class MockAssistant implements AssistantService {
  async ask(query: string, s: IgrisSnapshot): Promise<AssistantReply> {
    await new Promise((r) => setTimeout(r, 700)); // latencia simulada → estado "pensando"
    const base = { id: `AI-${++seq}`, t: Date.now(), query, status: 'answered' as const };
    const r = answer(norm(query), s);
    const sim = s.origin === 'simulated' ? SIM_NOTE : '';
    return { ...base, ...r, response: r.response + sim };
  }
}

type Partial = Pick<AssistantReply, 'response' | 'dataRefs' | 'action'>;

function envAnswer(s: IgrisSnapshot, type: SensorType): Partial {
  const e = ENV_SENSORS.find((x) => x.type === type);
  const meta = VARIABLE_META[type];
  if (!e) return { response: `El sensor de ${meta.label.toLowerCase()} no está habilitado.`, dataRefs: [] };
  const v = currentValue(s, e.id);
  if (v.value === null) return { response: `No hay datos recientes de ${meta.label.toLowerCase()} (sensor ${e.id}).`, dataRefs: [{ sensorId: e.id }] };
  const prev = valueAt(s, e.id, 1);
  const delta = prev !== null ? ` Hace una hora era ${fmt(prev, meta.decimals)} ${meta.unit}.` : '';
  return {
    response: `${meta.label} actual de la cámara: ${fmt(v.value, meta.decimals)} ${meta.unit}.${delta}`,
    dataRefs: [{ sensorId: e.id, t: v.t ?? undefined }],
  };
}

function plantAnswer(s: IgrisSnapshot, p: PlantId): Partial {
  const plant = s.plantById.get(p);
  if (!plant) return { response: `No encuentro la planta ${p}. Los identificadores van de P01 a P24.`, dataRefs: [] };
  const n = plantNow(s, p);
  const tr = TREATMENTS[plant.treatmentId];
  const part = (label: string, v: number | null) => `${label}: ${v === null ? 'sin datos recientes' : `${fmt(v)} %`}`;
  return {
    response:
      `Planta ${p} (${tr.id}, ${tr.label.toLowerCase()}, posición ${plant.position.label}). ` +
      `${part(`Humedad a ${MOISTURE_DEPTHS.upper} cm`, n.upper.value)}; ${part(`a ${MOISTURE_DEPTHS.lower} cm`, n.lower.value)}.` +
      (n.soilTemp.value !== null ? ` Temperatura del suelo: ${fmt(n.soilTemp.value)} °C.` : ''),
    dataRefs: [{ plantId: p, sensorId: SENSOR_IDS.upper(p) }, { plantId: p, sensorId: SENSOR_IDS.lower(p) }],
    action: { type: 'openTreatment', treatmentId: plant.treatmentId, plantId: p },
  };
}

function rankAnswer(s: IgrisSnapshot, lowest: boolean, depth: Depth): Partial {
  const rows = activePlants(s)
    .map((p) => ({ p, v: currentValue(s, depthSensor(p, depth)).value }))
    .filter((r): r is { p: PlantId; v: number } => r.v !== null)
    .sort((a, b) => (lowest ? a.v - b.v : b.v - a.v))
    .slice(0, 5);
  const list = rows.map((r) => `${r.p} (${s.plantById.get(r.p)?.treatmentId}) ${fmt(r.v)} %`).join(', ');
  return {
    response: `Plantas con ${lowest ? 'menor' : 'mayor'} humedad a ${depth === 'upper' ? MOISTURE_DEPTHS.upper : MOISTURE_DEPTHS.lower} cm: ${list}. Ranking sobre ${rows.length ? activePlants(s).length : 0} plantas activas con datos válidos.`,
    dataRefs: rows.map((r) => ({ plantId: r.p, sensorId: depthSensor(r.p, depth) })),
  };
}

function contrastAnswer(s: IgrisSnapshot, kind: 'inoc' | 'water', depth: Depth): Partial {
  const groups =
    kind === 'inoc'
      ? [{ label: 'sin inoculación', ids: ['T1', 'T3'] as TreatmentId[] }, { label: 'inoculadas', ids: ['T2', 'T4'] as TreatmentId[] }]
      : [{ label: 'riego normal', ids: ['T1', 'T2'] as TreatmentId[] }, { label: 'déficit hídrico', ids: ['T3', 'T4'] as TreatmentId[] }];
  const st = groups.map((g) => ({ ...g, d: moistureStats(s, g.ids.flatMap((t) => plantsOf(s, t)), depth) }));
  const [a, b] = st;
  const diff = a.d.mean !== null && b.d.mean !== null ? b.d.mean - a.d.mean : null;
  return {
    response:
      `Humedad a ${depth === 'upper' ? MOISTURE_DEPTHS.upper : MOISTURE_DEPTHS.lower} cm — plantas ${a.label}: ${fmt(a.d.mean)} ± ${fmt(a.d.sd)} % (n=${a.d.n}); ` +
      `${b.label}: ${fmt(b.d.mean)} ± ${fmt(b.d.sd)} % (n=${b.d.n}). Diferencia: ${diff === null ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`} puntos. ` +
      `Es una comparación descriptiva; no se ha aplicado una prueba estadística.`,
    dataRefs: st.flatMap((g) => g.ids.map((t) => ({ treatmentId: t }))),
    action: { type: 'tab', tab: 'soil' },
  };
}

function treatmentStats(s: IgrisSnapshot, t: TreatmentId): Partial {
  const ps = plantsOf(s, t);
  const up = moistureStats(s, ps, 'upper');
  const lo = moistureStats(s, ps, 'lower');
  return {
    response:
      `${t} (${TREATMENTS[t].label.toLowerCase()}): humedad a 3 cm ${fmt(up.mean)} ± ${fmt(up.sd)} % (rango ${fmt(up.min)}–${fmt(up.max)}, n=${up.n}/${up.nTotal}); ` +
      `a 15 cm ${fmt(lo.mean)} ± ${fmt(lo.sd)} % (rango ${fmt(lo.min)}–${fmt(lo.max)}, n=${lo.n}/${lo.nTotal}).`,
    dataRefs: [{ treatmentId: t }],
    action: { type: 'openTreatment', treatmentId: t },
  };
}

function allTreatments(s: IgrisSnapshot, depth: Depth): Partial {
  const parts = TREATMENT_IDS.map((t) => {
    const d = moistureStats(s, plantsOf(s, t), depth);
    return `${t} ${fmt(d.mean)} ± ${fmt(d.sd)} % (n=${d.n})`;
  });
  return {
    response: `Humedad media a ${depth === 'upper' ? 3 : 15} cm por tratamiento: ${parts.join('; ')}. Valores descriptivos.`,
    dataRefs: TREATMENT_IDS.map((t) => ({ treatmentId: t })),
    action: { type: 'tab', tab: 'soil' },
  };
}

function change24h(s: IgrisSnapshot, depth: Depth): Partial {
  const parts = TREATMENT_IDS.map((t) => {
    const ps = plantsOf(s, t);
    const deltas = describe(
      ps.map((p) => {
        const id = depthSensor(p, depth);
        const now = currentValue(s, id).value;
        const prev = valueAt(s, id, 24);
        return now !== null && prev !== null ? now - prev : null;
      }),
    );
    return `${t} ${deltas.mean === null ? '—' : `${deltas.mean > 0 ? '+' : ''}${deltas.mean.toFixed(1)}`} pts (n=${deltas.n})`;
  });
  return {
    response: `Cambio de humedad a ${depth === 'upper' ? 3 : 15} cm en las últimas 24 h (actual − hace 24 h, media por tratamiento): ${parts.join('; ')}. Te muestro la evolución en el gráfico.`,
    dataRefs: TREATMENT_IDS.map((t) => ({ treatmentId: t, note: 'Δ24h' })),
    action: { type: 'tab', tab: 'soil' },
  };
}

function answer(q: string, s: IgrisSnapshot): Partial {
  const depth: Depth = /15|inferior|profund/.test(q) ? 'lower' : 'upper';
  const plantMatch = q.match(/planta\s*p?\s*(\d{1,2})|\bp(\d{1,2})\b/);
  const trMatch = q.match(/\bt\s?([1-4])\b|tratamiento\s*([1-4])/);

  if (plantMatch) {
    const n = Number(plantMatch[1] ?? plantMatch[2]);
    return plantAnswer(s, `P${String(n).padStart(2, '0')}` as PlantId);
  }
  if (/menor humedad|mas seca|menos humedad|mas secas|menor|minima/.test(q) && /humedad|seca|planta/.test(q)) return rankAnswer(s, true, depth);
  if (/mayor humedad|mas humeda|maxima/.test(q)) return rankAnswer(s, false, depth);
  if (/24|ultimas|cambio/.test(q) && /humedad|cambio/.test(q)) return change24h(s, depth);
  if (/bacteria|inocul/.test(q)) return contrastAnswer(s, 'inoc', depth);
  if (/deficit|riego|hidric/.test(q) && /compar|diferencia|vs|frente/.test(q)) return contrastAnswer(s, 'water', depth);
  if (trMatch) return treatmentStats(s, `T${trMatch[1] ?? trMatch[2]}` as TreatmentId);
  if (/tratamientos|compar/.test(q)) return allTreatments(s, depth);
  if (/co2|dioxido|carbono/.test(q)) return envAnswer(s, 'co2');
  if (/par\b|luz|lumin|radiacion/.test(q)) return envAnswer(s, 'par');
  if (/humedad relativa|\bhr\b|humedad del aire|ambiente/.test(q)) return envAnswer(s, 'air_humidity');
  if (/temperatura/.test(q) && /suelo/.test(q)) {
    const d = describe(activePlants(s).map((p) => currentValue(s, SENSOR_IDS.soilTemp(p)).value));
    return { response: `Temperatura media del suelo (10 cm): ${fmt(d.mean)} ± ${fmt(d.sd)} °C, n=${d.n} plantas.`, dataRefs: [{ note: 'soil_temperature, todas las plantas' }] };
  }
  if (/temperatura|calor|frio/.test(q)) return envAnswer(s, 'air_temperature');
  if (/humedad/.test(q) && /suelo|media|promedio|camara/.test(q)) {
    const up = moistureStats(s, activePlants(s), 'upper');
    const lo = moistureStats(s, activePlants(s), 'lower');
    return {
      response: `Humedad media del suelo en la cámara: ${fmt(up.mean)} ± ${fmt(up.sd)} % a 3 cm (n=${up.n}) y ${fmt(lo.mean)} ± ${fmt(lo.sd)} % a 15 cm (n=${lo.n}).`,
      dataRefs: [{ note: 'soil_moisture, todas las plantas activas' }],
    };
  }
  if (/alerta|problema|falla|error/.test(q)) {
    const act = s.alerts.filter((a) => a.state === 'active');
    const top = act.slice(0, 3).map((a) => a.title).join('; ');
    return {
      response: act.length ? `Hay ${act.length} alertas activas. Las principales: ${top}.` : 'No hay alertas activas.',
      dataRefs: act.slice(0, 3).map((a) => ({ sensorId: a.sensorId, plantId: a.plantId })),
      action: { type: 'tab', tab: 'alerts' },
    };
  }
  if (/estadistic|resumen|estado general|como esta/.test(q)) {
    const up = moistureStats(s, activePlants(s), 'upper');
    const temp = currentValue(s, SENSOR_IDS.airTemp).value;
    const act = s.alerts.filter((a) => a.state === 'active').length;
    return {
      response: `Resumen: ${activePlants(s).length} plantas activas, humedad media a 3 cm ${fmt(up.mean)} ± ${fmt(up.sd)} % (n=${up.n}), temperatura del aire ${fmt(temp)} °C y ${act} alertas activas. Pregúntame por un tratamiento (T1–T4) para ver sus estadísticas.`,
      dataRefs: [{ note: 'resumen de cámara' }],
    };
  }
  if (/hola|buenas|hey/.test(q)) {
    return { response: 'Hola, soy IGRIS. Puedo darte datos de la cámara, de cualquier planta (P01–P24) o comparar tratamientos.', dataRefs: [] };
  }
  return {
    response:
      'Aún no sé responder eso. Prueba con: "temperatura actual", "humedad de la planta 12", "¿qué plantas tienen menor humedad?", "compara con y sin bacterias", "estadísticas del T3" o "cambios en las últimas 24 horas".',
    dataRefs: [],
  };
}

export const assistant: AssistantService = new MockAssistant();
