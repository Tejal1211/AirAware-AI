import { useState } from 'react'
import { api } from '../api/client.js'
import { useApp } from '../context/AppContext.jsx'
import { Card, CheckField, ErrorBox, RecList, SelectField, Spinner, TextField } from './ui.jsx'

export default function Sustainable() {
  const { plan, profile, demo } = useApp()
  const [f, setF] = useState({ from_mode: 'car_petrol', to_mode: 'metro', one_way_km: 10, days_per_week: 5, carpool_people: 3, outdoor_hours: 2, use_cleaner_window: true, use_purifier: false })
  const [s, setS] = useState({ loading: false, error: '', result: null })
  const on = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? Number(e.target.value) : e.target.value })

  async function submit(e) {
    e.preventDefault()
    setS({ loading: true, error: '', result: null })
    try {
      const result = await api.impact({
        emissions: { from_mode: f.from_mode, to_mode: f.to_mode, one_way_km: f.one_way_km, days_per_week: f.days_per_week, carpool_people: f.carpool_people },
        exposure: { outdoor_hours: f.outdoor_hours, use_cleaner_window: f.use_cleaner_window, use_purifier: f.use_purifier },
        location: profile.location, demo,
      })
      setS({ loading: false, error: '', result })
    } catch (err) { setS({ loading: false, error: err.message, result: null }) }
  }
  const { result: r } = s
  return (
    <div className="space-y-5">
      <Card title="Lower-emission ways to travel"><RecList items={plan.alternatives} empty="No alternatives apply to your current commute." /></Card>

      <Card title="Impact calculator">
        <p className="mb-4">Two different things are calculated separately: <b>emissions reduced</b> (less pollution released into the city) and <b>personal exposure reduced</b> (less pollution <i>you</i> breathe). Exposure steps do not cut emissions.</p>
        <form onSubmit={submit} className="space-y-5">
          <fieldset className="rounded-xl border border-mist p-4">
            <legend className="px-2 font-bold">A. Switching how you travel (emissions)</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Currently travel by" value={f.from_mode} onChange={on('from_mode')} options={[['car_petrol', 'Petrol car'], ['car_diesel', 'Diesel car'], ['two_wheeler', 'Motorbike or scooter']]} />
              <SelectField label="Switch to" value={f.to_mode} onChange={on('to_mode')} options={[['metro', 'Metro or train'], ['bus', 'Bus'], ['carpool', 'Carpool'], ['walk_cycle', 'Walk or cycle']]} />
              <TextField label="One-way distance (km)" type="number" min="0.1" max="100" step="0.1" value={f.one_way_km} onChange={on('one_way_km')} />
              <TextField label="Days per week" type="number" min="1" max="7" value={f.days_per_week} onChange={on('days_per_week')} />
              {f.to_mode === 'carpool' && <TextField label="People in the carpool (including you)" type="number" min="2" max="6" value={f.carpool_people} onChange={on('carpool_people')} />}
            </div>
          </fieldset>
          <fieldset className="rounded-xl border border-mist p-4">
            <legend className="px-2 font-bold">B. Protecting yourself (exposure)</legend>
            <TextField label="Hours outdoors per day" type="number" min="0" max="12" step="0.5" value={f.outdoor_hours} onChange={on('outdoor_hours')} />
            <CheckField label="Go out in the cleanest forecast slot" checked={f.use_cleaner_window} onChange={on('use_cleaner_window')} />
            <CheckField label="Run a purifier at home" checked={f.use_purifier} onChange={on('use_purifier')} />
          </fieldset>
          <button className="btn-primary" disabled={s.loading}>{s.loading ? 'Calculating…' : 'Calculate impact'}</button>
        </form>
        {s.loading && <Spinner text="Calculating…" />}
        {s.error && <div className="mt-4"><ErrorBox message={s.error} /></div>}
        {r && (
          <div className="mt-5 grid gap-4 md:grid-cols-2" aria-live="polite">
            <section className="rounded-xl border-2 border-aqi-good bg-aqi-good-bg p-4">
              <h3 className="font-bold text-aqi-good">Emissions reduced</h3>
              <p className="text-4xl font-extrabold">{r.emissions.saved_kg_co2e_week} <span className="text-lg">kg CO₂e / week</span></p>
              <p>About {r.emissions.saved_kg_co2e_month} kg per month and {r.emissions.saved_kg_co2e_year} kg per year ({r.emissions.percent_reduction}% less for these trips: {r.emissions.from} to {r.emissions.to}).</p>
              <p className="mt-2 text-sm">Only CO₂e is estimated. Particle and NOx savings are not quantified.</p>
            </section>
            <section className="rounded-xl border-2 border-sky-800 bg-sky-50 p-4">
              <h3 className="font-bold text-sky-900">Personal exposure reduced</h3>
              {r.exposure?.available ? (
                <>
                  <p className="text-4xl font-extrabold">{r.exposure.percent_reduction}%</p>
                  <p>Illustrative PM2.5 exposure index: {r.exposure.baseline_index} to {r.exposure.scenario_index} (µg/m³ × hours over 24 h). Typical daytime PM2.5 {r.exposure.typical_daytime_pm2_5} vs cleanest slot {r.exposure.cleaner_window_pm2_5}.</p>
                  <p className="mt-2 font-semibold">Emissions reduced by these steps: 0 kg. {r.exposure.note}</p>
                </>
              ) : <p>{r.exposure?.reason || 'Not calculated.'}</p>}
            </section>
            <details className="md:col-span-2"><summary className="cursor-pointer font-semibold">Assumptions and limits</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {r.assumptions.caveats.map((c) => <li key={c}>{c}</li>)}
                <li>Emission factors (g CO₂e per passenger-km): {Object.entries(r.assumptions.emission_factors_g_co2e_per_passenger_km).map(([k, v]) => `${k.replace('_', ' ')} ${v}`).join(', ')}.</li>
                <li>Indoor PM2.5 assumed {r.assumptions.indoor_to_outdoor_pm25_ratio * 100}% of outdoor ({r.assumptions.indoor_to_outdoor_pm25_ratio_with_purifier * 100}% with a purifier). These are illustrative.</li>
              </ul>
            </details>
          </div>
        )}
      </Card>
    </div>
  )
}
