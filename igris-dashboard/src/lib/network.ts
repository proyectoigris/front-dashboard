/**
 * Redes de coocurrencia: correlación de Spearman entre taxones a través de las
 * muestras, aristas para |ρ| ≥ umbral, y disposición por fuerzas
 * (Fruchterman-Reingold determinista, sin dependencias).
 */
import { pearson } from './multivariate';

function ranks(v: number[]): number[] {
  const idx = v.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const r = new Array<number>(v.length);
  for (let k = 0; k < idx.length; ) {
    let j = k;
    while (j + 1 < idx.length && idx[j + 1].x === idx[k].x) j++;
    const avg = (k + j) / 2 + 1; // empates → rango promedio
    for (let m = k; m <= j; m++) r[idx[m].i] = avg;
    k = j + 1;
  }
  return r;
}

export function spearman(a: number[], b: number[]): number | null {
  return pearson(ranks(a), ranks(b)).r;
}

export interface NetEdge {
  a: number;
  b: number;
  rho: number;
}

/** Matriz de correlación de Spearman entre columnas (taxones) de `matrix` (filas = muestras). */
export function spearmanMatrix(matrix: number[][]): (number | null)[][] {
  const p = matrix[0]?.length ?? 0;
  const cols = Array.from({ length: p }, (_, j) => matrix.map((r) => r[j]));
  return cols.map((a, i) => cols.map((b, j) => (i === j ? 1 : spearman(a, b))));
}

export function edgesFrom(R: (number | null)[][], threshold: number, sign: 'all' | 'pos' | 'neg'): NetEdge[] {
  const out: NetEdge[] = [];
  for (let i = 0; i < R.length; i++)
    for (let j = i + 1; j < R.length; j++) {
      const r = R[i][j];
      if (r === null || Math.abs(r) < threshold) continue;
      if (sign === 'pos' && r < 0) continue;
      if (sign === 'neg' && r > 0) continue;
      out.push({ a: i, b: j, rho: r });
    }
  return out;
}

/** Fruchterman-Reingold en [0,1]². Nodos aislados quedan en un anillo exterior. */
export function forceLayout(n: number, edges: NetEdge[], iterations = 400): [number, number][] {
  const pos: [number, number][] = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [0.5 + 0.35 * Math.cos(a), 0.5 + 0.35 * Math.sin(a)];
  });
  const k = Math.sqrt(1 / Math.max(1, n)) * 0.9;
  let temp = 0.1;
  for (let it = 0; it < iterations; it++) {
    const disp = pos.map(() => [0, 0]);
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i][0] - pos[j][0];
        const dy = pos[i][1] - pos[j][1];
        const d = Math.max(1e-3, Math.hypot(dx, dy));
        const f = (k * k) / d;
        disp[i][0] += (dx / d) * f;
        disp[i][1] += (dy / d) * f;
        disp[j][0] -= (dx / d) * f;
        disp[j][1] -= (dy / d) * f;
      }
    for (const e of edges) {
      const dx = pos[e.a][0] - pos[e.b][0];
      const dy = pos[e.a][1] - pos[e.b][1];
      const d = Math.max(1e-3, Math.hypot(dx, dy));
      const f = ((d * d) / k) * Math.abs(e.rho);
      disp[e.a][0] -= (dx / d) * f;
      disp[e.a][1] -= (dy / d) * f;
      disp[e.b][0] += (dx / d) * f;
      disp[e.b][1] += (dy / d) * f;
    }
    for (let i = 0; i < n; i++) {
      // Gravedad suave hacia el centro para que la red no se disperse.
      disp[i][0] += (0.5 - pos[i][0]) * 0.02;
      disp[i][1] += (0.5 - pos[i][1]) * 0.02;
      const dl = Math.max(1e-6, Math.hypot(disp[i][0], disp[i][1]));
      pos[i][0] = Math.min(0.97, Math.max(0.03, pos[i][0] + (disp[i][0] / dl) * Math.min(dl, temp)));
      pos[i][1] = Math.min(0.86, Math.max(0.06, pos[i][1] + (disp[i][1] / dl) * Math.min(dl, temp)));
    }
    temp *= 0.985;
  }
  return pos;
}
