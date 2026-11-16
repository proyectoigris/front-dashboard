/**
 * Genera src/data/bio/bioDemo.json: datos biológicos de DEMOSTRACIÓN para IGRIS
 * a partir de datasets externos (no son mediciones de nuestras plantas).
 *
 * Uso:
 *   node scripts/build-bio-demo.cjs <metaproteomica.xlsx> <ASVs_counts.csv> <ASVs_taxonomy.csv>
 * Requiere el paquete `xlsx` (SheetJS) disponible para Node.
 *
 * Correspondencia usada (documentada en el JSON):
 *  - Proteínas de hoja (Lolium, metaproteómica): suelo S2 (P+ Al−) ≈ riego normal; S1 (P− Al+, estresante)
 *    ≈ déficit hídrico; b/B ≈ sin/con inoculación; todos con fósforo (P).
 *    T1=S2·P·b, T2=S2·P·B, T3=S1·P·b, T4=S1·P·B. Día 0 = línea base S2·p·b (réplica rotada por tratamiento),
 *    día 30 = abundancia de la condición, día 15 = media geométrica de ambos.
 *  - Microbioma de raíz (16S, 12 muestras LOM): perfiles por tratamiento y día como mezclas de las
 *    muestras con más lecturas; día 0 cercano a una línea base común. En T2/T4 se añade Bradyrhizobium
 *    (cepa inoculada, demo) desde el día 15.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const [xlsxPath, countsPath, taxPath] = process.argv.slice(2);
if (!taxPath) {
  console.error('Uso: node scripts/build-bio-demo.cjs <metaproteomica.xlsx> <counts.csv> <taxonomy.csv>');
  process.exit(1);
}
const OUT = path.join(__dirname, '..', 'src', 'data', 'bio', 'bioDemo.json');
const TREATMENTS = ['T1', 'T2', 'T3', 'T4'];
const DAYS = [0, 15, 30];
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// ---------------- Microbioma ----------------
const readCsv = (p) =>
  fs.readFileSync(p, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/).map((l) => l.split(';'));
const counts = readCsv(countsPath);
const samples = counts[0].slice(1);
const asvCounts = new Map(counts.slice(1).map((r) => [r[0], r.slice(1).map(Number)]));
const tax = new Map(readCsv(taxPath).slice(1).map((r) => [r[0], r.slice(1)]));

const clean = (s) => (s && s !== 'NA' ? s.replace(/^Candidatus_/, 'Ca. ').replace(/_/g, ' ') : null);
function labelFor(asv) {
  const [kingdom, phylum, cls, order, family, genus] = tax.get(asv) ?? [];
  const g = clean(genus);
  const name = g ?? (clean(family) ? `${clean(family)} (fam.)` : clean(order) ? `${clean(order)} (orden)` : clean(cls) ? `${clean(cls)} (clase)` : 'Sin asignar');
  return { phylum: clean(phylum) ?? 'Sin asignar', genus: name, kingdom: kingdom ?? 'NA' };
}

const totals = samples.map((_, i) => [...asvCounts.values()].reduce((a, v) => a + v[i], 0));
const rich = samples.map((s, i) => ({ s, i, n: totals[i] })).filter((x) => x.n >= 1000);
const relOf = (i) => {
  const m = new Map();
  for (const [asv, v] of asvCounts) if (v[i] > 0) m.set(asv, v[i] / totals[i]);
  return m;
};
const mix = (parts) => {
  const m = new Map();
  for (const [w, prof] of parts) for (const [k, v] of prof) m.set(k, (m.get(k) ?? 0) + w * v);
  const sum = [...m.values()].reduce((a, b) => a + b, 0);
  for (const [k, v] of m) m.set(k, v / sum);
  return m;
};
const richProfiles = rich.map((r) => relOf(r.i));
const baseline = mix(richProfiles.map((p) => [1 / richProfiles.length, p]));
const pick = (name) => relOf(samples.indexOf(name));
// Perfil "destino" de cada tratamiento (al día 30), elegido entre las muestras ricas.
const target = {
  T1: mix([[1, pick('LOM_105')]]),
  T2: mix([[1, pick('LOM_108')]]),
  T3: mix([[1, pick('LOM_102')]]),
  T4: mix([[0.5, pick('LOM_106')], [0.5, pick('LOM_107')]]),
};
const W = { 0: 0.15, 15: 0.5, 30: 0.85 }; // peso del perfil destino
const INOC = { 0: 0, 15: 0.035, 30: 0.06 }; // fracción de Bradyrhizobium inoculado
const INOC_ASV = [...tax.entries()].find(([, t]) => t[5] === 'Bradyrhizobium')?.[0] ?? null;

function summarize(prof, level) {
  const agg = new Map();
  for (const [asv, v] of prof) {
    const k = labelFor(asv)[level];
    agg.set(k, (agg.get(k) ?? 0) + v);
  }
  return agg;
}
function shannon(prof) {
  let h = 0;
  for (const v of prof.values()) if (v > 0) h -= v * Math.log(v);
  return h;
}

const microbiome = {};
const allGenus = new Map();
const allPhylum = new Map();
for (const t of TREATMENTS) {
  microbiome[t] = {};
  for (const d of DAYS) {
    let prof = mix([[1 - W[d], baseline], [W[d], target[t]]]);
    if ((t === 'T2' || t === 'T4') && INOC_ASV && INOC[d] > 0) prof = mix([[1 - INOC[d], prof], [INOC[d], new Map([[INOC_ASV, 1]])]]);
    // Riqueza: ASVs con abundancia relativa > 0,05 % (umbral de detección simulado)
    const richness = [...prof.values()].filter((v) => v > 0.0005).length;
    const g = summarize(prof, 'genus');
    const p = summarize(prof, 'phylum');
    for (const [k, v] of g) allGenus.set(k, (allGenus.get(k) ?? 0) + v);
    for (const [k, v] of p) allPhylum.set(k, (allPhylum.get(k) ?? 0) + v);
    microbiome[t][d] = { g, p, prof, shannon: round(shannon(prof), 2), richness };
  }
}
const topGenus = [...allGenus.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k);
if (INOC_ASV && !topGenus.includes('Bradyrhizobium')) topGenus[topGenus.length - 1] = 'Bradyrhizobium';
const topPhylum = [...allPhylum.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k]) => k);
const toList = (agg, keep) => {
  const out = keep.map((k) => ({ taxon: k, pct: round((agg.get(k) ?? 0) * 100, 2) }));
  const other = 100 - out.reduce((a, x) => a + x.pct, 0);
  out.push({ taxon: 'Otros', pct: round(Math.max(0, other), 2) });
  return out;
};
const phylumOf = new Map();
for (const asv of tax.keys()) {
  const l = labelFor(asv);
  if (!phylumOf.has(l.genus)) phylumOf.set(l.genus, l.phylum);
}
const microbiomeOut = {};
for (const t of TREATMENTS) {
  microbiomeOut[t] = {};
  for (const d of DAYS) {
    const m = microbiome[t][d];
    microbiomeOut[t][d] = { genus: toList(m.g, topGenus), phylum: toList(m.p, topPhylum), shannon: m.shannon, richness: m.richness };
  }
}


// ---------------- Red de coocurrencia ----------------
// Abundancia (%) de los 30 géneros más abundantes en las 12 muestras (4 tratamientos × 3 días).
// Se añade variación biológica multiplicativa (log-normal, σ = 0,35, semilla fija) para que
// la correlación entre géneros no sea solo el reflejo de la mezcla de perfiles.
const NET_N = 30;
const netTaxa = [...allGenus.entries()].filter(([k]) => k !== 'Sin asignar').sort((a, b) => b[1] - a[1]).slice(0, NET_N).map(([k]) => k);
let seed = 20261027;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
const netSamples = [];
const netMatrix = [];
for (const t of TREATMENTS) {
  for (const d of DAYS) {
    const g = microbiome[t][d].g;
    netSamples.push({ id: `${t}-d${d}`, treatment: t, day: d });
    netMatrix.push(netTaxa.map((k) => round((g.get(k) ?? 0) * 100 * Math.exp(0.35 * gauss()), 4)));
  }
}
const network = {
  method: 'Abundancia relativa por género; correlación de Spearman entre géneros a través de 12 muestras (demo).',
  taxa: netTaxa.map((k) => ({ taxon: k, phylum: phylumOf.get(k) ?? 'Sin asignar' })),
  samples: netSamples,
  matrix: netMatrix,
};

// ---------------- Composición por género (formato publicación: "p. Filo g. Género") ----------------
// 20 géneros identificados más abundantes + "Less abundant genus" (resto de géneros identificados)
// + "Not identified genus" (ASV sin asignación a nivel de género).
const realGenus = (asv) => {
  const t = tax.get(asv) ?? [];
  return t[5] && t[5] !== 'NA' ? { genus: clean(t[5]), phylum: clean(t[1]) ?? 'Sin asignar' } : null;
};
const compAll = new Map();
for (const t of TREATMENTS)
  for (const d of DAYS)
    for (const [asv, v] of microbiome[t][d].prof) {
      const rg = realGenus(asv);
      if (!rg) continue;
      const k = `${rg.phylum}|${rg.genus}`;
      compAll.set(k, (compAll.get(k) ?? 0) + v);
    }
const COMP_N = 20;
const compKeys = [...compAll.entries()].sort((a, b) => b[1] - a[1]).slice(0, COMP_N).map(([k]) => k);
const composition = {
  taxa: compKeys.map((k) => {
    const [phylum, genus] = k.split('|');
    return { phylum, genus };
  }),
  samples: [],
};
for (const t of TREATMENTS)
  for (const d of DAYS) {
    const vals = new Array(compKeys.length).fill(0);
    let less = 0;
    let notId = 0;
    for (const [asv, v] of microbiome[t][d].prof) {
      const rg = realGenus(asv);
      if (!rg) {
        notId += v;
        continue;
      }
      const i = compKeys.indexOf(`${rg.phylum}|${rg.genus}`);
      if (i >= 0) vals[i] += v;
      else less += v;
    }
    composition.samples.push({ id: `${t}-d${d}`, treatment: t, day: d, values: vals.map((v) => round(v * 100, 3)), less: round(less * 100, 3), notIdentified: round(notId * 100, 3) });
  }
// ---------------- Proteínas ----------------
const wb = XLSX.readFile(xlsxPath);
const bulk = XLSX.utils.sheet_to_json(wb.Sheets['Bulk data'], { defval: null });
// Clasificación funcional de las hojas de comparación (nombre → categoría)
const classByName = new Map();
for (const n of wb.SheetNames) {
  if (!/^S\d/.test(n)) continue;
  for (const r of XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: null })) {
    const key = Object.keys(r).find((k) => /^clasifica/i.test(k.trim()));
    if (r.ProteinName && key && r[key]) classByName.set(r.ProteinName, String(r[key]).trim());
  }
}
const CATS = [
  ['Fotosíntesis', /photosystem|chlorophyll|oxygen-evolving|rubisco|ribulose|plastocyanin|ferredoxin|fotosistema|light-harvesting|cytochrome b6/i],
  ['Estrés oxidativo', /catalase|peroxid|superoxide|glutathione|ascorbate|thioredoxin|oxidativ/i],
  ['Estrés y choque térmico', /heat shock|chaperon|estr[eé]s y|choque/i],
  ['Defensa contra patógenos', /pathogenesis|chitinase|thaumatin|germin|defensin|trypsin inhibitor|defensa/i],
  ['Proteínas ribosomales', /ribosom/i],
  ['Energía (ATP)', /atp synthase|sintesis de atp/i],
  ['Metabolismo de carbohidratos', /glyceraldehyde|aldolase|phosphoglycer|enolase|sucrose|fructose|transketolase|carbohidrat|glycolate|malate/i],
  ['Metabolismo de aminoácidos', /amino|glutamine|methionine|aminoacid/i],
  ['Metabolismo de lípidos', /lipid|lipoxygenase|fatty|lipidos/i],
  ['Proteosoma', /proteasome|proteosoma/i],
  ['Señalización y desarrollo', /14-3-3|signal|señalizaci/i],
];
const category = (name) => {
  const txt = `${classByName.get(name) ?? ''} ${name}`;
  for (const [c, re] of CATS) if (re.test(txt)) return c;
  return 'Otras funciones';
};
const shortName = (n) =>
  String(n)
    .replace(/\s*\(EC [^)]*\)/g, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/,\s*chloroplastic/i, ' (cloroplasto)')
    .replace(/,\s*mitochondrial/i, ' (mitocondria)')
    .trim();

const COND = { T1: 'S2Pb', T2: 'S2PB', T3: 'S1Pb', T4: 'S1PB' };
const BASE_REPS = ['S2pb_R1', 'S2pb_R2', 'S2pb_R3', 'S2pb_R1'];
const proteins = bulk
  .filter((r) => r.ProteinName && typeof r.S2pb_abun === 'number')
  .map((r) => {
    const v = {};
    TREATMENTS.forEach((t, i) => {
      const d0 = Number(r[BASE_REPS[i]] ?? r.S2pb_abun) || 0;
      const d30 = Number(r[`${COND[t]}_abun`]) || 0;
      v[t] = { 0: d0, 15: d0 > 0 && d30 > 0 ? Math.sqrt(d0 * d30) : (d0 + d30) / 2, 30: d30 };
    });
    return { name: String(r.ProteinName), short: shortName(r.ProteinName), uniprot: r.SwissProtID, cat: category(r.ProteinName), v };
  });
// Abundancia relativa (% de la señal total) por tratamiento y día
const totalsP = {};
for (const t of TREATMENTS) for (const d of DAYS) totalsP[`${t}${d}`] = proteins.reduce((a, p) => a + p.v[t][d], 0);
const rel = (p, t, d) => (p.v[t][d] / totalsP[`${t}${d}`]) * 100;

// Proteínas a incluir: las 40 más abundantes en promedio + las que más cambian (|log2FC| día 30 vs 0).
const meanRel = (p) => TREATMENTS.reduce((a, t) => a + DAYS.reduce((b, d) => b + rel(p, t, d), 0), 0) / 12;
const lfc = (p, t) => Math.log2((rel(p, t, 30) + 1e-4) / (rel(p, t, 0) + 1e-4));
const byAbun = [...proteins].sort((a, b) => meanRel(b) - meanRel(a)).slice(0, 40);
const byChange = [...proteins]
  .filter((p) => meanRel(p) > 0.02)
  .sort((a, b) => Math.max(...TREATMENTS.map((t) => Math.abs(lfc(b, t)))) - Math.max(...TREATMENTS.map((t) => Math.abs(lfc(a, t)))))
  .slice(0, 20);
const chosen = [...new Map([...byAbun, ...byChange].map((p) => [p.name, p])).values()];

const proteinsOut = chosen.map((p) => ({
  name: p.short,
  fullName: p.name,
  uniprot: p.uniprot,
  category: p.cat,
  pct: Object.fromEntries(TREATMENTS.map((t) => [t, Object.fromEntries(DAYS.map((d) => [d, round(rel(p, t, d), 3)]))])),
}));
// Resumen por categoría funcional (sobre TODAS las proteínas)
const categories = {};
for (const t of TREATMENTS) {
  categories[t] = {};
  for (const d of DAYS) {
    const agg = new Map();
    for (const p of proteins) agg.set(p.cat, (agg.get(p.cat) ?? 0) + rel(p, t, d));
    categories[t][d] = [...agg.entries()].map(([c, v]) => ({ category: c, pct: round(v, 2) })).sort((a, b) => b.pct - a.pct);
  }
}

// ---------------- Estadística de proteínas: volcán y mapa de calor ----------------
// Volcán (día 30 vs día 0) por tratamiento con las 3 RÉPLICAS reales del Excel:
//   día 0 = S2pb_R1..R3 · día 30 = <condición>_R1..R3. Abundancias normalizadas por la señal total
//   de cada réplica, log2, t de Welch bilateral y corrección de Benjamini-Hochberg (q).
function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}
function betacf(a, b, x) {
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}
function ibeta(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}
/** p bilateral de la t de Welch. */
function welch(a, b) {
  const m = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  const vr = (v, mu) => v.reduce((s, x) => s + (x - mu) ** 2, 0) / (v.length - 1);
  const ma = m(a), mb = m(b), va = vr(a, ma) / a.length, vb = vr(b, mb) / b.length;
  const se2 = va + vb;
  if (se2 <= 0) return { diff: mb - ma, p: 1 };
  const t = (mb - ma) / Math.sqrt(se2);
  const df = (se2 * se2) / ((va * va) / (a.length - 1) + (vb * vb) / (b.length - 1));
  return { diff: mb - ma, p: Math.min(1, ibeta(df / 2, 0.5, df / (df + t * t))) };
}
function bh(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]);
  const q = new Array(ps.length);
  let prev = 1;
  for (let k = idx.length - 1; k >= 0; k--) {
    prev = Math.min(prev, (idx[k][0] * idx.length) / (k + 1));
    q[idx[k][1]] = prev;
  }
  return q;
}
const BASE_COLS = ['S2pb_R1', 'S2pb_R2', 'S2pb_R3'];
const repCols = (t) => [1, 2, 3].map((i) => `${COND[t]}_R${i}`);
const allCols = [...new Set([...BASE_COLS, ...TREATMENTS.flatMap(repCols)])];
const validRows = bulk.filter((r) => r.ProteinName && allCols.every((c) => typeof r[c] === 'number'));
const colTotal = Object.fromEntries(allCols.map((c) => [c, validRows.reduce((s, r) => s + r[c], 0)]));
const l2 = (r, c) => Math.log2((r[c] / colTotal[c]) * 1e6 + 1); // log2(ppm + 1)
const vProteins = validRows.map((r) => ({ name: shortName(r.ProteinName), category: category(r.ProteinName), uniprot: r.SwissProtID }));
const volcano = {};
for (const t of TREATMENTS) {
  const res = validRows.map((r) => welch(BASE_COLS.map((c) => l2(r, c)), repCols(t).map((c) => l2(r, c))));
  const q = bh(res.map((x) => x.p));
  volcano[t] = res.map((x, i) => [round(x.diff, 3), Number(x.p.toPrecision(3)), Number(q[i].toPrecision(3))]);
}
// Mapa de calor: 30 proteínas más variables entre las 12 muestras (log2 % relativo), valor z por fila.
const hmSamples = TREATMENTS.flatMap((t) => DAYS.map((d) => ({ id: `${t}-d${d}`, treatment: t, day: d })));
const hmCandidates = proteins
  .filter((p) => meanRel(p) > 0.02)
  .map((p) => {
    const v = hmSamples.map((s) => Math.log2(rel(p, s.treatment, s.day) + 1e-3));
    const mu = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / (v.length - 1));
    return { p, v, mu, sd };
  })
  .sort((a, b) => b.sd - a.sd)
  .slice(0, 30)
  .map((x) => ({ name: x.p.short, category: x.p.cat, z: x.v.map((y) => round(x.sd ? (y - x.mu) / x.sd : 0, 2)) }));
