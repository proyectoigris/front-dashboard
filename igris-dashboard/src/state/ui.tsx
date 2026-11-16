import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { RangeKey } from '../lib/analytics';
import type { AvatarState, PlantId, TreatmentId } from '../types/domain';

/** Navegación por secciones: inicio (resumen) → detalle de cada sección. */
export type TabKey = 'home' | 'environment' | 'soil' | 'plants' | 'alerts' | 'analysis';

/** Secciones de la vista de tratamiento (panel derecho). */
export type ExplorerSection = 'history' | 'analysis' | 'microbiome' | 'proteins' | 'biology';

interface UiState {
  /** Panel de datos desplegado. Cerrado: la planta 3D ocupa toda la pantalla. */
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  tab: TabKey;
  setTab: (t: TabKey) => void;
  /** Tratamiento que muestra la planta 3D (primer tercio de la pantalla). */
  treatment: TreatmentId;
  setTreatment: (t: TreatmentId) => void;
  selectedPlant: PlantId | null;
  openPlant: (p: PlantId | null) => void;
  /** Vista de tratamiento abierta en el panel derecho. */
  explorerOpen: boolean;
  setExplorerOpen: (open: boolean) => void;
  section: ExplorerSection;
  setSection: (s: ExplorerSection) => void;
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  avatarState: AvatarState;
  setAvatarState: (s: AvatarState) => void;
}

const Ctx = createContext<UiState | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  // Al entrar se ven los datos del inicio; "Ver solo la planta" los oculta y "Ver datos" los vuelve a mostrar.
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTabRaw] = useState<TabKey>('home');
  const [treatment, setTreatment] = useState<TreatmentId>('T1');
  const [selectedPlant, openPlant] = useState<PlantId | null>(null);
  const [explorerOpen, setExplorerOpenRaw] = useState(false);
  // Navegar a una sección o abrir un tratamiento despliega el panel de datos automáticamente.
  const setTab = useCallback((t: TabKey) => {
    setTabRaw(t);
    setPanelOpen(true);
  }, []);
  const setExplorerOpen = useCallback((open: boolean) => {
    setExplorerOpenRaw(open);
    if (open) setPanelOpen(true);
  }, []);
  const [section, setSection] = useState<ExplorerSection>('history');
  const [range, setRange] = useState<RangeKey>('24h');
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const value = useMemo(
    () => ({
      panelOpen,
      setPanelOpen,
      tab,
      setTab,
      treatment,
      setTreatment,
      selectedPlant,
      openPlant,
      explorerOpen,
      setExplorerOpen,
      section,
      setSection,
      range,
      setRange,
      avatarState,
      setAvatarState,
    }),
    [panelOpen, tab, setTab, treatment, selectedPlant, explorerOpen, setExplorerOpen, section, range, avatarState],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUi() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUi fuera de UiProvider');
  return v;
}
