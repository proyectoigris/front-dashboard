/**
 * La planta 3D del tratamiento seleccionado.
 *  - Panel cerrado: la escena ocupa TODA la pantalla y los textos flotan encima.
 *  - Panel abierto (primer tercio): diseño ordenado en columna — logo y selector arriba,
 *    planta centrada en su propio espacio y botón abajo, sin que nada se superponga.
 * Tocar raíces u hojas abre su biología en el panel derecho.
 */
import { lazy, Suspense, useState } from 'react';
import { TREATMENTS, TREATMENT_IDS } from '../../config/experiment';
import { useSnapshot } from '../../store/igrisStore';
import { useUi } from '../../state/ui';
import { Segmented } from '../common/primitives';
import { ModelBoundary } from '../three/FittedModel';
import type { BioZone, TagKind } from './PlantScene';
import { sceneDataFor } from './useSceneData';

const PlantScene = lazy(() => import('./PlantScene'));

/** Logo original de IGRIS (public/igris/logo.png). Si aún no está, se muestra el nombre. */
function Logo() {
  const [missing, setMissing] = useState(false);
  if (missing)
    return (
      <div>
        <div className="bg-gradient-to-r from-[#a6e07a] via-[#5fd6e6] to-[#7cc3ff] bg-clip-text text-2xl font-bold tracking-[0.22em] text-transparent">IGRIS</div>
        <p className="text-[11px] text-white/85">Intelligent Growth Response &amp; Interaction System</p>
      </div>
    );
  // Logo con fondo transparente y halo: va directo sobre el fondo oscuro.
  // logo-recorte.png es una copia sin márgenes vacíos del original (logo.png).
  return (
    <img
      src="/igris/logo-recorte.png"
      alt="IGRIS"
      draggable={false}
      onError={(e) => {
        const img = e.currentTarget;
        if (!img.src.endsWith('/igris/logo.png')) img.src = '/igris/logo.png';
        else setMissing(true);
      }}
      className="h-24 w-auto object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
    />
  );
}

export function PlantStage() {
  const s = useSnapshot();
  const ui = useUi();
  const compact = ui.panelOpen;
  const tr = ui.treatment;
  const t = TREATMENTS[tr];
  const plant = ui.selectedPlant && s.plantById.get(ui.selectedPlant)?.treatmentId === tr ? ui.selectedPlant : null;
  const zone: BioZone | null = !ui.explorerOpen ? null : ui.section === 'microbiome' ? 'roots' : ui.section === 'proteins' ? 'leaves' : null;

  const openZone = (z: BioZone) => {
    ui.setSection(z === 'roots' ? 'microbiome' : 'proteins');
    ui.setExplorerOpen(true);
  };
  /** Etiqueta tocada: suelo → historial de humedad del tratamiento; aire/luz → sección Ambiente. */
  const openTag = (k: TagKind) => {
    if (k === 'soil') {
      ui.setSection('history');
      ui.setExplorerOpen(true);
    } else {
      ui.setExplorerOpen(false);
      ui.setTab('environment');
    }
  };

  const header = (
    <>
      <header className={`${compact ? 'relative shrink-0' : 'pointer-events-none absolute inset-x-0 top-0 z-10'} flex items-start justify-between gap-4 px-6 pt-5`}>
        <div className="pointer-events-auto">
          <Logo />
        </div>
        <div className="pointer-events-auto">
          <Segmented
            value={tr}
            onChange={(id) => {
              ui.setTreatment(id);
              ui.openPlant(null);
            }}
            options={TREATMENT_IDS.map((id) => ({
              value: id,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: TREATMENTS[id].color }} />
                  {id}
                </span>
              ),
            }))}
          />
        </div>
      </header>
      <div className={`${compact ? 'relative shrink-0 pt-3' : 'pointer-events-none absolute top-[128px] left-0 z-10'} px-6`}>
        <p className="text-sm font-medium text-white">
          {tr} · {t.label}
        </p>
        <p className="text-xs text-white/85">{plant ? `Planta ${plant}` : 'Media del tratamiento'} · datos en vivo</p>
      </div>
    </>
  );

  const analysisButton = (
    <button
      onClick={() => {
        ui.setExplorerOpen(false);
        ui.setTab('analysis');
      }}
      aria-label="Análisis IGRIS"
      aria-pressed={ui.tab === 'analysis' && !ui.explorerOpen}
      className={`img-btn pointer-events-auto block ${ui.tab === 'analysis' && !ui.explorerOpen ? 'img-btn-active' : ''}`}
    >
      <img src="/igris/btn-analisis.png" alt="" draggable={false} className={`${compact ? 'h-[76px]' : 'h-[100px]'} w-auto`} />
    </button>
  );

  return (
    <aside className={`relative h-full min-h-0 overflow-hidden ${compact ? 'flex flex-col' : ''}`}>
      {/* Mismo orden en ambos modos: así la escena 3D no se vuelve a montar al abrir/cerrar el panel. */}
      {header}

      {/* Escena 3D: pantalla completa (panel cerrado) o su propio espacio recortado (panel abierto). */}
      <div
        className={`${compact ? 'relative min-h-0 flex-1 overflow-hidden' : 'absolute inset-0'} bg-[radial-gradient(ellipse_at_50%_48%,rgba(214,245,190,0.30),rgba(120,220,230,0.10)_38%,transparent_65%)]`}
      >
        {s.status === 'ready' && (
          <ModelBoundary fallback={<div className="grid h-full place-items-center text-sm text-white/85">No se pudo mostrar la planta 3D.</div>}>
            <Suspense fallback={<div className="grid h-full place-items-center text-sm text-white/85">Cargando planta 3D…</div>}>
              <PlantScene data={sceneDataFor(s, tr, plant)} accent={t.color} sceneKey={`${tr}-${plant ?? 'mean'}`} zone={zone} onZone={openZone} onTag={openTag} compact={compact} />
            </Suspense>
          </ModelBoundary>
        )}
      </div>

      {compact ? (
        <div className="flex shrink-0 justify-center px-6 pt-2 pb-4">{analysisButton}</div>
      ) : (
        <div className="pointer-events-none absolute bottom-4 left-6 z-10">{analysisButton}</div>
      )}
    </aside>
  );
}
