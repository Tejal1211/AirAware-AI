// Static class maps so Tailwind can see the names at build time.
export const TONE = {
  good: 'bg-aqi-good-bg text-aqi-good border-aqi-good', moderate: 'bg-aqi-moderate-bg text-aqi-moderate border-aqi-moderate',
  usg: 'bg-aqi-usg-bg text-aqi-usg border-aqi-usg', unhealthy: 'bg-aqi-unhealthy-bg text-aqi-unhealthy border-aqi-unhealthy',
  very_unhealthy: 'bg-aqi-very_unhealthy-bg text-aqi-very_unhealthy border-aqi-very_unhealthy',
  hazardous: 'bg-aqi-hazardous-bg text-aqi-hazardous border-aqi-hazardous', unknown: 'bg-aqi-unknown-bg text-aqi-unknown border-aqi-unknown',
  caution: 'bg-aqi-usg-bg text-aqi-usg border-aqi-usg', avoid: 'bg-aqi-unhealthy-bg text-aqi-unhealthy border-aqi-unhealthy',
}
export const BAND_FILL = ['#E3F3E9', '#FBF1C7', '#FDE6CC', '#FBDAD6', '#EFD9F4']
export const BAND_EDGES = [0, 50, 100, 150, 200, 300]
export const hhmm = (iso) => (iso ? iso.slice(11, 16) : '')
export const fmt = (v, digits = 0) => (v === null || v === undefined ? 'n/a' : Number(v).toFixed(digits))
