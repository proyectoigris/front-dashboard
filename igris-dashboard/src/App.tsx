import { useCallback, useEffect, useState } from 'react';
import { Login } from './components/access/Login';
import { Welcome } from './components/access/Welcome';
import { AssistantWidget } from './components/avatar/AssistantWidget';
import { fmtTime, SimBadge } from './components/common/primitives';
import { AlertsDetail, EnvironmentDetail, PlantsDetail, SoilDetail } from './components/dashboard/Details';
import { AnalysisView } from './components/analysis/AnalysisView';
import { Home, SECTION_TITLES } from './components/dashboard/Home';
import { PlantStage } from './components/plant3d/PlantStage';
import { TreatmentExplorer } from './components/treatment/TreatmentExplorer';
import type { AssistantAction } from './services/assistant';
import { igrisStore, useSnapshot } from './store/igrisStore';
import { UiProvider, useUi } from './state/ui';
import { useIsMobile } from './state/useIsMobile';
import type { PlantId, TreatmentId } from './types/domain';

type Route = 'welcome' | 'login' | 'app';
const SESSION_KEY = 'igris.user';
const GUEST_NAME = 'Invitado';

function routeFromHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  return h === 'login' ? 'login' : h === 'app' ? 'app' : 'welcome';
}
function readUser(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

/**
 * Flujo de acceso: bienvenida (#/) → login (#/login) → dashboard (#/app).
 * CONCEPTO: la sesión solo guarda el nombre de usuario en esta pestaña; no hay validación real.
 */
export default function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [user, setUser] = useState<string | null>(readUser);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (r: Route) => {
    window.location.hash = r === 'welcome' ? '/' : `/${r}`;
    setRoute(r);
  };
  const enter = (name: string) => {
    try {
      sessionStorage.setItem(SESSION_KEY, name);
    } catch {
      /* sin almacenamiento: la sesión dura mientras la página esté abierta */
    }
    setUser(name);
    navigate('app');
  };
  const logout = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* nada que borrar */
    }
    setUser(null);
    navigate('welcome');
  };

  const guest = () => enter(GUEST_NAME);
  if (route === 'welcome') return <Welcome onLogin={() => navigate(user ? 'app' : 'login')} onGuest={guest} />;
  if (route === 'login' || !user) return <Login onBack={() => navigate('welcome')} onEnter={enter} onGuest={guest} />;
  return (
    <UiProvider>
      <Shell user={user} onLogout={logout} />
    </UiProvider>
  );
}

