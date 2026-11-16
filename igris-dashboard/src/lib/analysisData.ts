/**
 * Tablas para "Análisis IGRIS": une sensores, diseño experimental y datos biológicos.
 *  - Plantas (n = 24): variables derivadas de los sensores de cada rizotrón + factores del diseño.
 *  - Muestras biológicas (n = 12 = 4 tratamientos × 3 días): microbioma y proteoma (DEMO).
 */
import { TREATMENTS } from '../config/experiment';
import { BIO, BIO_DAYS, type BioDay } from '../data/bio/bioData';
import type { IgrisSnapshot } from '../store/igrisStore';
import type { PlantId, TreatmentId } from '../types/domain';
import { activePlants, currentValue, depthSensor, displaySeries, plantNow, sensorTrend } from './analytics';
import { SENSOR_IDS } from '../data/simulator';

export interface Variable {
  key: string;
  label: string;
  unit: string;
}
export interface Observation {
  id: string;
  label: string;
  treatment: TreatmentId;
  day?: BioDay;
  values: Record<string, number | null>;
}
export interface AnalysisTable {
  name: string;
  description: string;
  variables: Variable[];
  rows: Observation[];
}

export const PLANT_VARS: Variable[] = [
  { key: 'h3', label: 'Humedad 3 cm', unit: '%' },
  { key: 'h15', label: 'Humedad 15 cm', unit: '%' },
  { key: 'dh', label: 'Δ 3−15 cm', unit: 'pts' },
  { key: 'h3mean', label: 'Humedad 3 cm (media 24 h)', unit: '%' },
  { key: 'h3amp', label: 'Amplitud diaria 3 cm', unit: 'pts' },
  { key: 'trend', label: 'Tendencia 6 h', unit: '%/h' },
  { key: 'tsoil', label: 'Temperatura suelo', unit: '°C' },
  { key: 'deficit', label: 'Déficit hídrico (0/1)', unit: '' },
  { key: 'inoc', label: 'Inoculación (0/1)', unit: '' },
];

export function plantTable(s: IgrisSnapshot): AnalysisTable {
  const rows: Observation[] = activePlants(s).map((p: PlantId) => {
    const plant = s.plantById.get(p)!;
    const n = plantNow(s, p);
    const day = displaySeries(s.history.get(depthSensor(p, 'upper')), '24h', s.now)
      .map((x) => x.mean)
      .filter((v): v is number => v !== null);
    const t = TREATMENTS[plant.treatmentId];
    return {
      id: p,
      label: p,
      treatment: plant.treatmentId,
      values: {
        h3: n.upper.value,
        h15: n.lower.value,
        dh: n.diff,
        h3mean: day.length ? day.reduce((a, b) => a + b, 0) / day.length : null,
        h3amp: day.length ? Math.max(...day) - Math.min(...day) : null,
        trend: sensorTrend(s, depthSensor(p, 'upper'), 6),
        tsoil: currentValue(s, SENSOR_IDS.soilTemp(p)).value,
        deficit: t.waterRegime === 'deficit' ? 1 : 0,
        inoc: t.inoculated ? 1 : 0,
      },
    };
  });
  return {
    name: 'Plantas (sensores)',
    description: 'Una fila por planta (n = 24) con variables de los sensores del rizotrón y los factores del diseño.',
    variables: PLANT_VARS,
    rows,
  };
}

export const BIO_VARS: Variable[] = [
  { key: 'shannon', label: 'Diversidad Shannon', unit: '' },
  { key: 'richness', label: 'Riqueza (ASV)', unit: '' },
  { key: 'udaeo', label: 'Ca. Udaeobacter', unit: '%' },
  { key: 'brady', label: 'Bradyrhizobium', unit: '%' },
  { key: 'verruco', label: 'Verrucomicrobiota', unit: '%' },
  { key: 'photo', label: 'Proteínas de fotosíntesis', unit: '%' },
  { key: 'ox', label: 'Proteínas de estrés oxidativo', unit: '%' },
  { key: 'def', label: 'Proteínas de defensa', unit: '%' },
  { key: 'day', label: 'Día', unit: 'd' },
];

export function bioTable(): AnalysisTable {
  const rows: Observation[] = [];
  for (const t of Object.keys(BIO.microbiome.data) as TreatmentId[]) {
    for (const d of BIO_DAYS) {
      const m = BIO.microbiome.data[t][d];
      const g = (name: string) => m.genus.find((x) => x.taxon === name)?.pct ?? 0;
      const ph = (name: string) => m.phylum.find((x) => x.taxon === name)?.pct ?? 0;
      const cat = (name: string) => BIO.proteins.categories[t][d].find((c) => c.category === name)?.pct ?? 0;
      rows.push({
        id: `${t}-d${d}`,
        label: `${t} · d${d}`,
        treatment: t,
        day: d,
        values: {
          shannon: m.shannon,
          richness: m.richness,
          udaeo: g('Ca. Udaeobacter'),
          brady: g('Bradyrhizobium'),
          verruco: ph('Verrucomicrobiota'),
          photo: cat('Fotosíntesis'),
          ox: cat('Estrés oxidativo'),
          def: cat('Defensa contra patógenos'),
          day: d,
        },
      });
    }
  }
  return {
    name: 'Muestras biológicas (demo)',
    description: 'Una fila por tratamiento y día (n = 12): microbioma de raíz y proteoma de hoja.',
    variables: BIO_VARS,
    rows,
  };
}

/** Perfiles de abundancia por género (para Bray-Curtis / PCoA). */
export function microbiomeProfiles(): { obs: Observation[]; taxa: string[]; matrix: number[][] } {
  const obs = bioTable().rows;
  const taxa = BIO.microbiome.data.T1[0].genus.map((x) => x.taxon);
  const matrix = obs.map((o) => BIO.microbiome.data[o.treatment][o.day!].genus.map((x) => x.pct));
  return { obs, taxa, matrix };
}
