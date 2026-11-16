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
    <div className="relative flex h-full w-full overflow-hidden">
      {/* Planta 3D: ocupa toda la pantalla con el panel cerrado y se va al primer tercio al abrirlo. */}
      <div
        className={`h-full shrink-0 border-white/10 transition-[width] duration-700 ease-in-out ${open ? 'border-r' : ''}`}
        style={{ width: open ? '33%' : '100%' }}
      >
        <PlantStage />
      </div>

      {/* Panel cerrado: botón para desplegar los datos (borde derecho). */}
      <button
        onClick={() => ui.setPanelOpen(true)}
        aria-label="Mostrar panel de datos"
        className={`absolute top-1/2 right-6 z-30 -translate-y-1/2 transition-all duration-500 ${open ? 'pointer-events-none translate-x-8 opacity-0' : 'opacity-100'}`}
      >
        <img src="/igris/btn-ver-datos.png" alt="" draggable={false} className="img-btn h-[96px] w-auto" />
      </button>
      {/* Panel de datos: se desliza desde la derecha. El contenido tiene ancho fijo para no reacomodarse durante la animación. */}
      <main
        aria-hidden={!open}
        className={`relative h-full min-w-0 overflow-hidden transition-all duration-700 ease-in-out ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        style={{ width: open ? '67%' : '0%' }}
      >
      <div className="flex h-full w-[67vw] flex-col px-6 pt-4 pb-3">
        {/* Barra superior: dónde estoy + estado del sistema. */}
        <header className="mb-3 flex h-12 shrink-0 items-center gap-4">
          {!atHome && (
            <button
              onClick={goHome}
              className="flex h-12 items-center gap-2 rounded-xl bg-white/90 px-4 text-sm text-ink-2 shadow-sm hover:bg-white hover:text-ink"
            >
              <span className="text-lg leading-none">‹</span> Inicio
            </button>
          )}
          <h1 className="text-xl font-medium text-white">{explorer ? 'Tratamiento' : SECTION_TITLES[ui.tab]}</h1>
          <button
            onClick={() => ui.setPanelOpen(false)}
            className="ml-auto flex h-12 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm text-white ring-1 ring-white/25 hover:bg-white/20"
          >
            Ver solo la planta <span className="text-lg leading-none">›</span>
          </button>
          {/* Cliente conectado y salida. */}
          <div className="flex h-12 items-center gap-2 rounded-xl bg-white/10 pr-1 pl-3 text-sm text-white ring-1 ring-white/25">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#74b43b] to-[#0085de] text-xs font-semibold uppercase">
              {user.slice(0, 1)}
            </span>
            <span className="max-w-[140px] truncate">{user}</span>
            <button onClick={onLogout} className="h-10 rounded-lg px-3 text-white/80 hover:bg-white/15 hover:text-white">
              Salir
            </button>
          </div>
        </header>
        {/* Línea con los degradados del logotipo: lima → turquesa → azul. */}
        <div className="mb-4 h-[3px] shrink-0 rounded-full bg-gradient-to-r from-lime via-turquoise to-blue" />

        <div className="relative min-h-0 flex-1">
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
        <footer className="mt-3 flex h-16 shrink-0 items-center justify-between gap-6">
          <div className="flex items-center gap-6 text-sm text-white/85">
            {s.origin === 'simulated' && <SimBadge onDark />}
            {activeAlerts > 0 && !explorer && ui.tab !== 'alerts' && (
              <button onClick={() => ui.setTab('alerts')} className="flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-white hover:bg-white/20">
                <span className="h-2 w-2 rounded-full bg-[#fab219]" />
                {activeAlerts} {activeAlerts === 1 ? 'alerta' : 'alertas'}
              </button>
            )}
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${s.connection === 'open' ? 'bg-[#a6e07a]' : 'bg-crit'}`} />
              {s.connection === 'open' ? 'En vivo' : 'Sin conexión'}
            </span>
            <span className="num text-base text-white">{fmtTime(s.now)}</span>
          </div>
          {/* Espacio reservado para el botón de IGRIS (fijo abajo a la derecha). */}
          <div className="w-60 shrink-0" />
        </footer>
      </div>
      </main>

      {/* IGRIS: disponible siempre, con o sin panel. */}
      <div className="fixed right-6 bottom-3 z-40">
        <AssistantWidget onAction={onAssistantAction} />
      </div>
    </div>
  );
}
