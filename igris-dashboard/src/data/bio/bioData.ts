/**
 * Datos biológicos (microbioma de raíz y proteínas de hoja) por tratamiento y día.
 * Hoy se cargan desde bioDemo.json (DEMOSTRACIÓN, generado con scripts/build-bio-demo.cjs a
 * partir de datasets externos). Para usar datos reales basta con generar un JSON con la misma
 * forma (o servirlo desde GET /api/bio) y reemplazar la importación.
 */
import type { TreatmentId } from '../../types/domain';
import raw from './bioDemo.json';

export type BioDay = 0 | 15 | 30;
export const BIO_DAYS: BioDay[] = [0, 15, 30];

export interface TaxonShare {
  taxon: string;
  pct: number;
}
export interface MicrobiomeSample {
  genus: TaxonShare[];
  phylum: TaxonShare[];
  shannon: number;
  richness: number;
}
export interface ProteinEntry {
  name: string;
  fullName: string;
  uniprot: string;
  category: string;
  pct: Record<TreatmentId, Record<BioDay, number>>;
}
export interface BioDataset {
  origin: 'simulated' | 'measured';
  disclaimer: string;
  sources: { proteins: string; microbiome: string[] };
  mapping: { proteins: string; microbiome: string };
  microbiome: {
    inoculant: string | null;
    phylumOfGenus: Record<string, string>;
    data: Record<TreatmentId, Record<BioDay, MicrobiomeSample>>;
    /** Abundancias por género y muestra para la red de coocurrencia. */
    network: {
      method: string;
      taxa: { taxon: string; phylum: string }[];
      samples: { id: string; treatment: TreatmentId; day: BioDay }[];
      matrix: number[][];
    };
    /** Composición por género por muestra (formato publicación). */
    composition: {
      taxa: { phylum: string; genus: string }[];
      samples: { id: string; treatment: TreatmentId; day: BioDay; values: number[]; less: number; notIdentified: number }[];
    };
  };
  proteins: {
    unit: string;
    list: ProteinEntry[];
    categories: Record<TreatmentId, Record<BioDay, { category: string; pct: number }[]>>;
    /** Volcán día 30 vs 0: results[T][i] = [log2FC, p, q] para proteins[i]. */
    volcano: {
      method: string;
      proteins: { name: string; category: string; uniprot: string }[];
      results: Record<TreatmentId, [number, number, number][]>;
    };
    heatmap: {
      samples: { id: string; treatment: TreatmentId; day: BioDay }[];
      rows: { name: string; category: string; z: number[] }[];
    };
  };
}

export const BIO = raw as unknown as BioDataset;
