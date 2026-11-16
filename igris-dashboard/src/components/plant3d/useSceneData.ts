import { SENSOR_AVAILABILITY, VARIABLE_META } from '../../config/experiment';
import { SENSOR_IDS } from '../../data/simulator';
import { currentValue, moistureStats, plantNow, plantsOf } from '../../lib/analytics';
import { describe } from '../../lib/stats';
import type { IgrisSnapshot } from '../../store/igrisStore';
import type { PlantId, TreatmentId } from '../../types/domain';
import type { SceneData, SceneValue } from './PlantScene';

const sv = (value: number | null, type: keyof typeof VARIABLE_META): SceneValue => ({
  value,
  unit: VARIABLE_META[type].unit,
  decimals: VARIABLE_META[type].decimals,
});

/** Valores que muestra la planta 3D: de una planta concreta o la media de su tratamiento. */
export function sceneDataFor(s: IgrisSnapshot, tr: TreatmentId, plant: PlantId | null): SceneData {
  const env = {
    airTemp: SENSOR_AVAILABILITY.air_temperature ? sv(currentValue(s, SENSOR_IDS.airTemp).value, 'air_temperature') : undefined,
    airHumidity: SENSOR_AVAILABILITY.air_humidity ? sv(currentValue(s, SENSOR_IDS.airHum).value, 'air_humidity') : undefined,
    co2: SENSOR_AVAILABILITY.co2 ? sv(currentValue(s, SENSOR_IDS.co2).value, 'co2') : undefined,
    par: SENSOR_AVAILABILITY.par ? sv(currentValue(s, SENSOR_IDS.par).value, 'par') : undefined,
  };
  if (plant) {
    const pn = plantNow(s, plant);
    return {
      moistureUpper: sv(pn.upper.value, 'soil_moisture'),
      moistureLower: sv(pn.lower.value, 'soil_moisture'),
      soilTemp: SENSOR_AVAILABILITY.soil_temperature ? sv(pn.soilTemp.value, 'soil_temperature') : undefined,
      ...env,
      scopeLabel: `planta ${plant}`,
    };
  }
  const plants = plantsOf(s, tr);
  const up = moistureStats(s, plants, 'upper');
  const lo = moistureStats(s, plants, 'lower');
  const st = describe(plants.map((p) => currentValue(s, SENSOR_IDS.soilTemp(p)).value));
  return {
    moistureUpper: sv(up.mean, 'soil_moisture'),
    moistureLower: sv(lo.mean, 'soil_moisture'),
    soilTemp: SENSOR_AVAILABILITY.soil_temperature ? sv(st.mean, 'soil_temperature') : undefined,
    ...env,
    scopeLabel: `media ${tr} · n=${Math.min(up.n, lo.n)}`,
  };
}
