# Barcelona 3D · Progreso

Plan completo: `~/.claude/plans/me-parece-bien-te-whimsical-scott.md`

## Sesión 1 (2026-10-27) — HECHO
- Proyecto Vite + React + TS con three, R3F, drei, postprocessing, zustand y Playwright (Chromium instalado).
- `src/scene/terreno.ts`: geografía (alturaTerreno, costaZ, Diagonal, Rambla, parques, RNG con semilla).
- `src/scene/generarCiudad.ts`: terreno low-poly con colores por zona, zócalo de la maqueta, manzanas del Eixample (octógono con patio, instanciadas), casas por barrios con tejados, árboles.
- `src/scene/Ciudad.tsx`, `Agua.tsx` (olas facetadas), `Experience.tsx` (luces, sombras, CameraControls, N8AO + Bloom + Vignette + SMAA, PerformanceMonitor).
- `src/data/monumentos.ts`: 8 lugares con posición, cámara y textos (ya reservan su hueco en la ciudad).
- `scripts/screenshot.mjs`: capturas leyendo el canvas (`?captura=1`). Variables: POSTPRO=0, ESPERA, LUGARES, ANCHO, ALTO.

## Sesión 2 (2026-10-27) — cambio a datos reales (opción A)
El usuario pidió más fidelidad a Barcelona: se sustituye la ciudad procedural por datos reales.
- `scripts/datos/comun.mjs`: marco girado 45° (Eixample alineado), origen 41.392, 2.165, rectángulo u∈[-5500,6500], v∈[-6000,4500] m.
- `scripts/datos/descargar.mjs`: OSM (Overpass, 12 teselas de edificios + mapa) y relieve Terrarium z13 → `datos-crudos/` (no se versiona).
- `scripts/datos/procesar.mjs` → `public/datos/` (terreno.bin, edificios.bin, mapa.json, meta.json).
- Navegador: `geo.ts` (1 u = 100 m, alturas ×1.6), `datos.ts`, `texturaSuelo.ts` (textura del suelo dibujada desde OSM), `mallas.ts` (terreno, zócalo, edificios extruidos por trozos, árboles), `CiudadReal.tsx`.
- Se borraron `terreno.ts`, `generarCiudad.ts`, `Ciudad.tsx`, `Agua.tsx` (versión procedural).
- `monumentos.ts` ahora usa coordenadas reales (`coord`), y `pos` se calcula. Las cámaras/alturas de marcador hay que reajustarlas a la nueva escala.

- Resultado: 142.290 edificios (4,8 MB), relieve 40 m (Tibidabo 512 m, Montjuïc 175 m ✓), 11k áreas y 9k líneas. Mar y dársenas hundidos con la máscara de agua; terreno a 20 m.
- Luz: NeutralToneMapping, exposición 0.95. `?cam=px,py,pz,tx,ty,tz` fija la cámara (env CAM / NOMBRE en screenshot.mjs).
- Capturas: `capturas/sesion2-*.png`.

