import { Calendar, CheckCircle2, Clock, Dumbbell, Home, Moon, ShieldAlert, Sparkles, Sun, Users } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Card, Pill, RecList } from './ui.jsx'
import { hhmm } from '../utils/format.js'

const PHASE_ICONS = {
  'Morning Routine': Sun,
  'Travel & Commute': Clock,
  'Exercise & Fitness': Dumbbell,
  'School & Workplace': Users,
  'Indoor Activity Alternatives': Sparkles,
  'Evening Routine': Home,
  'Ventilation Window': Calendar,
  'Night-Time Indoor Care': Moon,
}

export default function Planner() {
  const { plan } = useApp()
  const { blocks, best_window: best, worst_window: worst, recommendations, daily_schedule } = plan.planner

  return (
    <div className="space-y-6">
      {/* Best & Worst Windows Callout */}
      <Card title="Cleanest & Peak Exposure Windows (Next 24h)" icon={Clock}>
        {best ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 p-4 text-emerald-950">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Cleanest 2-Hour Window</span>
                <span className="rounded bg-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-900">Recommended</span>
              </div>
              <p className="mt-1 text-2xl font-black">{hhmm(best.start)} – {best.end}</p>
              <p className="mt-0.5 text-sm font-medium">Average US AQI ~{best.mean_aqi} ({best.category.label})</p>
              <p className="mt-2 text-xs text-emerald-800">Ideal window for outdoor exercise, walking pets, or brief natural room ventilation.</p>
            </div>

            {worst && (
              <div className="rounded-xl border-2 border-rose-400 bg-rose-50 p-4 text-rose-950">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-800">Highest Daytime Exposure</span>
                  <span className="rounded bg-rose-200 px-2 py-0.5 text-xs font-bold text-rose-900">Avoid</span>
                </div>
                <p className="mt-1 text-2xl font-black">{hhmm(worst.start)} – {worst.end}</p>
                <p className="mt-0.5 text-sm font-medium">Average US AQI ~{worst.mean_aqi} ({worst.category.label})</p>
                <p className="mt-2 text-xs text-rose-800">Keep windows tightly shut and avoid strenuous outdoor exertion during this interval.</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No hourly forecast available to compute optimal windows.</p>
        )}
      </Card>

      {/* 8-Phase Smart Daily Routine Generator */}
      {daily_schedule && daily_schedule.length > 0 && (
        <Card title="Smart 8-Phase Daily Routine Schedule" icon={Calendar}>
          <p className="mb-4 text-xs text-slate-600">
            Dynamically adapted to your household profile, local winter smog trends, and hourly atmospheric data.
          </p>
          <div className="space-y-3">
            {daily_schedule.map((item, idx) => {
              const IconComp = PHASE_ICONS[item.phase] || Clock
              return (
                <div key={item.phase} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pine-tint text-xs font-bold text-pine-dark">
                        {idx + 1}
                      </span>
                      <IconComp className="h-4 w-4 text-pine" aria-hidden="true" />
                      <h3 className="font-bold text-sm text-ink">{item.phase}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-500">{item.time}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
                        {item.status}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2.5 text-sm font-semibold text-ink">{item.action}</p>
                  
                  <div className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 sm:grid-cols-2">
                    <div>
                      <span className="font-bold text-ink">Context / Rationale: </span>
                      {item.why}
                    </div>
                    <div>
                      <span className="font-bold text-ink">Indoor Alternative: </span>
                      {item.indoor_alternative}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Time of Day Macro Blocks */}
      <Card title="Daytime Commute & Exposure Blocks" icon={Sun}>
        <div className="grid gap-3 md:grid-cols-3">
          {blocks.map((b) => (
            <div key={b.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-bold text-sm text-ink">{b.name}</h3>
              <p className="text-xs text-slate-500">{b.from} – {b.to}, {b.day}</p>
              <div className="my-2"><Pill tone={b.tone}>{b.status}</Pill></div>
              <p className="text-xs text-slate-700">Average AQI: <b>{b.mean_aqi ?? 'N/A'}</b> ({b.category.label})</p>
              {b.cleanest_hour && (
                <p className="mt-1 text-xs font-semibold text-emerald-800">
                  Cleanest hour: {b.cleanest_hour} (AQI {b.cleanest_hour_aqi})
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Targeted Recommendations List */}
      <Card title="Targeted Commute, School & Fitness Guidance" icon={CheckCircle2}>
        <RecList items={recommendations} empty="Add your household details in Onboarding to get personalized daily routines." />
      </Card>
    </div>
  )
}
