import { useState } from 'react'
import { AlertCircle, Bus, Calculator, Car, CheckCircle2, ChevronDown, Flame, Info, Leaf, ShieldAlert, Sparkles, TrendingDown, Wind, Zap } from 'lucide-react'
import { api } from '../api/client.js'
import { useApp } from '../context/AppContext.jsx'
import { Card, CheckField, ErrorBox, RecList, SelectField, Spinner, TextField } from './ui.jsx'

export default function Sustainable() {
  const { plan, profile, demo } = useApp()
  const [f, setF] = useState({
    from_mode: 'car_petrol',
    to_mode: 'metro',
    one_way_km: 10,
    days_per_week: 5,
    carpool_people: 3,
    outdoor_hours: 2,
    use_cleaner_window: true,
    use_purifier: true,
  })
  const [s, setS] = useState({ loading: false, error: '', result: null })

  const on = (k) => (e) =>
    setF({
      ...f,
      [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? Number(e.target.value) : e.target.value,
    })

  async function submit(e) {
    e.preventDefault()
    setS({ loading: true, error: '', result: null })
    try {
      const result = await api.impact({
        emissions: {
          from_mode: f.from_mode,
          to_mode: f.to_mode,
          one_way_km: f.one_way_km,
          days_per_week: f.days_per_week,
          carpool_people: f.carpool_people,
        },
        exposure: {
          outdoor_hours: f.outdoor_hours,
          use_cleaner_window: f.use_cleaner_window,
          use_purifier: f.use_purifier,
        },
        location: profile.location,
        demo,
      })
      setS({ loading: false, error: '', result })
    } catch (err) {
      setS({ loading: false, error: err.message, result: null })
    }
  }

  const { result: r } = s

  return (
    <div className="space-y-6">
      {/* Sustainable Lifestyle Recommendations */}
      <Card title="Sustainable Low-Emission Lifestyle Recommendations" icon={Leaf}>
        <p className="mb-4 text-xs text-slate-600">
          Realistic, actionable steps to curb urban vehicular emissions, eliminate waste burning, and transition to cleaner household practices.
        </p>
        <RecList items={plan.alternatives} empty="No specific alternative applies to your current commute profile." />
      </Card>

      {/* Interactive Impact Calculator */}
      <Card title="Interactive Personal & Community Impact Calculator" icon={Calculator}>
        {/* Core Distinction Notice */}
        <div className="mb-5 rounded-xl border border-teal-300 bg-teal-50 p-4 text-xs text-teal-950">
          <div className="flex items-center gap-2 font-bold text-teal-900 mb-1">
            <Info className="h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span>Strict Separation of Outcomes (Scientific Transparency)</span>
          </div>
          <p>
            This calculator evaluates two distinct dimensions separately:
          </p>
          <ul className="mt-1.5 list-disc pl-4 space-y-1">
            <li><b>A. Emission Reduction (kg CO₂e):</b> Less pollution released into the city's atmosphere through sustainable travel choices.</li>
            <li><b>B. Personal Exposure Reduction:</b> Less particulate matter (PM2.5) <i>you and your family inhale</i>. Exposure reduction steps (masks, purifiers, window timing) do not reduce city tailpipe emissions.</li>
          </ul>
        </div>

        <form onSubmit={submit} className="space-y-5">
          {/* Section A: Travel Mode Shift */}
          <fieldset className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <legend className="px-2 font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Car className="h-4 w-4 text-pine" aria-hidden="true" /> Section A: Vehicle Mode Shift (Emissions)
            </legend>
            <div className="grid gap-4 sm:grid-cols-2 mt-2">
              <SelectField
                label="Current Travel Mode"
                value={f.from_mode}
                onChange={on('from_mode')}
                options={[
                  ['car_petrol', 'Petrol Car (170 g CO₂e/km)'],
                  ['car_diesel', 'Diesel Car (165 g CO₂e/km)'],
                  ['two_wheeler', 'Motorbike / Scooter (90 g CO₂e/km)'],
                ]}
              />
              <SelectField
                label="Switch To Alternative"
                value={f.to_mode}
                onChange={on('to_mode')}
                options={[
                  ['metro', 'Metro / Urban Train (35 g CO₂e/km)'],
                  ['bus', 'Public Bus (80 g CO₂e/km)'],
                  ['carpool', 'Carpooling with Colleagues'],
                  ['walk_cycle', 'Walking or Cycling (0 g CO₂e/km)'],
                ]}
              />
              <TextField
                label="One-Way Distance (km)"
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={f.one_way_km}
                onChange={on('one_way_km')}
              />
              <TextField
                label="Commute Days per Week"
                type="number"
                min="1"
                max="7"
                value={f.days_per_week}
                onChange={on('days_per_week')}
              />
              {f.to_mode === 'carpool' && (
                <TextField
                  label="Total Occupants in Carpool"
                  type="number"
                  min="2"
                  max="6"
                  value={f.carpool_people}
                  onChange={on('carpool_people')}
                  hint="Includes driver and passengers."
                />
              )}
            </div>
          </fieldset>

          {/* Section B: Exposure Protection */}
          <fieldset className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <legend className="px-2 font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Wind className="h-4 w-4 text-pine" aria-hidden="true" /> Section B: Exposure Reduction (Personal Dosage)
            </legend>
            <div className="mt-2 space-y-3">
              <TextField
                label="Daily Outdoor Exposure Time (Hours)"
                type="number"
                min="0"
                max="12"
                step="0.5"
                value={f.outdoor_hours}
                onChange={on('outdoor_hours')}
                hint="Hours spent on streets, transit stops, or open grounds."
              />
              <CheckField
                label="Shift outdoor tasks to the cleanest daytime forecast window"
                checked={f.use_cleaner_window}
                onChange={on('use_cleaner_window')}
              />
              <CheckField
                label="Run a certified HEPA air purifier at home in bedrooms / living areas"
                checked={f.use_purifier}
                onChange={on('use_purifier')}
              />
            </div>
          </fieldset>

          <button
            type="submit"
            className="btn-primary flex items-center gap-2 text-sm"
            disabled={s.loading}
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
            {s.loading ? 'Calculating…' : 'Calculate Quantified Impact'}
          </button>
        </form>

        {s.loading && <Spinner text="Computing emissions & exposure models…" />}
        {s.error && <div className="mt-4"><ErrorBox message={s.error} /></div>}

        {r && (
          <div className="mt-6 grid gap-4 md:grid-cols-2" aria-live="polite">
            {/* Box 1: Emissions Saved */}
            <section className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-5 shadow-sm text-emerald-950">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-emerald-800">
                  A. Carbon Emissions Prevented
                </h3>
              </div>
              <p className="mt-2 text-5xl font-black">
                {r.emissions.saved_kg_co2e_week}{' '}
                <span className="text-sm font-semibold">kg CO₂e / week</span>
              </p>
              <p className="mt-1 text-xs text-emerald-900 font-medium">
                Equivalent to ~{r.emissions.saved_kg_co2e_month} kg per month and ~{r.emissions.saved_kg_co2e_year} kg per year ({r.emissions.percent_reduction}% reduction for these trips).
              </p>
              <div className="mt-3 rounded-lg bg-white/70 p-2.5 text-xs text-emerald-950">
                <p><b>Baseline:</b> {r.emissions.baseline_kg_co2e_week} kg CO₂e/week ({r.emissions.from})</p>
                <p><b>New Scenario:</b> {r.emissions.new_kg_co2e_week} kg CO₂e/week ({r.emissions.to})</p>
                <p className="text-slate-500 mt-1">Note: Only tailpipe CO₂e is estimated; toxic localized PM2.5/NOx reductions are qualitative.</p>
              </div>
            </section>

            {/* Box 2: Exposure Reduction */}
            <section className="rounded-2xl border-2 border-sky-400 bg-sky-50 p-5 shadow-sm text-sky-950">
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="h-5 w-5 text-sky-700" aria-hidden="true" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-sky-900">
                  B. Personal Exposure Reduction
                </h3>
              </div>
              {r.exposure?.available ? (
                <>
                  <p className="mt-2 text-5xl font-black">
                    {r.exposure.percent_reduction}%{' '}
                    <span className="text-sm font-semibold">Lower PM2.5 Dose</span>
                  </p>
                  <p className="mt-1 text-xs text-sky-900 font-medium">
                    Illustrative 24h intake index dropped from {r.exposure.baseline_index} to {r.exposure.scenario_index} (µg/m³ × hours).
                  </p>
                  <div className="mt-3 rounded-lg bg-white/70 p-2.5 text-xs text-sky-950">
                    <p><b>Emissions reduced by these exposure steps:</b> 0 kg CO₂e.</p>
                    <p className="mt-1 font-semibold text-slate-700">{r.exposure.note}</p>
                    <p className="text-slate-500 mt-1">Typical daytime outdoor PM2.5: {r.exposure.typical_daytime_pm2_5} µg/m³ vs Cleanest slot: {r.exposure.cleaner_window_pm2_5} µg/m³.</p>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-600 mt-2">{r.exposure?.reason || 'Exposure model unavailable for this location.'}</p>
              )}
            </section>

            {/* Transparent Assumptions */}
            <details className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-4 text-xs">
              <summary className="cursor-pointer font-bold text-slate-800 flex items-center justify-between">
                <span>View Mathematical Assumptions & Model Limitations</span>
                <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
              </summary>
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-slate-600">
                <ul className="list-disc pl-4 space-y-1">
                  {r.assumptions.caveats.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                  <li>
                    <b>Emission Factors Used:</b>{' '}
                    {Object.entries(r.assumptions.emission_factors_g_co2e_per_passenger_km)
                      .map(([k, v]) => `${k.replace('_', ' ')}: ${v} g/km`)
                      .join(' · ')}
                  </li>
                  <li>
                    <b>Indoor Infiltration Model:</b> Indoor PM2.5 is assumed at {r.assumptions.indoor_to_outdoor_pm25_ratio * 100}% of outdoor without purifier, and {r.assumptions.indoor_to_outdoor_pm25_ratio_with_purifier * 100}% with a correctly sized HEPA purifier running in a closed room.
                  </li>
                </ul>
              </div>
            </details>
          </div>
        )}
      </Card>
    </div>
  )
}