## Sesión 3 (2026-10-27) — monumentos (fase 3) e interacción (fase 4) — HECHO
Plan de la sesión: `~/.claude/plans/elegant-riding-perlis.md`.
- `src/scene/monumentos/`: 8 modelos procedurales en coordenadas reales, con plantas y orientaciones sacadas de OSM.
  - `SagradaFamilia`: crucero en el centro de la manzana, Nacimiento en +x, Pasión en −x, Gloria en +z y ábside en −z; torre de Jesucristo con la cruz, María con la estrella, los 4 evangelistas, 8 campanarios con pináculos de mosaico y 2 grúas.
  - `CasaBatllo`: fachada de trencadís a Passeig de Gràcia (+x), balcones-máscara, columnas-hueso, lomo del dragón y torrecilla con la cruz.
  - `ParkGuell`: plaza con la planta real de OSM sobre la sala hipóstila, banco ondulante, escalinata con el dragón y la fuente, y las casetas de la entrada (Carrer d'Olot).
  - `TorreGlories`: bala de 144 m con lamas rojas abajo y azules arriba.
  - `CampNou`: gradas blaugrana en superelipses, cubierta, césped con líneas y eje girado −0,40 rad, como el campo de OSM.
  - `CatedralGotico`: nave con contrafuertes y pináculos, fachada neogótica, cimborrio de 70 m, campanarios octogonales y claustro con palmeras.
  - `Montjuic`: Palau Nacional (cúpula, 4 torres y pórtico) mirando a la Font Màgica (chorros animados), cascadas, las 4 columnas y el castillo en su coordenada. Las Torres Venecianas ya venían en OSM.
  - `Barceloneta`: Hotel W en forma de vela, torre de Sant Sebastià, L'Estel Ferit (se recoloca sola sobre la arena) y sombrillas solo donde hay arena.
- `monumentos/comun.ts`: `OrigenCtx`, `useSuelo` (altura local del terreno), `useLocal` (lat/lon → local), `mat` (materiales cacheados), `teñirCaras` (trencadís) y `torno`.
- `Monumento.tsx` (wrapper): pin flotante que escala con la distancia, anillo pulsante al pasar el ratón o seleccionar, etiqueta `Html` y clic. `Monumentos.tsx` asocia cada id con su modelo.
- Edificios OSM quitados: `HUECOS` en `monumentos.ts` (`radio` + `huecos` extra por lugar) y `crearEdificios(d, huecos)` descarta los edificios cuyo centroide cae dentro.
- Coordenadas corregidas a los centros reales (crucero, centro del campo, plaza del Park Güell…), con `alturaMarcador` y `camara` a la escala nueva.
- Fase 4: `src/store.ts` (zustand: seleccionado, hover; sincroniza `?lugar=id` con `replaceState`). `Experience.tsx` hace el vuelo con `setLookAt` + `setFocalOffset` (deja el monumento fuera del panel; en móvil aleja ×1,35 y sube el encuadre). `ui/PanelInfo.tsx` (ficha, anterior/siguiente, Esc) y `ui/ListaLugares.tsx` (índice con hover enlazado). Atribución OSM visible. Responsive: en móvil la lista empieza plegada y la ficha es una hoja inferior.
- Scripts: `scripts/capturas-lote.mjs vistas.json url carpeta` carga una vez y saca varias vistas (`cam` o `lugar`; con `lugar` usa `page.screenshot` y sale la interfaz). `scripts/captura-ui.mjs url salida.png [selectorClic]` hace una captura de página completa. En modo `?captura=1` se exponen `window.__controles` y `window.__estado`.
- Verificado: `tsc -b`, `npm run build` y oxlint (solo 2 avisos antiguos). Capturas en `capturas/sesion3-*.png` (cerca, con ficha, vista general y móvil).

## Sesión 4 (2026-10-27) — ambiente (fase 5) — HECHO
- `scene/hora.ts`: presets `dia` / `atardecer` / `noche` (cielo, niebla, sol, hemisferio, mar, nubes, exposición, factor `noche`) y el objeto `vivo`, con los valores del fotograma, que leen los demás componentes en `useFrame`. El momento está en el store (`momento`, `setMomento`) y en la URL (`?hora=atardecer|noche`).
- `scene/Ambiente.tsx`: sustituye a las luces de `Experience`. Transición de 2,5 s entre presets, cielo en degradado como `scene.background` (sale en las capturas), niebla y estrellas (Points) de noche. Al atardecer el sol se pone por el oeste (−x, −z).
- `Nubes.tsx`: 11 nubes de icosaedros facetados, con viento de poniente, sombra sobre la ciudad y fundido al acercarse la cámara.
- `Barcos.tsx`: 10 veleros, 4 yates y un ferri en elipses validadas con `esAgua`; balanceo, estela en V con alfa por vértice y luces de a bordo de noche.
- `Gaviotas.tsx`: 3 bandadas (Barceloneta, Port Vell, Port Olímpic) que planean y aletean a ratos; de noche se ocultan.
- Noche: ventanas procedurales en los edificios (`conVentanas` en `CiudadReal`, `onBeforeCompile` con una rejilla de 3,2 m por 4,5 m y brillo medio de lejos para que no parpadee), farolas como `emissiveMap` del terreno (`crearTexturaLuces`), piel LED de la Glòries (`Leds`, capa aditiva animada) y Font Màgica de colores con `pointLight`. El bloom se refuerza de noche.
- `ui/SelectorHora.tsx`: botones Día / Atardecer / Noche abajo a la izquierda (en móvil, solo iconos).
- `capturas-lote.mjs`: cada vista admite `"hora"` (espera `ESPERA_HORA`, 15 s por defecto). La primera vista tras cargar a veces no mueve la cámara: poner antes una vista de relleno.
- Verificado: `tsc -b`, `npm run build`, oxlint (solo avisos de mutar objetos de three en `useFrame`, normal en R3F) y capturas `capturas/sesion4-*.png`.

## Sesión 5 (2026-10-28) — interfaz (fase 6) — HECHO
- `ui/Portada.tsx`: portada "Descubre Barcelona" que hace también de pantalla de carga: barra de progreso con el paso en curso y, cuando la ciudad está lista, los botones "Explorar el mapa" y "Ver tours", con la maqueta girando detrás (se para con `prefers-reduced-motion`). Con `?lugar=` o `?captura=1` no sale la portada, solo una tarjeta de carga que se funde al terminar. `Pista` muestra los controles 7 s la primera vez (`localStorage`, con try/catch).
- Carga: no hay loaders de three, así que `useProgress` no mide nada. `datos.ts` lee los `fetch` por stream y cuenta bytes (`BYTES_ESTIMADOS` = 6,6 MB, porque con gzip no siempre llega Content-Length): la descarga ocupa el 80 % de la barra. `AvisoListo` (en `Experience`) marca `carga.listo` al tercer fotograma.
- `data/tours.ts`: 3 tours de ejemplo (Gaudí esencial de día, Del Gótico al mar al atardecer y Barcelona de noche), cada uno con su color, su hora y una nota por parada.
- Store: `tour`, `dialogo`, `portada`, `carga`, `empezarTour` (pone la hora del tour y vuela a la primera parada). Elegir un lugar que no es del tour, o volver al mapa, termina el tour. `?tour=id` se sincroniza con la URL.
- `scene/Ruta.tsx`: arcos discontinuos y animados (`QuadraticBezierLine`) entre paradas y su número (`Html`) sobre cada lugar.
- `PanelInfo`: en un tour muestra "parada n de N", la barra de pasos y la nota del guía; Anterior y Siguiente recorren solo las paradas, y en la última aparece "Terminar tour".
- `ui/Dialogos.tsx` (modal con Esc, ✕ o clic fuera): Tours de ejemplo (3 tarjetas), Sobre el guía (personaje ficticio "Laia Puig") y Cómo moverse (controles de ratón o táctiles según `pointer: coarse`). `ui/Menu.tsx`: barra arriba en el centro (en móvil, iconos abajo a la derecha); la tecla `?` abre la ayuda.
- Esc con un diálogo abierto cierra solo el diálogo. La interfaz HTML va en `z-index: 25`, por encima de las etiquetas `Html` de la escena (≤ 20): si no, los números de parada se pintaban encima de la ficha.
- `scripts/prueba-ui.mjs [url]`: comprueba por Playwright el tour desde la URL, la tecla `?`, Esc con diálogo y el fin del tour (7/7 OK).
- Verificado: `tsc -b`, `npm run build` y oxlint (sin avisos nuevos). Capturas en `capturas/sesion5-*.png`: carga, portada, tours, tour (parada 1 y 2, ruta, atardecer), guía, ayuda y móvil.

## Sesión 6 (2026-10-28) — optimización y build (fase 7) — HECHO
- Datos v2 (`scripts/datos/formato.mjs`): `edificios.bin.gz` en columnas, con las coordenadas en deltas y gzip (antes 4,77 MB, ahora 1,90 MB), y `mapa.json.gz` (1,86 → 0,51 MB). `procesar.mjs` ya escribe este formato. Se descomprimen con `DecompressionStream` (si el servidor ya lo hizo, se mira la cabecera 1f 8b y se usan tal cual), así que funciona en cualquier hosting estático.
- Web Worker (`scene/edificios.worker.ts`): lee y extruye los 142k edificios fuera del hilo principal (~1 s). La lógica pura está en `scene/edificios.ts` y la altura del terreno en `scene/relieve.ts` (sin DOM). `datos.ts` lanza el worker en cuanto tiene edificios, terreno y meta, sin esperar al mapa; `DatosCiudad.trozos` es una promesa aparte.
- `Edificios` va en un `Suspense` anidado junto a `AvisoListo`: el terreno no espera a los edificios ni se recalcula. La esfera envolvente viene del worker (antes `computeBoundingSphere` costaba ~0,3 s).
- LOD: en cada trozo, los edificios de menos de 13 m de alto y 500 m² de planta van en una malla aparte con los tejados al principio del índice. Si el trozo queda a más de 70 u, solo se dibujan los tejados (`setDrawRange`) y sin sombra. Así se conservan las tejas rojas, que dan color a los barrios: ocultarlos del todo se notaba mucho. Vista general: de 7,64 a 5,53 millones de triángulos por fotograma (−28 %).
- Mar: las olas se calculan en el vertex shader (`conOlas`), y no en CPU sobre 22k vértices en cada fotograma. `crearZocalo` reutiliza la malla del terreno (antes generaba otra).
- Mientras carga, `frameloop="demand"`: detrás de la portada no se ve nada, y el bucle de render le quitaba tiempo a React. `AvisoListo` pide sus fotogramas con `invalidate`.
- Code-splitting: `Experience` va en lazy y `cargarDatos()` arranca en `main.tsx`. `Momento` y `momentoDeUrl` pasan a `scene/momento.ts` (sin three), para que el store no arrastre three al chunk inicial. En `vite.config.ts`, los grupos `three`, `r3f` y `postpro` llevan `includeDependenciesRecursively: false` (sin eso, React acababa en `postpro` y la portada esperaba a three). Entry de 244 kB (78 kB gzip), frente al bundle único de 1,62 MB (515 kB gzip) de antes. `dist`: de 8,1 a 4,2 MB.
- `scripts/medir-carga.mjs [url] [n]`: tiempo hasta `carga.listo`, bytes de red y tareas largas. En modo captura se expone `window.__gl` (`__gl.info.render.triangles`).
- Medición A/B con `vite preview` y el build anterior servido a la vez (la máquina tenía mucha carga, así que hay ruido): hasta «listo», 5,4–5,6 s frente a 5,9–9,6 s; hilo principal bloqueado, 1,7–2,0 s frente a 3,0–3,7 s; red, 3,1 MB frente a 6,0 MB. La barra de carga sale a los 0,3 s. Lo que queda (unos 4 s en `(program)`) es SwiftShader compilando shaders y subiendo buffers por CPU; con GPU real no debería pasar.
- Verificado: `tsc -b`, `npm run build`, oxlint (sin avisos nuevos), `prueba-ui.mjs` (7/7) y capturas `capturas/sesion6-*.png` (LOD con y sin, noche, Sagrada Família, Barceloneta y portada).

## Sesión 7 (2026-10-29) — git y GitHub Pages
- El proyecto pasa a ser un repo git (rama `main`). `.gitignore` deja fuera `node_modules`, `dist`, `capturas/` y `datos-crudos/`.
- `vite.config.ts`: `base: process.env.BASE ?? '/'`. En local sigue en la raíz (los scripts no cambian); el workflow construye con `BASE=/barcelona-3d/`.
- `.github/workflows/pages.yml`: en cada push a `main`, `npm ci` + `npm run build` y despliegue con `actions/deploy-pages`. En el repo: Settings → Pages → Source: «GitHub Actions».
- Verificado: build con la base de Pages servido con `vite preview` en `/barcelona-3d/` y `prueba-ui.mjs` 7/7 (datos y worker cargan en la subruta).

## Sesión 8 (2026-10-30) — fase 8: guía usable en la calle (rama `worktree-utilidad-guia`)
Plan: `~/.claude/plans/haz-lo-que-me-splendid-peacock.md`. Cuatro bloques, un commit cada uno:
- **Idiomas (es/en)**: `src/i18n/es.ts` tiene los textos de la interfaz y define el tipo `Textos`. `en.ts` da las mismas claves y, además, la traducción de lugares y tours por id; `src/data` no cambia. `idioma.ts` decide el idioma inicial (`?lang=` > localStorage > navegador; si no es español ni catalán, inglés). `index.ts` tiene `useT`, `useLugar`, `useLugares`, `useTour` y `useTours`. El idioma va en el store y en `?lang=en`, y cambia `<html lang>` y el título. `carga.texto` es ahora una clave. Selector ES/EN en el menú y en la portada. Para añadir un idioma: un fichero como `en.ts` y una entrada en `IDIOMAS` y `TRADUCCIONES`.
- **Dónde estoy**: `src/ubicacion.ts` (`watchPosition`, `?pos=lat,lon` para simular, `simularPosicion`, distancias). Store: `ubicacion`, `estadoUbicacion` y `vuelo`, una petición de vuelo que `Camara` atiende después del efecto de la ficha. `scene/MiPosicion.tsx` dibuja el punto azul con el halo de precisión, sin prueba de profundidad. `ui/BotonUbicacion.tsx` es el botón y la tarjeta de estado: buscando, sin permiso, fuera de la maqueta (con «Simular que estoy en la Plaça de Catalunya») y el metro más cercano. La ficha da «A X de ti · ~N min a pie» (línea recta ×1,3, a 80 m/min) y la lista tiene la opción «Cerca de mí».
- **Metro**: `descargar.mjs` baja `transporte.json` (relaciones `route=subway|light_rail` y estaciones). `scripts/datos/procesar-transporte.mjs` genera `public/datos/transporte.json.gz` (6 kB, 12 líneas y 119 estaciones): un sentido por ramal, L9N/L9S como L9, cada parada asignada a su estación más cercana (si no, TMB y FGC se cruzaban en Catalunya) y los nombres iguales a menos de 500 m unidos, guardando todos sus accesos en `p`. `simplificar` ha pasado a `comun.mjs`. `src/transporte.ts` carga los datos aparte (no bloquea `carga.listo`) y da `estacionCercana`. `scene/Metro.tsx` pinta trazados con `Line` (borde blanco), apoyados en el relieve, y estaciones en `InstancedMesh`. Con la cámara por encima de 16 u la capa va encima de todo, como un plano; por debajo, los edificios la tapan (si no, las líneas cruzaban la Sagrada Família). Los nombres salen a menos de 16 u o al pasar el ratón (máximo 24). Botón M, `?metro=1`; empezar un tour enciende la capa.
- **PWA**: icono propio, generado con `scripts/iconos.mjs` (antes el favicon era el logo de Vite), `manifest.webmanifest`, y en `index.html` el `theme-color` y el `apple-touch-icon`. El plugin `pwa` de `vite.config.ts` rellena la plantilla `scripts/sw.js` con la lista del build (chunks, worker, CSS, index.html, datos e iconos: 20 ficheros) y una versión que cambia con el contenido. Navegación con red primero (5 s como mucho) y, sin red, el index guardado; el resto, caché primero. **`ignoreVary: true` es imprescindible**: los módulos con `crossorigin` llevan `Origin` y, con `Vary: Origin` (vite preview), no se encontraban en la caché. `src/pwa.ts` registra el service worker (solo en el build y sin `?captura`), avisa de versión nueva («Recargar» → `skipWaiting`) y guarda el aviso de instalación. `ui/AvisoRed.tsx`: aviso sin conexión o de versión nueva, y la sección «Llévatela» de la Ayuda (estado, botón de instalar y pista para iOS).
- Pruebas: `scripts/prueba-utilidad.mjs [url] [idioma,ubicacion,metro]` (8 + 10 + 7 OK). `scripts/prueba-pwa.mjs guardar|sin-red [url]`, con perfil persistente: la primera fase con el servidor de `vite preview` encendido y la segunda **con el servidor apagado** (3 + 4 OK). `prueba-ui.mjs` sigue en 7/7. `tsc -b`, `npm run build` y oxlint: los únicos avisos nuevos son de mutar materiales en `useFrame`, como los que ya había.
- Capturas: `capturas/sesion8-*.png` (punto azul, metro en la vista general y de cerca, ficha con metro y distancia, móvil con la tarjeta y ficha en inglés).
- Lecciones: con la máquina cargada, cada fotograma por SwiftShader tarda 3–5 s y Playwright no ve los botones «estables». Las pruebas esperan a `carga.listo` (la tarjeta de carga tapa los botones mientras tanto) y hacen los clics con `force`. Medido: la capa de metro no cambia el tiempo de fotograma más allá del ruido. Las vistas `cam` de `capturas-lote.mjs` leen el canvas, así que no salen las etiquetas HTML; para verlas, hay que usar una vista `lugar` o `captura-ui.mjs`.

## Pendiente / ideas detectadas
- Ambiente: el reflejo del sol en el mar al atardecer queda algo quemado en el borde del encuadre; las estrellas apenas se ven desde la vista general; el ferri pasa a veces muy cerca de la playa.
- Costa con dientes de sierra (rejilla de 20 m): suavizar con la línea de costa de OSM o con más resolución cerca del mar.
- Optimización (después de la fase 7): el terreno, la textura del suelo y los árboles aún suponen ~0,9 s de tarea larga en el hilo principal (la máscara de agua usa canvas; se podría pasar a un worker con OffscreenCanvas). `postpro` ocupa 159 kB gzip (N8AO): podría cargarse aparte, después de la ciudad.
- Con postpro (N8AO) la vista general no se captura en headless (demasiado lenta por software): probar en el navegador del usuario.
- Park Güell: queda un edificio OSM alto delante de las casetas de la entrada; revisar el hueco (o la altura en OSM). La escalinata se ha acortado a 42 m y no llega a la coordenada real de la entrada.
- Montjuïc: el Palau se ve algo apagado (fachada en sombra) y su zócalo es un bloque: mejorar terrazas y escalinatas. El castillo solo se ha visto de lejos.
- Hotel W: forma de vela aceptable; podría afinarse el perfil y añadir el reflejo del cielo.
- Camp Nou: la fachada es lisa; faltan detalles de la nueva fachada y las letras.
- Casa Batlló: a esta escala es pequeña (15 m de fachada); se reconoce de cerca, no desde la vista general.
- Los pines se ven pequeños desde la vista general; quizá subir la escala mínima o añadir el número del lugar.
- Tours: los números de parada (`Html`) se ven aunque el lugar quede detrás de un edificio; la portada podría tener un recorrido de cámara más pensado que el giro sobre la vista general.
- Hay otro Vite en el puerto 5173 (no es de esta sesión); en la sesión 4 se usó el 5174 y en la 5 el 5175 (`npx vite --port 5175 --strictPort`).

## Plan para hacerla profesional (sesiones 9–15)
Propuesto al final de la sesión 8. Orden: **9 → 12 → 10 → 13 → 11 → 14 → 15**.
- **S9 · Que no falle nunca**: versión ligera sin WebGL o en móviles flojos (lista + fichas + mapa 2D) con aviso; calidad adaptativa desde el inicio (sombras, postproceso, edificios, dpr); terreno y textura del suelo en un worker (hoy ~0,9 s de hilo principal); postproceso (159 kB) cargado después de la ciudad; error boundary con «Reintentar».
- **S12 · Interfaz de producto**: iconos SVG propios en vez de emojis; pines legibles desde la vista general (número o categoría, agrupados si se solapan); números de tour que no se vean a través de edificios; accesibilidad (teclado, alternativa en texto para lector de pantalla, contraste, reduced motion en todos los vuelos); repaso visual en escritorio y móvil.
- **S10 · Ciudad más real**: costa con la línea real de OSM; nombres de barrios y calles principales según el zoom; ventanas de día y más variedad de color por barrio; revisar alturas de edificios emblemáticos; arreglar reflejo del sol quemado, estrellas que casi no se ven y el ferri cerca de la playa.
- **S13 · Cámara y experiencia**: entrada cinematográfica en la portada; vuelos con curva y altura según la distancia; «Reproducir tour» automático con la nota del guía; botón compartir (enlace e imagen para redes).
- **S11 · Monumentos**: pendientes de Park Güell, Montjuïc, Camp Nou, Hotel W y Casa Batlló; 2–3 nuevos (Casa Milà, Arc de Triomf, Palau de la Música o Colón).
- **S14 · Contenido real y legal**: horarios y precios reales con fuente y fecha; fotos de Wikimedia con licencia; catalán; SEO (meta por lugar, imagen para redes, sitemap, URL indexable por ficha); política de privacidad, atribuciones y analítica sin cookies.
- **S15 · Calidad continua y Lokalu**: tests en GitHub Actions; regresión visual; presupuesto de peso y carga; registro de errores; modo embebido `?embed=1` con datos de lugares y tours desde un JSON externo y aviso a la página anfitriona (postMessage) al pulsar «Reservar».

## Siguiente sesión
- **S9** (en curso, rama `worktree-s9-robustez`).
- Pendiente de la fase 8: probar en un móvil real el GPS paseando, instalar la app, el modo avión con la app ya abierta una vez y el aviso «Nueva versión» tras otro despliegue; y en el navegador del usuario (GPU, con postpro) los tres momentos del día, el metro de noche y el LOD al acercarse.

## Notas
- WebGL por software (SwiftShader) en WSL: `page.screenshot` se cuelga; por eso se lee `canvas.toDataURL`.
- Montjuïc se ve algo plano desde la vista general: revisar en primer plano.