// Orden de filas: por patrón temporal (z medio día 30 − día 0) para agrupar respuestas parecidas.
const d30i = hmSamples.map((s, i) => (s.day === 30 ? i : -1)).filter((i) => i >= 0);
const d0i = hmSamples.map((s, i) => (s.day === 0 ? i : -1)).filter((i) => i >= 0);
const trendOf = (r) => d30i.reduce((a, i) => a + r.z[i], 0) / d30i.length - d0i.reduce((a, i) => a + r.z[i], 0) / d0i.length;
const heatmap = { samples: hmSamples, rows: hmCandidates.sort((a, b) => trendOf(b) - trendOf(a)) };
const out = {
  origin: 'simulated',
  generatedAt: new Date().toISOString(),
  disclaimer:
    'DATOS DE DEMOSTRACIÓN. Derivados de datasets externos (metaproteómica de hojas de Lolium y metabarcoding 16S de suelo, 2020) reasignados a los tratamientos de IGRIS. No son mediciones de las plantas del experimento.',
  sources: {
    proteins: path.basename(xlsxPath),
    microbiome: [path.basename(countsPath), path.basename(taxPath)],
  },
  mapping: {
    proteins: 'T1=S2·P·b, T2=S2·P·B, T3=S1·P·b, T4=S1·P·B (S1 estresante ≈ déficit hídrico; B ≈ inoculación). Día 0 = línea base S2·p·b; día 15 = media geométrica; día 30 = condición.',
    microbiome: `Perfiles por mezcla de muestras con ≥1000 lecturas (${rich.map((r) => r.s).join(', ')}). Día 0 ≈ línea base común; en T2/T4 se añade Bradyrhizobium como cepa inoculada (demo).`,
  },
  days: DAYS,
  microbiome: { level: ['genus', 'phylum'], inoculant: INOC_ASV ? 'Bradyrhizobium' : null, phylumOfGenus: Object.fromEntries(topGenus.map((g) => [g, phylumOf.get(g) ?? ''])), data: microbiomeOut, network, composition },
  proteins: {
    unit: '% de la abundancia proteica total',
    list: proteinsOut,
    categories,
    volcano: { method: 'Día 30 vs día 0 · log2(ppm+1) · t de Welch bilateral (3 vs 3 réplicas) · BH', proteins: vProteins, results: volcano },
    heatmap,
  },
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('OK', OUT);
console.log('muestras ricas:', rich.map((r) => `${r.s}(${r.n})`).join(' '));
console.log('géneros top:', topGenus.join(' | '));
console.log('filos top:', topPhylum.join(' | '));
console.log('proteínas incluidas:', proteinsOut.length);
console.log('T2 d30 géneros:', JSON.stringify(microbiomeOut.T2[30].genus));
console.log('T1 d0 categorías:', JSON.stringify(categories.T1[0].slice(0, 6)));
