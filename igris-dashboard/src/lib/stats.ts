/** Estadística descriptiva. Todas las funciones ignoran null/NaN y reportan n efectivo. */

export interface Descriptive {
  mean: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
  /** Número de valores válidos usados. */
  n: number;
}

export function describe(values: (number | null | undefined)[]): Descriptive {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  const n = v.length;
  if (n === 0) return { mean: null, sd: null, min: null, max: null, n: 0 };
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null;
  return { mean, sd, min: Math.min(...v), max: Math.max(...v), n };
}

/** Pendiente por mínimos cuadrados (unidades por hora). Requiere ≥ 3 puntos. */
export function slopePerHour(points: { t: number; v: number | null }[]): number | null {
  const p = points.filter((x): x is { t: number; v: number } => x.v !== null);
  if (p.length < 3) return null;
  const t0 = p[0].t;
  const xs = p.map((x) => (x.t - t0) / 3_600_000);
  const ys = p.map((x) => x.v);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

export function fmt(v: number | null | undefined, decimals = 1): string {
  return v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(decimals);
}
