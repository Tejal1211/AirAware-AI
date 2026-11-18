import { BAND_EDGES, BAND_FILL, hhmm } from '../utils/format.js'

const W = 720, H = 260, M = { l: 44, r: 12, t: 12, b: 34 }

/** Accessible SVG line chart of AQI: colour bands + text labels, an alt summary and a data table. */
export default function ForecastChart({ hourly, nowIndex }) {
  const pts = hourly.map((h, i) => ({ ...h, i })).filter((p) => p.us_aqi !== null)
  if (!pts.length) return <p>No hourly AQI values are available for this location.</p>
  const maxY = Math.max(150, Math.ceil(Math.max(...pts.map((p) => p.us_aqi)) / 50) * 50)
  const x = (i) => M.l + (i / (hourly.length - 1)) * (W - M.l - M.r)
  const y = (v) => H - M.b - (v / maxY) * (H - M.t - M.b)
  const line = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.us_aqi).toFixed(1)}`).join(' ')
  const future = pts.filter((p) => p.i >= nowIndex)
  const peak = future.reduce((a, b) => (b.us_aqi > a.us_aqi ? b : a), future[0] || pts[0])
  const low = future.reduce((a, b) => (b.us_aqi < a.us_aqi ? b : a), future[0] || pts[0])
  const ticks = hourly.map((h, i) => ({ h, i })).filter(({ h }) => ['00', '06', '12', '18'].includes(h.time.slice(11, 13)))
  const alt = `Line chart of US AQI for the last 24 hours and next 48 hours. Now: ${pts.find((p) => p.i === nowIndex)?.us_aqi ?? 'n/a'}. Highest ahead: ${peak.us_aqi} at ${peak.time.replace('T', ' ')}. Lowest ahead: ${low.us_aqi} at ${low.time.replace('T', ' ')}.`

  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={alt} className="min-w-[560px] w-full">
          {BAND_FILL.map((fill, k) => {
            const top = Math.min(BAND_EDGES[k + 1], maxY)
            return BAND_EDGES[k] < maxY ? <rect key={k} x={M.l} width={W - M.l - M.r} y={y(top)} height={y(BAND_EDGES[k]) - y(top)} fill={fill} /> : null
          })}
          {[0, 50, 100, 150, 200, 300].filter((v) => v <= maxY).map((v) => (
            <g key={v}><line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="#8795A0" strokeDasharray="3 3" /><text x={M.l - 6} y={y(v) + 4} textAnchor="end" fontSize="12" fill="#17232B">{v}</text></g>
          ))}
          {ticks.map(({ h, i }) => <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="12" fill="#17232B">{h.time.slice(11, 13) === '00' ? h.time.slice(5, 10) : hhmm(h.time)}</text>)}
          <line x1={x(nowIndex)} x2={x(nowIndex)} y1={M.t} y2={H - M.b} stroke="#17232B" strokeWidth="2" />
          <text x={x(nowIndex) + 4} y={M.t + 12} fontSize="12" fontWeight="700" fill="#17232B">Now</text>
          <path d={line} fill="none" stroke="#17232B" strokeWidth="3" strokeLinejoin="round" />
          <circle cx={x(peak.i)} cy={y(peak.us_aqi)} r="5" fill="#B42318" stroke="#fff" strokeWidth="2" />
          <circle cx={x(low.i)} cy={y(low.us_aqi)} r="5" fill="#1B7F4B" stroke="#fff" strokeWidth="2" />
        </svg>
      </div>
      <p className="mt-2 text-sm">Red dot: highest AQI ahead ({peak.us_aqi}, {peak.time.slice(5, 10)} {hhmm(peak.time)}). Green dot: lowest ahead ({low.us_aqi}, {low.time.slice(5, 10)} {hhmm(low.time)}). Shaded bands match the AQI categories.</p>
      <details className="mt-2">
        <summary className="cursor-pointer font-semibold">View chart data as a table</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Hourly US AQI and PM2.5</caption>
            <thead className="sticky top-0 bg-white"><tr><th scope="col" className="p-1">Time</th><th scope="col" className="p-1">US AQI</th><th scope="col" className="p-1">PM2.5 (µg/m³)</th></tr></thead>
            <tbody>{hourly.map((h, i) => (i % 2 === 0 || i === nowIndex) && <tr key={h.time} className={i === nowIndex ? 'font-bold' : ''}><td className="p-1">{h.time.replace('T', ' ')}{i === nowIndex ? ' (now)' : ''}</td><td className="p-1">{h.us_aqi ?? 'n/a'}</td><td className="p-1">{h.pm2_5 ?? 'n/a'}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
