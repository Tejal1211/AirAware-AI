import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock, Droplets, Flame, Gauge, Info, ShieldAlert, Sparkles, Wind } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import ForecastChart from './ForecastChart.jsx'
import { Card, Pill, RecCard, SampleBanner } from './ui.jsx'
import { TONE, fmt } from '../utils/format.js'

const POLLUTANTS = [
  ['pm2_5', 'PM2.5', 'Fine particulate matter', Wind],
  ['pm10', 'PM10', 'Coarse dust & particles', Droplets],
  ['ozone', 'Ozone (O₃)', 'Ground-level photochemical gas', Activity],
  ['nitrogen_dioxide', 'NO₂', 'Traffic exhaust emission', Flame],
  ['sulphur_dioxide', 'SO₂', 'Industrial combustion gas', Gauge],
  ['carbon_monoxide', 'CO', 'Incomplete combustion gas', AlertTriangle],
]

const SEV = {
  danger: 'border-rose-400 bg-rose-50 text-rose-900',
  warning: 'border-amber-400 bg-amber-50 text-amber-900',
  info: 'border-sky-300 bg-sky-50 text-sky-900',
  ok: 'border-emerald-300 bg-emerald-50 text-emerald-900',
}

export default function Dashboard({ onNavigateToAssistant }) {
  const { plan } = useApp()
  const { air, risk, trend, alerts } = plan
  const cur = air.current
  const key = cur.category_key
  const marker = cur.us_aqi === null ? 0 : Math.min(100, (cur.us_aqi / 300) * 100)
  const unit = (k) => air.units?.[k] || 'µg/m³'

  return (
    <div className="space-y-6">
      <SampleBanner source={air.source} />

      {/* Main AQI Gauge Card */}
      <section className={`rounded-2xl border-2 p-6 shadow-sm ${TONE[key]}`} aria-labelledby="aqi-head">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wind className="h-5 w-5 text-ink" aria-hidden="true" />
            <h2 id="aqi-head" className="text-sm font-bold text-ink">
              Current Air Quality ({cur.time ? cur.time.replace('T', ' ') : 'Live'})
            </h2>
          </div>
          <span className="rounded-full bg-white/80 px-3 py-0.5 text-xs font-bold shadow-sm text-ink backdrop-blur">
            US EPA AQI Standard
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="text-7xl font-black tracking-tight" aria-label={`US AQI ${cur.us_aqi ?? 'unavailable'}`}>
            {cur.us_aqi ?? 'N/A'}
          </p>
          <div>
            <p className="text-2xl font-extrabold">{cur.category_label}</p>
            <p className="text-xs font-semibold text-slate-700">
              {risk.sensitive_household ? 'Household includes children, seniors, or respiratory sensitivity' : 'General household profile'}
            </p>
          </div>
        </div>

        {/* Visual Progress Gradient */}
        <div className="relative mt-5 h-3.5 rounded-full shadow-inner" style={{ background: 'linear-gradient(90deg,#1B7F4B 0%,#C9A400 17%,#E07B00 33%,#B42318 50%,#7A2E8E 67%,#6B1D2B 100%)' }} aria-hidden="true">
          <span className="absolute -top-1 h-6 w-2.5 rounded bg-ink ring-2 ring-white shadow" style={{ left: `calc(${marker}% - 5px)` }} />
        </div>

        <div className="mt-5 rounded-xl bg-white/70 p-3.5 backdrop-blur">
          <p className="text-base font-bold text-ink">{plan.headline}</p>
          <p className="mt-0.5 text-xs text-slate-700">{trend.text}</p>
        </div>
      </section>

      {/* Smart Alerts */}
      <Card title="Forecast Alerts & Smart Safeguards" icon={ShieldAlert} aria-live="polite">
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-600">No active alerts for the next 24 hours.</p>
        ) : (
          <ul className="space-y-3">
            {alerts.map((a) => (
              <li key={a.id} className={`rounded-xl border p-4 shadow-sm ${SEV[a.severity] || SEV.info}`}>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-ink px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                    {a.severity}
                  </span>
                  <p className="font-bold text-sm text-ink">{a.title}</p>
                </div>
                <p className="mt-1.5 text-sm">{a.message}</p>
                <div className="mt-2 text-xs text-slate-700 space-y-0.5">
                  <p><b>Why:</b> {a.why}</p>
                  <p><b>Action:</b> {a.action}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* AI Assistant Quick Prompt */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-pine/30 bg-pine-tint p-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-pine shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold text-sm text-pine-dark">Need personalized advice for today's smog?</p>
            <p className="text-xs text-slate-700">Ask AirAware AI about school runs, outdoor practice, or safe ventilation windows.</p>
          </div>
        </div>
        {onNavigateToAssistant && (
          <button type="button" onClick={onNavigateToAssistant} className="btn-primary text-xs flex items-center gap-1.5">
            Ask AI Assistant <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* 6 Pollutants Grid */}
      <Card title="Live Pollutant Concentrations" icon={Activity}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {POLLUTANTS.map(([k, name, note, IconComponent]) => (
            <div key={k} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold text-ink">{name}</span>
                <IconComponent className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </div>
              <p className="text-2xl font-black text-ink">
                {fmt(cur[k], 1)} <span className="text-xs font-normal text-slate-500">{cur[k] == null ? '' : unit(k)}</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{note}</p>
              {k === 'pm2_5' && cur.who_pm25_multiple != null && (
                <p className={`mt-1.5 text-xs font-bold ${cur.who_pm25_multiple > 1 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {cur.who_pm25_multiple}× WHO 24h limit (15)
                </p>
              )}
              {k === 'pm10' && cur.who_pm10_multiple != null && (
                <p className={`mt-1.5 text-xs font-bold ${cur.who_pm10_multiple > 1 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {cur.who_pm10_multiple}× WHO 24h limit (45)
                </p>
              )}
              {cur[k] == null && <p className="mt-1.5 text-xs text-slate-400">Not monitored at this grid point</p>}
            </div>
          ))}
        </div>
      </Card>

      {/* Forecast Chart */}
      <Card title="Hourly Forecast & Trend (Recharts)" icon={Clock}>
        <ForecastChart hourly={air.hourly} nowIndex={air.now_index} />
      </Card>

      {/* Top Actions */}
      <Card title="Immediate Priority Actions" icon={CheckCircle2}>
        <div className="grid gap-3 md:grid-cols-3">
          {plan.top_actions.map((r) => <RecCard key={r.id || r.title} r={r} />)}
        </div>
        {risk.adjusted && (
          <p className="mt-3 text-xs text-slate-600">
            Note: "Moderate" air quality is escalated to cautious guidance because sensitive household members were specified.
          </p>
        )}
      </Card>

      {/* Environmental Data Standards & Transparency */}
      <Card title="Data Source & Measurement Standards" icon={Info}>
        <div className="space-y-2 text-xs text-slate-700">
          <p>
            <b>Data Provider:</b> {air.source.name}. Atmospheric modeling is powered by the Copernicus Atmosphere Monitoring Service (CAMS) via Open-Meteo.
          </p>
          <p>
            <b>Index Transparency:</b> Numerical AQI figures displayed here represent the <b>US EPA Air Quality Index</b>. Note that European AQI (CAQI) and India's Central Pollution Control Board (CPCB) NAQI scale use different sub-index calculation formulas and breakpoints.
          </p>
          <p className="text-slate-500 pt-1 border-t border-slate-100">
            {plan.disclaimer}
          </p>
        </div>
      </Card>
    </div>
  )
}
