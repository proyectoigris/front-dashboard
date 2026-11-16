/**
 * Pantalla de bienvenida (pública): qué es IGRIS, qué mide, cómo toma y analiza los datos,
 * y la visión de "Mini IGRIS" para el campo. Desde aquí se va al login de clientes.
 * Es una página de CONCEPTO: los textos describen el prototipo actual de la cámara.
 */
import { useState, type ReactNode } from 'react';
import { MOISTURE_DEPTHS, THRESHOLDS, TIMING, TREATMENTS, TREATMENT_IDS } from '../../config/experiment';

const NAV = [
  { id: 'que-hacemos', label: 'Qué hacemos' },
  { id: 'como', label: 'Cómo lo hacemos' },
  { id: 'sensores', label: 'Sensores' },
  { id: 'datos', label: 'Toma de datos' },
  { id: 'analisis', label: 'Análisis' },
  { id: 'mini-igris', label: 'Mini IGRIS' },
];

function go(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Íconos de línea simples (24×24), en el color del texto. */
function Icon({ d, className = 'h-6 w-6' }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  thermo: 'M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0zM12 9v7',
  cloud: 'M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 18z',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  co2: 'M4 15a3 3 0 0 1 0-6M10 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM16 12h2a1.5 1.5 0 0 1 0 3h-1l3 3',
  root: 'M12 3v8M12 11c-3 2-5 5-6 9M12 11c3 2 5 5 6 9M12 11v9M9 15l-2 1M15 15l2 1',
  leaf: 'M5 19C5 10 11 4 20 4c0 9-6 15-15 15zM5 19l8-8',
  chip: 'M8 8h8v8H8zM10 2v3M14 2v3M10 19v3M14 19v3M2 10h3M2 14h3M19 10h3M19 14h3',
  server: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
  chart: 'M3 21h18M3 21V3M7 15l4-5 3 3 5-7',
  alert: 'M12 3 2 20h20L12 3zM12 10v4M12 17h.01',
  chat: 'M4 5h16v11H9l-5 4V5z',
  field: 'M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6',
  wifi: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
};

function Section({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold tracking-[0.2em] text-[#a6e07a] uppercase">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-semibold text-white md:text-4xl">{title}</h2>
        {intro && <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/80">{intro}</p>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

function Card({ icon, title, children, accent = '#a6e07a' }: { icon: string; title: string; children: ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] p-6 ring-1 ring-white/12 backdrop-blur-sm">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10" style={{ color: accent }}>
        <Icon d={icon} />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-white/75">{children}</div>
    </div>
  );
}

const SENSORS = [
  { icon: ICONS.drop, name: 'Humedad del suelo', unit: '% VWC', where: `Rizotrón · ${MOISTURE_DEPTHS.upper} cm y ${MOISTURE_DEPTHS.lower} cm`, what: 'Contenido volumétrico de agua en la zona de raíces superficial y profunda. Es la base del riego y del cálculo de evapotranspiración.', color: '#5fd6e6' },
  { icon: ICONS.thermo, name: 'Temperatura del suelo', unit: '°C', where: 'Rizotrón', what: 'Condiciona la actividad de las raíces y de los microorganismos del suelo.', color: '#d3a23e' },
  { icon: ICONS.thermo, name: 'Temperatura del aire', unit: '°C', where: 'Cámara', what: `Ambiente de crecimiento. Rango operativo vigilado: ${THRESHOLDS.air_temperature.min}–${THRESHOLDS.air_temperature.max} °C.`, color: '#f0a35e' },
  { icon: ICONS.cloud, name: 'Humedad relativa', unit: '%', where: 'Cámara', what: 'Junto con la temperatura define la demanda de agua de la atmósfera sobre la planta.', color: '#7cc3ff' },
  { icon: ICONS.co2, name: 'CO₂', unit: 'ppm', where: 'Cámara', what: 'Materia prima de la fotosíntesis; indica también la ventilación de la cámara.', color: '#a6e07a' },
  { icon: ICONS.sun, name: 'Luz (PAR)', unit: 'µmol m⁻² s⁻¹', where: 'Bajo la lámpara', what: 'Radiación útil para la fotosíntesis y el fotoperiodo (día/noche) de las plantas.', color: '#fab219' },
];

const PIPELINE = [
  { icon: ICONS.drop, title: 'Sensores', text: 'Miden suelo y ambiente de forma continua, planta por planta.' },
  { icon: ICONS.chip, title: 'Nodo de adquisición', text: `Lee los sensores cada ${TIMING.acquisitionMs / 1000} s y marca cada dato con hora y origen.` },
  { icon: ICONS.server, title: 'Servidor local', text: `Valida y guarda las lecturas, y las resume en intervalos de ${TIMING.historyBucketMin} min.` },
  { icon: ICONS.chart, title: 'Dashboard en vivo', text: `Se actualiza cada ${TIMING.uiRefreshMs / 1000} s; muestra tendencias, alertas y análisis.` },
];

/** Imagen de portada: se prueba cada formato en orden; si ninguno existe se usa la portada ilustrada. */
const BANNERS = ['/igris/portada-web.webp', '/igris/portada.png', '/igris/portada.webp', '/igris/portada.jpg'];

export function Welcome({ onLogin, onGuest }: { onLogin: () => void; onGuest: () => void }) {
  const [bannerIdx, setBannerIdx] = useState(0);
  const banner = BANNERS[bannerIdx] ?? null;
  const nextBanner = () => setBannerIdx((i) => i + 1);
  return (
    <div className="h-full overflow-y-auto scroll-smooth text-white">
      {/* Barra superior fija */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0c3a3f]/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-6xl items-center gap-6 px-6">
          <img src="/igris/logo-recorte.png" alt="IGRIS" className="h-14 w-auto" draggable={false} />
          <nav className="ml-auto hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <button key={n.id} onClick={() => go(n.id)} className="h-10 rounded-lg px-3 text-sm text-white/80 hover:bg-white/10 hover:text-white">
                {n.label}
              </button>
            ))}
          </nav>
          <button
            onClick={onLogin}
            className="ml-auto flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-[#74b43b] via-[#08a1ba] to-[#0085de] px-5 text-sm font-semibold shadow-lg hover:brightness-110 lg:ml-2"
          >
            <Icon d={ICONS.user} className="h-4 w-4" /> Ingresar
          </button>
        </div>
      </header>

      {/* Portada: imagen oficial (public/igris/portada.*) si existe; si no, la portada ilustrada. */}
      {banner ? (
        <section className="px-6 pt-8 pb-16">
          <div className="mx-auto max-w-7xl">
            <img
              src={banner}
              alt="IGRIS · Plataforma de Monitoreo y Análisis agrobiológico: planta, microbioma, suelo y ambiente"
              draggable={false}
              onError={nextBanner}
              className="w-full rounded-3xl shadow-2xl ring-1 ring-white/15"
            />
            <div className="mt-8 flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
              <p className="max-w-2xl text-lg leading-relaxed text-white/85">
                Sensores de suelo y ambiente, análisis biológico e inteligencia artificial en un solo lugar: IGRIS muestra en vivo cómo cada planta vive el agua, la
                luz y el clima, y explica qué está pasando.
              </p>
              <div className="flex shrink-0 flex-wrap gap-3">
                <button onClick={onLogin} className="h-12 rounded-full bg-white px-6 text-sm font-semibold text-[#0f241a] shadow-lg hover:bg-[#f3faea]">
                  Ingresar a mi dashboard
                </button>
                <button onClick={onGuest} className="flex h-12 items-center gap-2 rounded-full bg-white/10 px-6 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/20">
                  <Icon d={ICONS.user} className="h-4 w-4" /> Entrar como invitado <span className="font-normal text-white/75">(Datos Simulados)</span>
                </button>
                <button onClick={() => go('que-hacemos')} className="h-12 rounded-full px-6 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/10">
                  Conocer IGRIS ↓
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
      <section className="relative overflow-hidden px-6 pt-16 pb-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/85 ring-1 ring-white/15">
              <span className="h-2 w-2 rounded-full bg-[#a6e07a]" /> Intelligent Growth Response &amp; Interaction System
            </p>
            <h1 className="mt-5 text-4xl leading-tight font-semibold md:text-6xl">
              Entendemos cómo{' '}
              <span className="bg-gradient-to-r from-[#a6e07a] via-[#5fd6e6] to-[#7cc3ff] bg-clip-text text-transparent">responden tus plantas</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
              IGRIS une sensores de suelo y ambiente, análisis biológico y estadística en un solo lugar. Muestra en vivo cómo cada planta vive el agua, la luz y
              el clima, y te explica qué está pasando.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={onLogin} className="h-12 rounded-full bg-white px-6 text-sm font-semibold text-[#0f241a] shadow-lg hover:bg-[#f3faea]">
                Ingresar a mi dashboard
              </button>
              <button onClick={onGuest} className="flex h-12 items-center gap-2 rounded-full bg-white/10 px-6 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/20">
                  <Icon d={ICONS.user} className="h-4 w-4" /> Entrar como invitado <span className="font-normal text-white/75">(Datos Simulados)</span>
                </button>
                <button onClick={() => go('que-hacemos')} className="h-12 rounded-full px-6 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/10">
                Conocer IGRIS ↓
              </button>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
              {[
                ['24', 'plantas monitoreadas'],
                ['6', 'variables en vivo'],
                [`${TIMING.uiRefreshMs / 1000} s`, 'actualización'],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="text-3xl font-semibold text-white">{v}</dt>
                  <dd className="text-xs text-white/70">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative grid place-items-center">
            <div className="absolute h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(166,224,122,0.35),transparent_70%)]" />
            <img src="/igris/igris.png" alt="Personaje IGRIS" draggable={false} className="anim-float relative max-h-[420px] w-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]" />
          </div>
        </div>
      </section>
      )}

      <Section
        id="que-hacemos"
        eyebrow="Qué hacemos"
        title="Un gemelo biodigital del cultivo"
        intro="IGRIS es una cámara de crecimiento instrumentada y su réplica digital. Seguimos a cada planta desde el suelo hasta las hojas para saber cómo responde al riego y a la inoculación con bacterias benéficas, y convertimos esas mediciones en información que se puede usar."
      >
        <div className="grid gap-5 md:grid-cols-3">
          <Card icon={ICONS.chart} title="Monitoreo continuo">
            Humedad y temperatura del suelo a dos profundidades, clima de la cámara y luz, minuto a minuto y para cada planta.
          </Card>
          <Card icon={ICONS.root} title="Biología de la planta" accent="#5fd6e6">
            Cómo cambian las bacterias de la raíz (microbioma) y las proteínas de la hoja con el tiempo y según el tratamiento.
          </Card>
          <Card icon={ICONS.chat} title="Respuestas claras" accent="#7cc3ff">
            Alertas cuando algo sale de rango y BotanIA, un asistente que responde preguntas usando solo los datos medidos.
          </Card>
        </div>
      </Section>

      <Section
        id="como"
        eyebrow="Cómo lo hacemos"
        title="Un experimento controlado y comparable"
        intro="24 plantas de tomate crecen en rizotrones dentro de la cámara, repartidas al azar en 4 tratamientos de 6 plantas. Así podemos separar el efecto del agua del efecto de la inoculación."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TREATMENT_IDS.map((id) => {
            const t = TREATMENTS[id];
            return (
              <div key={id} className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/12">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                  <span className="text-xl font-semibold">{id}</span>
                </div>
                <p className="mt-3 text-sm font-medium text-white">{t.waterRegime === 'normal' ? 'Riego normal' : 'Déficit hídrico (50 %)'}</p>
                <p className="text-sm text-white/70">{t.inoculated ? 'Inoculado con bacterias' : 'Sin inoculación'}</p>
                <p className="mt-3 text-xs text-white/55">6 plantas</p>
              </div>
            );
          })}
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <Card icon={ICONS.leaf} title="Rizotrones">
            Contenedores con una cara transparente que dejan ver y medir las raíces sin sacar la planta.
          </Card>
          <Card icon={ICONS.drop} title="Riego diferenciado" accent="#5fd6e6">
            Las plantas con déficit reciben la mitad del agua de referencia; los sensores confirman cuánto llega realmente al suelo.
          </Card>
          <Card icon={ICONS.root} title="Muestreo biológico" accent="#7cc3ff">
            Raíz y hoja se muestrean los días 0, 15 y 30 para relacionar biología con las mediciones continuas.
          </Card>
        </div>
      </Section>

      <Section
        id="sensores"
        eyebrow="Sensores"
        title="Qué medimos y por qué"
        intro="Cada rizotrón tiene dos sensores de humedad de suelo; la cámara tiene sensores de ambiente y luz. Todo queda asociado a su planta y a su tratamiento."
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SENSORS.map((s) => (
            <div key={s.name} className="rounded-2xl bg-white/[0.06] p-6 ring-1 ring-white/12">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10" style={{ color: s.color }}>
                  <Icon d={s.icon} />
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-xs text-white/85">{s.unit}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.name}</h3>
              <p className="text-xs text-white/60">{s.where}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/75">{s.what}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Card icon={ICONS.root} title="Microbioma de la raíz (16S)" accent="#a6e07a">
            Se secuencia el ADN de las bacterias que viven en la raíz para saber cuáles hay y en qué proporción.
          </Card>
          <Card icon={ICONS.leaf} title="Proteínas de la hoja (metaproteómica)" accent="#5fd6e6">
            Se identifican y cuantifican las proteínas de la hoja para ver qué procesos activa la planta frente al estrés.
          </Card>
        </div>
      </Section>

      <Section
        id="datos"
        eyebrow="Toma de datos"
        title="Del sensor a tu pantalla"
        intro="Los datos viajan por un camino corto y controlado. El servidor es local: la información queda en la institución y el dashboard sigue funcionando aunque se corte internet."
      >
        <ol className="grid gap-4 md:grid-cols-4">
          {PIPELINE.map((p, i) => (
            <li key={p.title} className="relative rounded-2xl bg-white/[0.06] p-6 ring-1 ring-white/12">
              <span className="absolute top-5 right-5 text-xs font-semibold text-white/40">0{i + 1}</span>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#74b43b] via-[#08a1ba] to-[#0085de]">
                <Icon d={p.icon} />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/75">{p.text}</p>
              {i < PIPELINE.length - 1 && <span className="absolute top-1/2 -right-3.5 z-10 hidden text-2xl text-[#a6e07a] md:block">›</span>}
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-white/65">
          Control de calidad: un sensor que deja de enviar datos por más de {THRESHOLDS.staleAfterSec} s se marca como “sin datos recientes”, en lugar de mostrar un
          valor viejo como si fuera actual.
        </p>
      </Section>

      <Section
        id="analisis"
        eyebrow="Análisis"
        title="Cómo convertimos datos en conocimiento"
        intro="Combinamos estadística clásica y análisis multivariado. Cada resultado indica de dónde sale y cuántas plantas lo respaldan."
      >
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Card icon={ICONS.chart} title="Comparación de tratamientos">
            Medias, dispersión y tendencias por tratamiento y por planta, en ventanas de 6 h, 24 h y 7 días.
          </Card>
          <Card icon={ICONS.drop} title="Evapotranspiración" accent="#5fd6e6">
            Estimamos cuánta agua usa cada planta por día a partir del balance hídrico del suelo en las dos profundidades.
          </Card>
          <Card icon={ICONS.alert} title="Alertas" accent="#fab219">
            Avisos cuando una variable sale de su rango operativo o un sensor deja de responder.
          </Card>
          <Card icon={ICONS.co2} title="Correlaciones y PCA" accent="#7cc3ff">
            Pearson y Spearman entre variables, y análisis de componentes principales para ver qué separa a los tratamientos.
          </Card>
          <Card icon={ICONS.root} title="Microbioma: PCoA y redes" accent="#a6e07a">
            Distancias de Bray-Curtis, PCoA y redes de co-ocurrencia para ver qué bacterias cambian y cuáles aparecen juntas.
          </Card>
          <Card icon={ICONS.leaf} title="Proteómica: volcano y heatmap" accent="#5fd6e6">
            Test t de Welch con corrección por comparaciones múltiples (Benjamini-Hochberg), mapas de calor y composición funcional.
          </Card>
        </div>
      </Section>

      <Section
        id="mini-igris"
        eyebrow="Próximamente"
        title="Mini IGRIS: la cámara, llevada al campo"
        intro="Lo que aprendemos en la cámara lo queremos poner en manos de cada agricultor. Mini IGRIS será una estación compacta que se instala en el potrero o invernadero y envía sus datos a un dashboard propio."
      >
        <div className="grid gap-5 md:grid-cols-3">
          <Card icon={ICONS.field} title="Estación en terreno">
            Sensores de humedad de suelo a varias profundidades, temperatura y clima, en un equipo resistente y de bajo consumo.
          </Card>
          <Card icon={ICONS.wifi} title="Conexión inalámbrica" accent="#5fd6e6">
            Envía los datos desde el campo al servidor, y guarda lo medido si se corta la señal.
          </Card>
          <Card icon={ICONS.user} title="Tu dashboard, tus datos" accent="#7cc3ff">
            Cada agricultor entra con su usuario y ve solo sus estaciones, con alertas de riego y recomendaciones basadas en lo aprendido en IGRIS.
          </Card>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-6 rounded-3xl bg-gradient-to-r from-[#74b43b]/25 via-[#08a1ba]/25 to-[#0085de]/25 p-8 ring-1 ring-white/15 md:flex-row md:items-center">
          <div>
            <h3 className="text-2xl font-semibold">¿Ya eres cliente?</h3>
            <p className="mt-1 text-white/80">Ingresa con tu usuario para ver la información de tu cultivo.</p>
          </div>
          <button onClick={onLogin} className="h-12 shrink-0 rounded-full bg-white px-6 text-sm font-semibold text-[#0f241a] shadow-lg hover:bg-[#f3faea]">
            Ingresar a mi dashboard
          </button>
        </div>
      </Section>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-xs text-white/60">
          <img src="/igris/logo-recorte.png" alt="IGRIS" className="h-10 w-auto opacity-90" draggable={false} />
          <p>Prototipo de concepto · los datos del dashboard de demostración son simulados.</p>
        </div>
      </footer>
    </div>
  );
}
