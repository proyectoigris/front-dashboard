/**
 * Estadística multivariada ligera (sin dependencias, funciona offline en la Pi):
 * correlación de Pearson, autovalores de matrices simétricas (Jacobi), PCA,
 * distancia de Bray-Curtis y PCoA (escalamiento multidimensional clásico).
 */

/** Pearson con pares completos. Devuelve r y n efectivo. */
export function pearson(x: (number | null)[], y: (number | null)[]): { r: number | null; n: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const a = x[i];
    const b = y[i];
    if (a !== null && b !== null && Number.isFinite(a) && Number.isFinite(b)) {
      xs.push(a);
      ys.push(b);
    }
  }
  const n = xs.length;
  if (n < 3) return { r: null, n };
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return { r: sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy), n };
}

/** Recta de mínimos cuadrados y = a + b·x (pares completos). */
export function linearFit(x: (number | null)[], y: (number | null)[]): { a: number; b: number } | null {
  const p = x.map((v, i) => [v, y[i]] as const).filter((q): q is readonly [number, number] => q[0] !== null && q[1] !== null);
  if (p.length < 3) return null;
  const mx = p.reduce((s, q) => s + q[0], 0) / p.length;
  const my = p.reduce((s, q) => s + q[1], 0) / p.length;
  const sxx = p.reduce((s, q) => s + (q[0] - mx) ** 2, 0);
  if (sxx === 0) return null;
  const b = p.reduce((s, q) => s + (q[0] - mx) * (q[1] - my), 0) / sxx;
  return { a: my - b * mx, b };
}

/** Autovalores/vectores de una matriz simétrica (método de Jacobi). Orden descendente. */
export function symmetricEigen(A: number[][]): { values: number[]; vectors: number[][] } {
  const n = A.length;
  const a = A.map((r) => [...r]);
  const v: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] ** 2;
    if (off < 1e-18) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const order = a.map((_, i) => i).sort((i, j) => a[j][j] - a[i][i]);
  return { values: order.map((i) => a[i][i]), vectors: order.map((i) => v.map((row) => row[i])) };
}

export interface Ordination {
  /** Coordenadas (filas = observaciones) en los dos primeros ejes. */
  coords: [number, number][];
  /** % de variación explicada por eje 1 y 2. */
  explained: [number, number];
  /** Solo PCA: cargas de cada variable en PC1 y PC2. */
  loadings?: [number, number][];
}

/** PCA sobre variables estandarizadas (matriz de correlación). Filas con datos faltantes se imputan con la media. */
export function pca(rows: (number | null)[][]): Ordination {
  const p = rows[0]?.length ?? 0;
  const means = Array.from({ length: p }, (_, j) => {
    const v = rows.map((r) => r[j]).filter((x): x is number => x !== null);
    return v.reduce((s, x) => s + x, 0) / (v.length || 1);
  });
  const sds = Array.from({ length: p }, (_, j) => {
    const v = rows.map((r) => r[j]).filter((x): x is number => x !== null);
    const sd = Math.sqrt(v.reduce((s, x) => s + (x - means[j]) ** 2, 0) / Math.max(1, v.length - 1));
    return sd || 1;
  });
  const Z = rows.map((r) => r.map((x, j) => ((x ?? means[j]) - means[j]) / sds[j]));
  const n = Z.length;
  const C = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => Z.reduce((s, r) => s + r[i] * r[j], 0) / Math.max(1, n - 1)));
  const { values, vectors } = symmetricEigen(C);
  const total = values.reduce((s, v) => s + Math.max(0, v), 0) || 1;
  const coords = Z.map((r) => [r.reduce((s, x, j) => s + x * vectors[0][j], 0), r.reduce((s, x, j) => s + x * vectors[1][j], 0)] as [number, number]);
  const loadings = Array.from({ length: p }, (_, j) => [vectors[0][j] * Math.sqrt(Math.max(0, values[0])), vectors[1][j] * Math.sqrt(Math.max(0, values[1]))] as [number, number]);
  return { coords, explained: [(values[0] / total) * 100, (values[1] / total) * 100], loadings };
}

/** Disimilitud de Bray-Curtis entre dos perfiles de abundancia. */
export function brayCurtis(a: number[], b: number[]): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < a.length; i++) {
    num += Math.abs(a[i] - b[i]);
    den += a[i] + b[i];
  }
  return den === 0 ? 0 : num / den;
}

/** PCoA (MDS clásico) a partir de una matriz de distancias. */
export function pcoa(D: number[][]): Ordination {
  const n = D.length;
  const A = D.map((r) => r.map((d) => -0.5 * d * d));
  const rowMean = A.map((r) => r.reduce((s, v) => s + v, 0) / n);
  const grand = rowMean.reduce((s, v) => s + v, 0) / n;
  const B = A.map((r, i) => r.map((v, j) => v - rowMean[i] - rowMean[j] + grand));
  const { values, vectors } = symmetricEigen(B);
  const pos = values.filter((v) => v > 0);
  const total = pos.reduce((s, v) => s + v, 0) || 1;
  const s1 = Math.sqrt(Math.max(0, values[0]));
  const s2 = Math.sqrt(Math.max(0, values[1]));
  return {
    coords: Array.from({ length: n }, (_, i) => [vectors[0][i] * s1, vectors[1][i] * s2] as [number, number]),
    explained: [(Math.max(0, values[0]) / total) * 100, (Math.max(0, values[1]) / total) * 100],
  };
}
