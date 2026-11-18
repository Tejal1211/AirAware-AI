import { useApp } from '../context/AppContext.jsx'
import ForecastChart from './ForecastChart.jsx'
import { Card, Pill, RecCard, SampleBanner } from './ui.jsx'
import { TONE, fmt } from '../utils/format.js'

const POLLUTANTS = [['pm2_5', 'PM2.5', 'Fine particles'], ['pm10', 'PM10', 'Coarse dust'], ['ozone', 'Ozone (O₃)', 'Gas'], ['nitrogen_dioxide', 'NO₂', 'Traffic gas'], ['sulphur_dioxide', 'SO₂', 'Gas'], ['carbon_monoxide', 'CO', 'Gas']]
const SEV = { danger: 'border-aqi-unhealthy bg-aqi-unhealthy-bg', warning: 'border-aqi-usg bg-aqi-usg-bg', info: 'border-aqi-moderate bg-aqi-moderate-bg', ok: 'border-aqi-good bg-aqi-good-bg' }
const SEV_LABEL = { danger: 'Danger', warning: 'Warning', info: 'Heads-up', ok: 'All clear' }

export default function Dashboard() {
  const { plan } = useApp()
  const { air, risk, trend, alerts } = plan
  const cur = air.current
  const key = cur.category_key
  const marker = cur.us_aqi === null ? 0 : Math.min(100, (cur.us_aqi / 300) * 100)
  const unit = (k) => air.units?.[k] || 'µg/m³'
  return (
    <div className="space-y-5">
      <SampleBanner source={air.source} />
      <section className={`rounded-2xl border-2 p-6 ${TONE[key]}`} aria-labelledby="aqi-head">
        <h2 id="aqi-head" className="text-sm font-bold">Current US AQI ({cur.time.replace('T', ' ')} local)</h2>
        <div className="mt-1 flex flex-wrap items-end gap-x-6 gap-y-2">
          <p className="text-7xl font-extrabold leading-none" aria-label={`US AQI ${cur.us_aqi ?? 'unavailable'}`}>{cur.us_aqi ?? 'n/a'}</p>
          <p className="text-2xl font-bold">{cur.category_label}</p>
        </div>
        <div className="relative mt-5 h-4 rounded-full" style={{ background: 'linear-gradient(90deg,#1B7F4B 0%,#C9A400 17%,#E07B00 33%,#B42318 50%,#7A2E8E 67%,#6B1D2B 100%)' }} aria-hidden="true">
          <span className="absolute -top-1.5 h-7 w-2 rounded bg-ink ring-2 ring-white" style={{ left: `calc(${marker}% - 4px)` }} />
        </div>
        <p className="mt-4 text-base font-semibold text-ink">{plan.headline}</p>
        <p className="mt-1 text-sm text-ink">{trend.text}</p>
      </section>

      <Card title="Alerts and forecast guidance" aria-live="polite">
        {alerts.length === 0 ? <p>No alerts: not enough forecast data.</p> : (
          <ul className="space-y-3">
            {alerts.map((a) => (
              <li key={a.id} className={`rounded-xl border-2 p-4 ${SEV[a.severity]}`}>
                <p className="font-bold"><span className="mr-2 rounded bg-ink px-2 py-0.5 text-xs text-white">{SEV_LABEL[a.severity]}</span>{a.title}</p>
                <p className="mt-1">{a.message}</p>
                <p className="mt-1 text-sm"><b>Why:</b> {a.why} <b>What to do:</b> {a.action}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Pollutants right now">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {POLLUTANTS.map(([k, name, note]) => (
            <li key={k} className="rounded-lg border border-mist p-3">
              <p className="text-sm font-semibold">{name} <span className="font-normal text-slate-700">· {note}</span></p>
              <p className="text-2xl font-bold">{fmt(cur[k], 1)} <span className="text-sm font-normal">{cur[k] == null ? '' : unit(k)}</span></p>
              {k === 'pm2_5' && cur.who_pm25_multiple != null && <p className="text-sm">{cur.who_pm25_multiple}× the WHO 24-hour guideline (15)</p>}
              {k === 'pm10' && cur.who_pm10_multiple != null && <p className="text-sm">{cur.who_pm10_multiple}× the WHO 24-hour guideline (45)</p>}
              {cur[k] == null && <p className="text-sm">Not available for this location</p>}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Trend and forecast: last 24 hours and next 48 hours"><ForecastChart hourly={air.hourly} nowIndex={air.now_index} /></Card>

      <Card title="Your top actions right now">
        <div className="grid gap-3 md:grid-cols-3">{plan.top_actions.map((r) => <RecCard key={r.id} r={r} />)}</div>
        {risk.adjusted && <p className="mt-3 text-sm">Because your household includes sensitive members, "Moderate" air is treated with extra care.</p>}
      </Card>

      <Card title="About this data">
        <p>Source: <b>{air.source.name}</b>. {air.source.note} Values use the US AQI scale, which differs from India's CPCB AQI, so numbers may not match local government displays.</p>
        <p className="mt-2 text-sm">{plan.disclaimer}</p>
      </Card>
    </div>
  )
}
