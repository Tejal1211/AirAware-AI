import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts'
import { hhmm } from '../utils/format.js'
import { Info } from 'lucide-react'

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const aqi = data.aqi
    const cat = aqi == null ? 'Unavailable' : (
      aqi <= 50 ? 'Good' : (
        aqi <= 100 ? 'Moderate' : (
          aqi <= 150 ? 'Unhealthy for Sensitive Groups' : (
            aqi <= 200 ? 'Unhealthy' : (
              aqi <= 300 ? 'Very Unhealthy' : 'Hazardous'
            )
          )
        )
      )
    )
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md text-xs">
        <p className="font-bold text-ink">{data.fullTime.replace('T', ' ')}{data.isNow ? ' (Now)' : ''}</p>
        <p className="text-sm font-extrabold text-pine-dark mt-1">US AQI: {aqi ?? 'N/A'}</p>
        <p className="font-medium text-slate-700">Category: {cat}</p>
        {data.pm25 != null && <p className="text-slate-500">PM2.5: {data.pm25} µg/m³</p>}
      </div>
    )
  }
  return null
}

export default function ForecastChart({ hourly, nowIndex }) {
  const [showTable, setShowTable] = useState(false)
  const pts = hourly.map((h, i) => ({
    i,
    time: h.time.slice(11, 13) === '00' ? h.time.slice(5, 10) : hhmm(h.time),
    fullTime: h.time,
    aqi: h.us_aqi,
    pm25: h.pm2_5,
    isNow: i === nowIndex,
  }))

  const validPts = pts.filter((p) => p.aqi !== null)
  if (!validPts.length) return <p className="text-sm text-slate-500">No hourly AQI values are available for this location.</p>

  const future = validPts.filter((p) => p.i >= nowIndex)
  const peak = future.reduce((a, b) => (b.aqi > a.aqi ? b : a), future[0] || validPts[0])
  const low = future.reduce((a, b) => (b.aqi < a.aqi ? b : a), future[0] || validPts[0])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-600"></span>
            <b>Peak ahead:</b> {peak.aqi} ({peak.fullTime.slice(5, 10)} {hhmm(peak.fullTime)})
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600"></span>
            <b>Cleanest slot:</b> {low.aqi} ({low.fullTime.slice(5, 10)} {hhmm(low.fullTime)})
          </span>
        </div>
        <span className="text-slate-500">24 h history + 48 h forecast</span>
      </div>

      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={pts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="aqiGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0D5C3A" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#0D5C3A" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#475569' }} interval={5} />
            <YAxis tick={{ fontSize: 11, fill: '#475569' }} domain={[0, 'dataMax + 40']} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={50} stroke="#1B7F4B" strokeDasharray="3 3" label={{ value: 'Good (50)', fill: '#1B7F4B', fontSize: 10, position: 'insideTopRight' }} />
            <ReferenceLine y={100} stroke="#C9A400" strokeDasharray="3 3" label={{ value: 'Moderate (100)', fill: '#854D0E', fontSize: 10, position: 'insideTopRight' }} />
            <ReferenceLine y={150} stroke="#E07B00" strokeDasharray="3 3" label={{ value: 'USG (150)', fill: '#9A3412', fontSize: 10, position: 'insideTopRight' }} />
            <ReferenceLine y={200} stroke="#B42318" strokeDasharray="3 3" label={{ value: 'Unhealthy (200)', fill: '#B42318', fontSize: 10, position: 'insideTopRight' }} />
            <Area type="monotone" dataKey="aqi" stroke="#0D5C3A" strokeWidth={2.5} fillOpacity={1} fill="url(#aqiGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <span>Horizontal dashed lines mark US EPA AQI category thresholds.</span>
        </div>
        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          className="font-semibold text-pine hover:underline focus:outline-none"
        >
          {showTable ? 'Hide data table' : 'View as accessible data table'}
        </button>
      </div>

      {showTable && (
        <div className="max-h-60 overflow-y-auto rounded-lg border border-mist bg-slate-50 p-2">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Hourly US AQI and PM2.5 forecast</caption>
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-mist">
                <th scope="col" className="p-1.5 font-bold">Time</th>
                <th scope="col" className="p-1.5 font-bold">US AQI</th>
                <th scope="col" className="p-1.5 font-bold">PM2.5 (µg/m³)</th>
              </tr>
            </thead>
            <tbody>
              {hourly.map((h, i) => (
                <tr key={h.time} className={i === nowIndex ? 'bg-pine-tint font-bold' : 'border-b border-slate-100'}>
                  <td className="p-1.5">{h.time.replace('T', ' ')}{i === nowIndex ? ' (Now)' : ''}</td>
                  <td className="p-1.5">{h.us_aqi ?? 'N/A'}</td>
                  <td className="p-1.5">{h.pm2_5 ?? 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
