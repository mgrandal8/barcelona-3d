// Iconos propios en línea (viewBox 24, trazo de 2 y currentColor), en lugar de emojis: se ven igual en todos
// los sistemas y siguen el color del texto. Son decorativos: el texto o el aria-label del botón dicen qué hacen.

const TRAZOS = {
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  atardecer: <path d="M3 17h18M6.5 17a5.5 5.5 0 0 1 11 0M12 5v3M4.6 9.6l1.8 1.4M19.4 9.6 17.6 11M8 21h8" />,
  luna: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />,
  brujula: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5Z" />
    </>
  ),
  guia: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20.5c.9-3.6 3.8-5.8 7-5.8s6.1 2.2 7 5.8" />
    </>
  ),
  ayuda: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 0 1 4.9.6c0 1.8-2.5 2.2-2.5 4M12 17.2v.1" />
    </>
  ),
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  pin: (
    <>
      <path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  ubicacion: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
    </>
  ),
  ajustar: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  mas: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  lagarto: (
    <path d="M12.5 3c1.4.3 1.8 1.7 1.2 3.2l-1 2.6c-.5 1.4.3 2.8.9 4.2.8 2-.2 4-2.2 5.1-1.6.9-2.6 2.2-1.6 3.4M10.2 8.2 7 6.6M13.4 8.6l3-1.8M11 14.6l-3.4 1.2M14.2 14l3 1.6" />
  ),
  velero: <path d="M12 3v13M12 4.5 18 15h-6M10.5 7 6 15h4.5M3.5 18h17l-2.2 3H5.7Z" />,
  estrella: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" fill="currentColor" />,
}

export type NombreIcono = keyof typeof TRAZOS

export function Icono({ nombre, tam = '1.25em', className }: { nombre: NombreIcono; tam?: number | string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tam}
      height={tam}
      className={['icono', className].filter(Boolean).join(' ')}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRAZOS[nombre]}
    </svg>
  )
}
