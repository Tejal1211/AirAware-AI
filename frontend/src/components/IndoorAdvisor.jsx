import { AlertCircle, CheckCircle2, Fan, Flame, Home, Info, Sparkles, Wind } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Card, RecList } from './ui.jsx'
import { hhmm } from '../utils/format.js'

const SECTIONS = [
  { area: 'ventilation', title: 'Natural Ventilation & Infiltration Control', icon: Wind, desc: 'Balance fresh air exchange against incoming outdoor particulate infiltration.' },
  { area: 'cooking', title: 'Cooking Smoke & Kitchen Exhaust Management', icon: Flame, desc: 'Kitchen emissions are the leading indoor source of ultrafine particles and acrolein.' },
  { area: 'dust', title: 'Dust Control & Safe Cleaning Protocols', icon: Sparkles, desc: 'Prevent settled particulate matter from resuspending into your breathing zone.' },
  { area: 'filtration', title: 'Air Purifier Guidance & Filter Maintenance', icon: Fan, desc: 'Ensure mechanical filtration operates at peak Clean Air Delivery Rate (CADR).' },
]

export default function IndoorAdvisor() {
  const { plan, profile } = useApp()
  const { recommendations, best_ventilation_window: w } = plan.indoor
  const ind = profile.indoor

  return (
    <div className="space-y-6">
      {/* Ventilation Timing Banner */}
      <Card title="Optimal Natural Airing Window" icon={Wind}>
        {w ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Cleanest Airing Slot</span>
              <span className="rounded bg-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-900">{w.category.label}</span>
            </div>
            <p className="mt-1 text-2xl font-black">{hhmm(w.start)} – {w.end}</p>
            <p className="mt-0.5 text-xs font-medium">Forecast Average US AQI ~{w.mean_aqi}</p>
            <p className="mt-2 text-xs text-emerald-900">
              During high smog periods, air your living space for only 10–15 minutes during this specific window to purge stale indoor carbon dioxide (CO₂) and cooking VOCs, then reseal windows.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No hourly forecast data is currently available to model a ventilation window.</p>
        )}
      </Card>

      {/* Household Profile Context Summary */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
        <p className="font-bold text-ink">Household Indoor Profile Under Evaluation:</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded bg-white p-2 border border-slate-200">
            <span className="text-slate-500 block">Cooking Fuel</span>
            <b className="capitalize text-ink">{ind.cooking_fuel}</b>
          </div>
          <div className="rounded bg-white p-2 border border-slate-200">
            <span className="text-slate-500 block">Window Tightness</span>
            <b className="capitalize text-ink">{ind.windows}</b>
          </div>
          <div className="rounded bg-white p-2 border border-slate-200">
            <span className="text-slate-500 block">Purifier Available</span>
            <b className="text-ink">{ind.has_purifier ? 'Yes (HEPA)' : 'None reported'}</b>
          </div>
          <div className="rounded bg-white p-2 border border-slate-200">
            <span className="text-slate-500 block">Road Proximity</span>
            <b className="text-ink">{ind.near_busy_road ? 'Near arterial road' : 'Set back from traffic'}</b>
          </div>
        </div>
      </div>

      {/* Scientific Reality Check on Houseplants */}
      <div className="rounded-xl border-2 border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-950">
        <div className="flex items-center gap-2 font-bold text-amber-900 mb-1">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <span>Scientific Fact: Houseplants vs. True HEPA Filtration</span>
        </div>
        <p>
          While potted plants enhance room aesthetics and biophilic well-being, scientific research confirms they <b>cannot</b> meaningfully remove fine particulate smog (PM2.5) or substitute for a certified mechanical HEPA air purifier in typical home volumes.
        </p>
      </div>

      {/* Detailed Advice Sections */}
      {SECTIONS.map(({ area, title, icon: IconComp, desc }) => {
        const items = recommendations.filter((r) => r.area === area)
        if (!items.length) return null
        return (
          <Card key={area} title={title} icon={IconComp}>
            <p className="mb-3 text-xs text-slate-600">{desc}</p>
            <RecList items={items} />
          </Card>
        )
      })}
    </div>
  )
}
