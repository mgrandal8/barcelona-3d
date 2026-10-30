// Genera el icono de la app (favicon SVG y PNG de la PWA) a partir de un único dibujo.
// Uso: node scripts/iconos.mjs
import { writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const SALIDA = new URL('../public/', import.meta.url).pathname

// cuatro campanarios de la Sagrada Família sobre el mar, en 512 × 512
const campanario = (x, alto, ancho) => {
  const base = 392
  const cima = base - alto
  const w = ancho / 2
  return `<path d="M${x - w} ${base} L${x - w} ${cima + alto * 0.42} Q${x - w * 0.55} ${cima + alto * 0.12} ${x} ${cima} Q${x + w * 0.55} ${cima + alto * 0.12} ${x + w} ${cima + alto * 0.42} L${x + w} ${base} Z" fill="#fbefdc"/>
  <circle cx="${x}" cy="${cima - 12}" r="${w * 0.42}" fill="#f0b84a"/>
  ${[0.55, 0.7, 0.85].map((f) => `<rect x="${x - w * 0.28}" y="${cima + alto * f - 10}" width="${w * 0.56}" height="16" rx="8" fill="#c8553a" opacity="0.55"/>`).join('')}`
}
const torres = [campanario(150, 210, 64), campanario(218, 268, 70), campanario(294, 268, 70), campanario(362, 210, 64)].join('')
// el mar va siempre de borde a borde; en el maskable solo se encogen las torres
const mar = (y) => `
  <path d="M0 ${y} Q64 ${y - 24} 128 ${y} T256 ${y} T384 ${y} T512 ${y} V512 H0 Z" fill="#2f7fa8"/>
  <path d="M0 ${y + 40} Q64 ${y + 18} 128 ${y + 40} T256 ${y + 40} T384 ${y + 40} T512 ${y + 40} V512 H0 Z" fill="#256a8f"/>`

const svg = ({ redondo, escala }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><clipPath id="c"><rect width="512" height="512" rx="${redondo ? 112 : 0}"/></clipPath></defs>
  <g clip-path="url(#c)">
    <rect width="512" height="512" fill="#c8553a"/>
    <g transform="translate(256 256) scale(${escala}) translate(-256 -256)">${torres}</g>
    ${mar(256 + (380 - 256) * escala)}
  </g>
</svg>`

// favicon e icono normal con esquinas redondeadas; el maskable, a sangre y con el dibujo dentro de la zona segura (80 %)
const normal = svg({ redondo: true, escala: 1 })
const maskable = svg({ redondo: false, escala: 0.78 })
writeFileSync(`${SALIDA}favicon.svg`, normal)

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [nombre, fuente, lado] of [
  ['icono-192.png', normal, 192],
  ['icono-512.png', normal, 512],
  ['icono-maskable-512.png', maskable, 512],
  ['apple-touch-icon.png', maskable, 180],
]) {
  await page.setViewportSize({ width: lado, height: lado })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${lado}px;height:${lado}px}</style>${fuente}`)
  writeFileSync(`${SALIDA}${nombre}`, await page.screenshot({ omitBackground: true }))
  console.log(nombre)
}
await browser.close()
