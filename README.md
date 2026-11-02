# Barcelona 3D

Guía turística de Barcelona sobre una maqueta 3D low-poly (React Three Fiber), con versión ligera sin WebGL, tres idiomas y uso sin conexión. Publicada en https://mgrandal8.github.io/barcelona-3d/. El diario de las sesiones está en [PROGRESO.md](PROGRESO.md).

## Desarrollo

```sh
npm install
npm run dev            # http://localhost:5173/
npm run build          # tipos + build en dist/
npx vite preview       # sirve dist/ en http://localhost:4173/
```

## Calidad

Todo esto corre en GitHub Actions en cada push ([`.github/workflows/calidad.yml`](.github/workflows/calidad.yml)); el resumen de cada run tiene las tablas.

| Qué | En local (con `vite preview` en el 4173) |
|---|---|
| Lint y tipos | `npm run lint` · `npm run build` |
| Pruebas de Playwright (WebGL por software) | `npm test` (todas, ~20–40 min) · `npm run test:rapidas` (sin maqueta, ~2 min) · una suite: `node scripts/pruebas.mjs http://localhost:4173/ embebido` |
| Presupuesto de peso y carga ([`presupuesto.json`](presupuesto.json)) | `npm run presupuesto` (peso) · `node scripts/presupuesto.mjs http://localhost:4173/` (y carga) |
| Regresión visual | dos builds servidos a la vez: `npm run visual -- http://localhost:4175/ http://localhost:4173/` → `capturas/regresion/informe.html` |

La regresión visual no guarda imágenes de referencia: compara en la misma máquina la base con la rama, porque por software cada máquina pinta algo distinto. Las capturas de la maqueta van con `?captura=1&reloj=10` (las animaciones quietas).

**Registro de errores** ([`src/registro.ts`](src/registro.ts)): errores de JS, promesas sin capturar, fallos de la maqueta y contexto WebGL perdido. Con `VITE_ERRORES_URL` en el build se mandan (máximo 10 por visita, sin datos personales) a ese endpoint; con la analítica encendida, también como evento «Error». En modo captura están en `window.__errores`.

## Guía embebida

`?embed=1&datos=<json>&origen=<anfitriona>`: la guía dentro de otra web, con sus datos y sus reservas por `postMessage`. Ver [docs/embebido.md](docs/embebido.md) y el ejemplo en `/embebido/anfitrion.html`.

## Variables de build

| Variable | Para qué |
|---|---|
| `BASE` | Ruta de la web (en Pages, `/barcelona-3d/`) |
| `SITIO` | URL absoluta para SEO (canónicas, sitemap) |
| `VITE_ANALITICA_URL`, `VITE_ANALITICA_DOMINIO`, `VITE_ANALITICA_NOMBRE` | Analítica sin cookies (compatible con Plausible) |
| `VITE_ERRORES_URL` | Endpoint del registro de errores (POST de JSON) |
| `VITE_VERSION` | Versión en los informes de error (el workflow pone el commit) |
| `VITE_EMBED_ORIGENES` | Orígenes de los que se acepta el JSON del modo embebido |
