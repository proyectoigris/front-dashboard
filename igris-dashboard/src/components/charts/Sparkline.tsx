/**
 * Mini gráficos en SVG puro (sin Recharts): baratos de redibujar cada 5 s en la Raspberry Pi.
 * Una sola serie → un solo color; el último punto se marca para leer "ahora".
 */

export function Sparkline({ values, color, label }: { values: (number | null)[]; color: string; label?: string }) {
  const pts = values.map((v, i) => ({ i, v })).filter((p): p is { i: number; v: number } => p.v !== null);
  if (pts.length < 2) return <div className="h-full" />;
  const W = 100;
  const H = 40;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * W;
  // Con leyenda, la línea usa solo la parte superior: la leyenda va abajo, dentro del gráfico, sin tocar la línea.
  const padBottom = label ? 13 : 3;
  const y = (v: number) => H - padBottom - ((v - min) / span) * (H - padBottom - 3);
  const line = pts.map((p) => `${x(p.i).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ');
  const area = `0,${H} ${line} ${x(pts[pts.length - 1].i).toFixed(2)},${H}`;
  const last = pts[pts.length - 1];
  return (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
        <polygon points={area} fill={color} opacity={0.12} />
        <polyline points={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <span
        className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
        style={{ left: `${(x(last.i) / W) * 100}%`, top: `${(y(last.v) / H) * 100}%`, background: color }}
      />
      {label && <span className="absolute bottom-0.5 left-1 text-[10px] leading-none text-ink-3">{label}</span>}
    </div>
  );
}

/** Barras verticales mini (p. ej. una por planta). */
export function MiniBars({ bars, max, label }: { bars: { value: number | null; color: string; title: string }[]; max: number; label?: string }) {
  return (
    <div className="relative flex h-full w-full items-end gap-[3px] pt-3">
      {bars.map((b) => (
        <span
          key={b.title}
          title={`${b.title}: ${b.value === null ? 'sin datos' : b.value.toFixed(1)}`}
          className="min-w-0 flex-1 rounded-t-sm"
          style={{ height: b.value === null ? '6%' : `${Math.max(6, (b.value / max) * 100)}%`, background: b.value === null ? '#c7d3c0' : b.color }}
        />
      ))}
      {label && <span className="absolute top-0 left-0 text-[10px] text-ink-3">{label}</span>}
    </div>
  );
}

/**
 * Semáforo circular de alertas: el anillo tiene un segmento por sensor (verde = bien,
 * rojo = con alerta) y el centro pasa de verde a rojo con cada alerta activa
 * (cada alerta suma 20 %; con 5 o más queda rojo pleno).
 */
export function AlertRing({ alerts, sensorsOk, sensorsAlert }: { alerts: number; sensorsOk: number; sensorsAlert: number }) {
  const GREEN = [56, 166, 107];
  const RED = [208, 59, 59];
  const k = Math.min(1, alerts * 0.2);
  const center = `rgb(${GREEN.map((g, i) => Math.round(g + (RED[i] - g) * k)).join(',')})`;
  const total = Math.max(1, sensorsOk + sensorsAlert);
  const R = 42;
  const C = 2 * Math.PI * R;
  const gap = total > 1 ? 1.2 : 0;
  const seg = C / total;
  return (
    <div className="flex h-full items-center gap-4">
      <svg viewBox="0 0 100 100" className="aspect-square h-full max-h-[96px] shrink-0 -rotate-90">
        {Array.from({ length: total }, (_, i) => (
          <circle
            key={i}
            cx={50}
            cy={50}
            r={R}
            fill="none"
            stroke={i < sensorsAlert ? '#d03b3b' : '#38a66b'}
            strokeWidth={9}
            strokeDasharray={`${Math.max(0.5, seg - gap)} ${C}`}
            strokeDashoffset={-i * seg}
          />
        ))}
        <circle cx={50} cy={50} r={31} fill={center} />
        <text x={50} y={50} dy={7} textAnchor="middle" fontSize={22} fontWeight={700} fill="#ffffff" transform="rotate(90 50 50)">
          {alerts}
        </text>
      </svg>
      <div className="min-w-0 text-xs leading-relaxed">
        <div className="flex items-center gap-2 text-ink-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#38a66b]" />
          {sensorsOk} sensores bien
        </div>
        <div className="flex items-center gap-2 text-ink-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#d03b3b]" />
          {sensorsAlert} con alerta
        </div>
      </div>
    </div>
  );
}