function Shell({ user, onLogout }: { user: string; onLogout: () => void }) {
  const ui = useUi();
  const s = useSnapshot();
  const mobile = useIsMobile();

  useEffect(() => {
    igrisStore.start();
    return () => igrisStore.stop();
  }, []);

  /** Abre un tratamiento: la planta 3D (izquierda) y su vista de datos (derecha) se sincronizan. */
  const openTreatment = useCallback(
    (t: TreatmentId, plant?: PlantId) => {
      ui.setTreatment(t);
      ui.openPlant(plant ?? null);
      ui.setSection('history');
      ui.setExplorerOpen(true);
    },
    [ui],
  );

  const onAssistantAction = useCallback(
    (a: AssistantAction) => {
      if (a.type === 'openTreatment') openTreatment(a.treatmentId, a.plantId);
      else {
        ui.setExplorerOpen(false);
        ui.setTab(a.tab);
      }
    },
    [openTreatment, ui],
  );

  const goHome = () => {
    ui.setExplorerOpen(false);
    ui.setTab('home');
  };
  const explorer = ui.explorerOpen;
  const atHome = ui.tab === 'home' && !explorer;
  const activeAlerts = s.alerts.filter((a) => a.state === 'active').length;
  const open = ui.panelOpen;

  return (
    <div className={`relative flex h-full w-full overflow-hidden ${mobile ? 'flex-col' : ''}`}>
      {/* Planta 3D: ocupa toda la pantalla con el panel cerrado y se va al primer tercio al abrirlo.
          En móvil se apila: la planta arriba (franja) y los datos debajo. */}
      <div
        className={`shrink-0 border-white/10 duration-700 ease-in-out ${
          mobile ? `w-full transition-[height] ${open ? 'border-b' : ''}` : `h-full transition-[width] ${open ? 'border-r' : ''}`
        }`}
        style={mobile ? { height: open ? '34%' : '100%' } : { width: open ? '33%' : '100%' }}
      >
        <PlantStage />
      </div>

      {/* Panel cerrado: botón para desplegar los datos.
          Escritorio: pestaña pegada al borde derecho (de ahí sale el panel). Móvil: al centro de la fila inferior (el panel sube desde abajo). */}
      <button
        onClick={() => ui.setPanelOpen(true)}
        aria-label="Mostrar panel de datos"
        tabIndex={open ? -1 : 0}
        className={`dock-btn absolute z-30 transition-[opacity,translate] duration-500 ${
          mobile
            ? `dock-btn-sm bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 ${open ? 'pointer-events-none translate-y-6 opacity-0' : 'opacity-100'}`
            : `edge-tab top-1/2 right-0 -translate-y-1/2 ${open ? 'pointer-events-none translate-x-10 opacity-0' : 'opacity-100'}`
        }`}
      >
        <span className="dock-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {mobile ? <path d="M6 15l6-6 6 6" /> : <path d="M15 6l-6 6 6 6" />}
          </svg>
        </span>
        <span className={mobile ? '' : 'edge-label'}>{mobile ? 'Datos' : 'Ver datos'}</span>
      </button>
      {/* Panel de datos: se desliza desde la derecha. El contenido tiene ancho fijo para no reacomodarse durante la animación. */}
      <main
        aria-hidden={!open}
        className={`relative min-w-0 min-h-0 overflow-hidden transition-all duration-700 ease-in-out ${mobile ? 'w-full' : 'h-full'} ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        style={mobile ? { height: open ? '66%' : '0%' } : { width: open ? '67%' : '0%' }}
      >
      <div className={`flex h-full flex-col ${mobile ? 'w-full px-3 pt-2 pb-2' : 'w-[67vw] px-6 pt-4 pb-3'}`}>
        {/* Barra superior: dónde estoy + estado del sistema. */}
        <header className={`flex shrink-0 items-center ${mobile ? 'mb-2 h-10 gap-2' : 'mb-3 h-12 gap-4'}`}>
          {!atHome && (
            <button
              onClick={goHome}
              aria-label="Inicio"
              className="flex h-full items-center gap-2 rounded-xl bg-white/90 px-3 text-sm text-ink-2 shadow-sm hover:bg-white hover:text-ink md:px-4"
            >
              <span className="text-lg leading-none">‹</span> {!mobile && 'Inicio'}
            </button>
          )}
          <h1 className="min-w-0 truncate text-base font-medium text-white md:text-xl">{explorer ? 'Tratamiento' : SECTION_TITLES[ui.tab]}</h1>
          <button
            onClick={() => ui.setPanelOpen(false)}
            aria-label="Ver solo la planta"
            className="ml-auto flex h-full shrink-0 items-center gap-2 rounded-xl bg-white/10 px-3 text-sm text-white ring-1 ring-white/25 hover:bg-white/20 md:px-4"
          >
            {mobile ? 'Planta' : 'Ver solo la planta'} <span className="text-lg leading-none">{mobile ? '⌃' : '›'}</span>
          </button>
          {/* Cliente conectado y salida. */}
          <div className="flex h-full shrink-0 items-center gap-2 rounded-xl bg-white/10 pr-1 pl-2 text-sm text-white ring-1 ring-white/25 md:pl-3">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#74b43b] to-[#0085de] text-xs font-semibold uppercase">
              {user.slice(0, 1)}
            </span>
            {!mobile && <span className="max-w-[140px] truncate">{user}</span>}
            <button onClick={onLogout} className="h-8 rounded-lg px-2 text-white/80 hover:bg-white/15 hover:text-white md:h-10 md:px-3">
              Salir
            </button>
          </div>
        </header>
        {/* Línea con los degradados del logotipo: lima → turquesa → azul. */}
        <div className="mb-3 h-[3px] shrink-0 md:mb-4 rounded-full bg-gradient-to-r from-lime via-turquoise to-blue" />

        <div className={`relative min-h-0 flex-1 ${mobile ? 'm-flow scroll-y overflow-x-hidden pb-4' : ''}`}>
          {s.status === 'loading' && <div className="grid h-full place-items-center text-white/85">Cargando datos de la cámara…</div>}
          {s.status === 'error' && <div className="grid h-full place-items-center text-crit">Error: {s.error}</div>}
          {s.status === 'ready' &&
            (explorer ? (
              <TreatmentExplorer />
            ) : (
              <>
                {ui.tab === 'home' && <Home onSection={ui.setTab} onTreatment={openTreatment} />}
                {ui.tab === 'environment' && <EnvironmentDetail />}
                {ui.tab === 'soil' && <SoilDetail onTreatment={openTreatment} />}
                {ui.tab === 'plants' && <PlantsDetail onPlant={openTreatment} />}
                {ui.tab === 'alerts' && <AlertsDetail onPlant={openTreatment} />}
                {ui.tab === 'analysis' && <AnalysisView />}
              </>
            ))}
        </div>

        {/* Barra inferior: estado del sistema a la izquierda, IGRIS a la derecha (no tapa datos). */}
        {/* En móvil el estado va en una fila compacta; el botón de IGRIS flota sobre el contenido. */}
        <footer className={`flex shrink-0 items-center justify-between ${mobile ? 'mt-2 h-9 gap-2 pr-12' : 'mt-3 h-16 gap-6'}`}>
          <div className={`flex min-w-0 items-center text-white/85 ${mobile ? 'gap-3 overflow-hidden text-xs' : 'gap-6 text-sm'}`}>
            {s.origin === 'simulated' && <SimBadge onDark compact={mobile} />}
            {activeAlerts > 0 && !explorer && ui.tab !== 'alerts' && (
              <button onClick={() => ui.setTab('alerts')} className="flex h-8 shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 text-white hover:bg-white/20 md:h-10 md:px-4">
                <span className="h-2 w-2 rounded-full bg-[#fab219]" />
                {activeAlerts} {activeAlerts === 1 ? 'alerta' : 'alertas'}
              </button>
            )}
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${s.connection === 'open' ? 'bg-[#a6e07a]' : 'bg-crit'}`} />
              {s.connection === 'open' ? 'En vivo' : 'Sin conexión'}
            </span>
            {!mobile && <span className="num text-base text-white">{fmtTime(s.now)}</span>}
          </div>
          {/* Espacio reservado para el botón de IGRIS (fijo abajo a la derecha). */}
          {!mobile && <div className="w-52 shrink-0" />}
        </footer>
      </div>
      </main>

      {/* IGRIS: disponible siempre, con o sin panel. */}
      <div className={`fixed z-40 flex ${mobile ? 'right-3 bottom-[max(0.5rem,env(safe-area-inset-bottom))]' : 'right-6 bottom-5'}`}>
        <AssistantWidget onAction={onAssistantAction} />
      </div>
    </div>
  );
}
