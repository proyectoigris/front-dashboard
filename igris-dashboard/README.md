# IGRIS · Dashboard de la cámara de crecimiento

Frontend del gemelo biodigital de la cámara de crecimiento IGRIS (Intelligent Growth Response & Interaction System).
Monitorea 24 plantas de tomate (P01–P24) en 4 tratamientos:

| Tratamiento | Riego   | Inoculación |
|-------------|---------|-------------|
| T1          | Normal  | No          |
| T2          | Normal  | Sí          |
| T3          | Déficit | No          |
| T4          | Déficit | Sí          |

Cada rizotrón tiene 2 sensores de humedad de suelo (3 cm y 15 cm). Además hay sensores de ambiente: temperatura, humedad relativa, CO₂ y luz (PAR).

> **Los datos son SIMULADOS** y la interfaz los marca como tales. No constituyen evidencia experimental.
> Los datos biológicos (microbioma y proteínas) son una **demostración** derivada de datasets externos y no publicados: no los compartas sin autorización.

---

## Ejecutar

**En Windows, sin usar comandos:** haz doble clic en `Abrir IGRIS.bat`, que está junto a esta carpeta. La primera vez instala las dependencias (requiere [Node.js](https://nodejs.org) 18 o superior) y luego abre el navegador en http://localhost:5173.

**Con comandos:**

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # versión de producción en dist/
npm run preview    # sirve dist/ en http://localhost:4173
```

- Pantalla de referencia: 2560 × 720. También se probó en 1880 × 952 y en navegadores de escritorio.
- Kiosco en Raspberry Pi: `chromium-browser --kiosk --app=http://localhost:4173`
- Después de `npm install` funciona sin internet, salvo el reconocimiento de voz de Chrome.

---

## Qué hace

**Acceso** (`src/components/access/`)
- **Bienvenida** (`#/`): portada con la imagen oficial (`public/igris/portada.png`, servida como `portada-web.webp`). Explica qué hace IGRIS, el experimento, los sensores, la toma de datos, los análisis y el proyecto **Mini IGRIS** para el campo.
- **Login** (`#/login`): usuario y clave, con un video en loop al lado (`public/igris/login.mp4`). Si el video falta, se muestra el personaje.
- **Entrar como invitado (Datos Simulados)**: está en la bienvenida y en el login, y entra directo al dashboard sin cuenta.
- **Dashboard** (`#/app`): muestra el nombre del usuario y un botón **Salir**. Sin sesión, redirige al login.
- **Cuentas (concepto):** la lista está en `src/lib/demoAuth.ts` y guarda solo la huella SHA-256 de cada clave, nunca el texto. La verificación ocurre en el navegador, así que **no es segura**: antes de dar acceso a clientes reales, el login debe validarse en el servidor local. Para agregar una cuenta, calcula el SHA-256 de su clave y súmala a `ACCOUNTS`.

**Dashboard: inicio**
- Al entrar se ven los datos del inicio; con "Ver solo la planta" se ocultan y la planta 3D ocupa toda la pantalla.
- La planta de tomate 3D gira lentamente; se detiene al tocarla y se puede rotar con el mouse o el dedo.
- Etiquetas compactas salen del punto donde se mide cada dato: humedad a 3 cm y a 15 cm, temperatura del suelo, aire (temperatura y humedad relativa) y luz (PAR).
- Tocar una etiqueta abre el panel con el detalle: las de suelo muestran el historial del tratamiento, y las de aire y luz abren la sección Ambiente.
- Tocar las **raíces** abre el microbioma; tocar las **hojas** abre las proteínas.
- El botón **Ver datos** abre el panel derecho (dos tercios de la pantalla), y la planta pasa al primer tercio.

**Panel de datos**
- **Inicio:** tarjetas con gráficos en vivo de Ambiente, Suelo, Plantas y Alertas, más una tarjeta por tratamiento.
- **Ambiente:** temperatura, humedad relativa, CO₂ y PAR.
- **Suelo:** humedad a 3 y 15 cm por tratamiento.
- **Plantas:** evapotranspiración (ET) estimada por balance hídrico del suelo.
- **Alertas:** anillo que se vuelve más rojo con cada alerta activa.

**Tratamiento**
- Historial por planta.
- Microbioma: barras apiladas de taxonomía (formato de publicación) en los días 0, 15 y 30.
- Proteínas: volcano plot con test t de Welch y corrección de Benjamini-Hochberg, heatmap de z-scores y composición funcional.

**Análisis IGRIS**
- Correlaciones de Pearson y Spearman, gráficos de dispersión, PCA, PCoA (Bray-Curtis) y red de co-ocurrencia.

**BotanIA (asistente IGRIS)**
- Chat con micrófono, ubicado abajo a la derecha.
- Responde solo con cifras que salen de los datos del dashboard y puede abrir secciones.

---

## Estructura

```
igris-dashboard/
  index.html, vite.config.ts, tsconfig.json, package.json
  public/
    models/igris.glb, tomate.glb       Modelos 3D optimizados (meshopt) que usa la web
    igris/logo.png, logo-recorte.png   Logotipo (original y versión recortada)
    igris/igris.png                    Personaje IGRIS
    igris/btn-*.png                    Botones ilustrados (copias livianas; los originales están en la misma carpeta)
    igris/portada.png, portada-web.webp  Imagen de portada (original y copia liviana para la web)
    igris/login.mp4                    Video en loop del login
  models-originales/                   Modelos 3D originales sin optimizar (respaldo)
  scripts/build-bio-demo.cjs           Genera los datos biológicos de demostración desde Excel/CSV
  src/
    App.tsx                    Rutas (bienvenida → login → dashboard) y diseño del dashboard
    components/access/         Bienvenida (Welcome), login e ingreso como invitado (Login)
    lib/demoAuth.ts            Cuentas de concepto (huella SHA-256 de cada clave)
    index.css                  Paleta del logotipo, fondo y estilos de etiquetas y botones
    config/experiment.ts       Tratamientos, asignación planta→tratamiento, sensores, umbrales, colores
    types/domain.ts            Modelo de datos (Plant, Sensor, SensorReading, Alert…): contrato con la API
    data/simulator.ts          Generador de datos de demostración (fotoperiodo, riego, déficit, fallos)
    data/bio/                  Datos biológicos de demostración (bioDemo.json) y su lectura
    services/
      dataSource.ts            MockDataSource | ApiDataSource (REST + WebSocket)
      assistant.ts             Asistente: respuestas basadas en los datos
      speech.ts                Micrófono (reconocimiento) y voz (síntesis) del navegador
    store/igrisStore.ts        Ingesta → agregación en intervalos de 10 min → snapshot cada 5 s
    state/ui.tsx               Estado de la interfaz (panel, sección, tratamiento, planta)
    lib/
      stats.ts                 Estadística descriptiva, Welch t-test, Benjamini-Hochberg
      analytics.ts             Evapotranspiración y series por tratamiento
      alerts.ts                Motor de alertas
      multivariate.ts          Correlaciones, PCA, Bray-Curtis, PCoA
      network.ts               Red de co-ocurrencia
    components/
      plant3d/                 Escena 3D (PlantScene), escenario con logo y botones (PlantStage)
      three/FittedModel.tsx    Carga, enderezado y encuadre automático de modelos GLB
      dashboard/               Inicio, detalles y alertas
      treatment/               Explorador de tratamiento, microbioma y proteínas
      analysis/                Análisis IGRIS y red de co-ocurrencia
      charts/                  Gráficos (Recharts), sparklines y anillo de alertas
      avatar/                  BotanIA: botón, chat y micrófono
```

---

## Conexión al backend (fase siguiente)

Para leer datos reales, ejecuta con `VITE_DATA_SOURCE=api`; así el dashboard usa `ApiDataSource`:

- `GET /api/bootstrap` → `{ origin, generatedAt, plants, sensors, history, events, biological, devices }`
- `WS /ws/readings` → `{ type: "readings", data: SensorReading[] }` · `{ type: "devices", data: DeviceStatus[] }`

Vite redirige `/api` y `/ws` a `localhost:8000` (por ejemplo, un servidor FastAPI).

## Datos biológicos

`src/data/bio/bioDemo.json` se generó a partir de metaproteómica de hojas (Excel) y metabarcoding 16S (CSV de ASVs y taxonomía). Para regenerarlo, o para cargar tus datos reales en el mismo formato:

```bash
node scripts/build-bio-demo.cjs <metaproteomica.xlsx> <ASVs_counts.csv> <ASVs_taxonomy.csv>
```

Requiere el paquete `xlsx` de SheetJS (`npm install xlsx`). La correspondencia con T1–T4 está descrita al inicio del script y dentro del JSON. Los archivos Excel y CSV de origen **no** van en este ZIP.

## Publicación (Vercel)

El dashboard está publicado en https://igris-dashboard.vercel.app, protegido con Vercel Authentication (equipo "rochaver"). Para publicar una nueva versión, primero inicia sesión con la cuenta dueña del equipo:

```bash
npx vercel login
npx vercel deploy --prod --scope rochaver
```

`.vercelignore` deja fuera los modelos originales, `node_modules` y las credenciales.

## Notas

- La voz usa la Web Speech API. En Chrome, el reconocimiento requiere internet. Para funcionar sin conexión en la Raspberry Pi hay que usar STT y TTS locales (Vosk o whisper.cpp, y Piper).
- En el simulador la inoculación no tiene efecto, para no sugerir resultados.
- El dashboard no controla el riego ni actuadores, por diseño.
