# Guía embebida (`?embed=1`)

La guía se puede meter en otra web (p. ej. Lokalu) con un iframe. La web anfitriona pone sus datos (precios, horarios, tours) y gestiona las reservas: la guía solo le avisa cuando alguien pulsa «Reservar».

Ejemplo completo: [`public/embebido/anfitrion.html`](../public/embebido/anfitrion.html) con [`ejemplo.json`](../public/embebido/ejemplo.json). Publicado en `https://mgrandal8.github.io/barcelona-3d/embebido/anfitrion.html` (admite `?modo=ligero` o `?lang=en`, que pasan a la guía).

```html
<iframe
  src="https://mgrandal8.github.io/barcelona-3d/?embed=1&datos=https%3A%2F%2Fanfitrion.example%2Fguia.json&origen=https%3A%2F%2Fanfitrion.example"
  title="Guía 3D de Barcelona"
  allow="geolocation; web-share; fullscreen"
  style="width: 100%; height: 640px; border: 0"
></iframe>
```

## Parámetros

| Parámetro | Qué hace |
|---|---|
| `embed=1` | Modo embebido: sin portada, sin service worker y sin analítica propia. Botones «Reservar» donde el JSON lo diga. |
| `datos=<url>` | JSON con los lugares y tours de la anfitriona (abajo). Si no llega en 8 s o no es válido, la guía sigue con sus datos y manda un mensaje `error`. |
| `origen=<https://…>` | Origen de la anfitriona: los mensajes solo se mandan a él y solo se aceptan de él. Sin él se usa `*`. |
| `lang=es\|ca\|en`, `lugar=<id>`, `tour=<id>`, `hora=dia\|atardecer\|noche`, `modo=ligero` | Como en la guía normal. |

**Seguridad.** El JSON solo se acepta del mismo origen que la guía o de los orígenes de la variable de build `VITE_EMBED_ORIGENES` (separados por comas, p. ej. `https://lokalu.example,https://staging.lokalu.example`). Si no, cualquiera podría enseñar en esta web precios o enlaces de reserva falsos con un enlace preparado. El servidor del JSON tiene que permitir CORS para el origen de la guía. Los textos se pintan como texto (nunca como HTML) y los enlaces solo pueden ser `https:`.

## Formato del JSON

```jsonc
{
  "version": 1,
  "anfitrion": "Lokalu",            // la ficha dirá «Horario y precio facilitados por Lokalu»
  "lugares": {                       // por id; solo lugares que ya están en la maqueta (cada uno tiene su modelo 3D)
    "sagrada-familia": {
      "precio": "34 € con guía",     // nombre, etiqueta, barrio, descripcion, horario, precio, duracion, consejo
      "horario": "9:00, 12:00 y 16:00",
      "reserva": { "id": "lk-123", "url": "https://…" },   // o true; sin reserva no hay botón
      "web": "https://…",            // opcional: fuente del horario y precio
      "ca": { "precio": "…" },       // traducciones opcionales de los campos cambiados
      "en": { "precio": "…" }
    }
  },
  "tours": [                         // si hay al menos uno válido, sustituyen a los tours de la demo
    {
      "id": "modernista",            // [a-z0-9-]
      "nombre": "Ruta modernista",
      "resumen": "…", "duracion": "4 h", "precio": "79 €",
      "momento": "dia",              // dia | atardecer | noche: la hora de la maqueta al empezar
      "icono": "lagarto",            // lagarto, velero, luna, estrella, brujula, guia o sol
      "color": "#c2543a",
      "reserva": { "id": "lk-tour-1" },
      "paradas": [{ "id": "sagrada-familia", "nota": "Quedamos en…" }],   // de 2 a 12, lugares de la maqueta
      "ca": { "nombre": "…", "resumen": "…", "duracion": "…", "precio": "…", "notas": ["…"] },
      "en": { "…": "…" }
    }
  ]
}
```

Ids de los lugares: `sagrada-familia`, `casa-batllo`, `park-guell`, `torre-glories`, `camp-nou`, `catedral`, `montjuic`, `barceloneta`, `casa-mila`, `arc-de-triomf`, `colom`.

Un campo cambiado sin su traducción sale en español también en catalán e inglés (mejor que enseñar la traducción del texto viejo). Los avisos de validación (lugar desconocido, tour sin paradas…) salen en la consola.

## Mensajes

Todos llevan `{ fuente: 'barcelona-3d', version: 1, tipo }`. Comprobar siempre `event.origin` y `event.source`:

```js
addEventListener('message', (e) => {
  if (e.origin !== 'https://mgrandal8.github.io' || e.data?.fuente !== 'barcelona-3d') return
  if (e.data.tipo === 'reservar') abrirReserva(e.data.reserva, e.data)
})
```

De la guía a la anfitriona:

| tipo | Datos | Cuándo |
|---|---|---|
| `listo` | `lugares`, `tours` (ids), `idioma`, `modo` (`3d`/`ligero`), `datos` (`externos`/`demo`/`error`) | La maqueta (o la versión ligera) ya se ve |
| `seleccion` | `lugar`, `tour` (o `null`) | Se abre o se cierra una ficha, se empieza o termina un tour |
| `reservar` | `lugar`, `tour`, `reserva` (el `id` del JSON), `idioma`, `momento` | Se pulsa «Reservar» (en la ficha o en un tour) |
| `error` | `mensaje` | Falla el JSON o algo de la guía (ver el registro de errores) |

De la anfitriona a la guía (`iframe.contentWindow.postMessage(msg, 'https://mgrandal8.github.io')`):

| tipo | Datos |
|---|---|
| `abrir` | `lugar` (id, o `null` para volver al mapa) |
| `tour` | `id`, `reproducir` (opcional: tour automático) |
| `idioma` | `idioma` (`es`, `ca`, `en`) |
| `hora` | `momento` (`dia`, `atardecer`, `noche`) |

Fuera de un iframe (alguien abre el enlace con `embed=1` directamente), «Reservar» abre la `url` de la reserva si la hay.
