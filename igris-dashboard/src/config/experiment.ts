import type { PlantId, SensorType, Treatment, TreatmentId } from '../types/domain';

/**
 * Configuración experimental. Todo lo que depende del protocolo vive aquí,
 * no en los componentes. En la fase con backend, este objeto se obtendrá de
 * GET /api/config y este archivo quedará como valor por defecto.
 */

export const TREATMENTS: Record<TreatmentId, Treatment> = {
  T1: {
    id: 'T1',
    waterRegime: 'normal',
    inoculated: false,
    label: 'Riego normal · sin inoculación',
    description: 'Condición de referencia hídrica, sin inoculación bacteriana.',
    // Paleta del logotipo IGRIS, orden validado para daltonismo sobre blanco (lima y mostaza nunca adyacentes).
    color: '#74b43b',
  },
  T2: {
    id: 'T2',
    waterRegime: 'normal',
    inoculated: true,
    label: 'Riego normal · inoculado',
    description: 'Condición de referencia hídrica, con inoculación bacteriana.',
    color: '#0085de',
  },
  T3: {
    id: 'T3',
    waterRegime: 'deficit',
    inoculated: false,
    label: 'Déficit hídrico · sin inoculación',
    description: 'Déficit hídrico objetivo del 50 % respecto de la referencia, sin inoculación.',
    color: '#d3a23e',
  },
  T4: {
    id: 'T4',
    waterRegime: 'deficit',
    inoculated: true,
    label: 'Déficit hídrico · inoculado',
    description: 'Déficit hídrico objetivo del 50 % respecto de la referencia, con inoculación.',
    color: '#08a1ba',
  },
};

export const TREATMENT_IDS: TreatmentId[] = ['T1', 'T2', 'T3', 'T4'];

/**
 * Asignación planta → tratamiento. Es explícita y configurable: NO se deriva
 * del orden numérico. Este mapa es un ejemplo aleatorizado para la demo;
 * reemplazar por la asignación real del protocolo.
 */
export const PLANT_ASSIGNMENT: Record<PlantId, TreatmentId> = {
  P01: 'T3', P02: 'T1', P03: 'T4', P04: 'T2', P05: 'T1', P06: 'T3',
  P07: 'T2', P08: 'T4', P09: 'T3', P10: 'T1', P11: 'T2', P12: 'T4',
  P13: 'T1', P14: 'T3', P15: 'T4', P16: 'T2', P17: 'T4', P18: 'T1',
  P19: 'T2', P20: 'T3', P21: 'T1', P22: 'T4', P23: 'T3', P24: 'T2',
};

/** Disposición física de la cámara: filas A–D × columnas 1–6. */
export const CHAMBER_LAYOUT = { rows: 4, cols: 6 } as const;

/** Profundidades de los sensores de humedad en cada rizotrón (cm al centro del sensor). */
export const MOISTURE_DEPTHS = { upper: 3, lower: 15 } as const;

/**
 * Disponibilidad de variables. Un sensor deshabilitado no se muestra ni
 * participa en cálculos; permite incorporar sensores en etapas posteriores.
 */
export const SENSOR_AVAILABILITY: Record<SensorType, boolean> = {
  air_temperature: true,
  air_humidity: true,
  co2: true,
  par: true,
  soil_moisture: true,
  soil_temperature: true,
  soil_ph: false,
  soil_ec: false,
};

export const VARIABLE_META: Record<SensorType, { label: string; short: string; unit: string; decimals: number }> = {
  air_temperature: { label: 'Temperatura del aire', short: 'T aire', unit: '°C', decimals: 1 },
  air_humidity: { label: 'Humedad relativa', short: 'HR', unit: '%', decimals: 0 },
  co2: { label: 'CO₂', short: 'CO₂', unit: 'ppm', decimals: 0 },
  par: { label: 'PAR', short: 'PAR', unit: 'µmol m⁻² s⁻¹', decimals: 0 },
  soil_moisture: { label: 'Humedad del suelo', short: 'H suelo', unit: '% VWC', decimals: 1 },
  soil_temperature: { label: 'Temperatura del suelo', short: 'T suelo', unit: '°C', decimals: 1 },
  soil_ph: { label: 'pH del suelo', short: 'pH', unit: '', decimals: 2 },
  soil_ec: { label: 'Conductividad eléctrica', short: 'CE', unit: 'mS cm⁻¹', decimals: 2 },
};

/**
 * Umbrales configurables para alertas. Son umbrales operativos de monitoreo,
 * no criterios de estrés fisiológico.
 */
export const THRESHOLDS = {
  air_temperature: { min: 18, max: 30 },
  air_humidity: { min: 45, max: 85 },
  co2: { min: 350, max: 1200 },
  soil_moisture: { min: 15, max: 45 },
  soil_temperature: { min: 15, max: 28 },
  /** Segundos sin datos para considerar un sensor "sin datos recientes". */
  staleAfterSec: 60,
} as const;

/** Frecuencias (sección 4.3): adquisición ≠ refresco visual ≠ agregación. */
export const TIMING = {
  acquisitionMs: 3500,
  uiRefreshMs: 5000,
  historyBucketMin: 10,
  historyDays: 7,
} as const;
