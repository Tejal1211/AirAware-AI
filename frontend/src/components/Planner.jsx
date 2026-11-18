import { useApp } from '../context/AppContext.jsx'
import { Card, Pill, RecList } from './ui.jsx'
import { hhmm } from '../utils/format.js'

export default function Planner() {
  const { plan } = useApp()
  const { blocks, best_window: best, worst_window: worst, recommendations } = plan.planner
  return (
    <div className="space-y-5">
      <Card title="Cleanest and worst times in the next 24 hours">
        {best ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-aqi-good bg-aqi-good-bg p-4"><p className="font-bold text-aqi-good">Best slot for outdoor activity</p><p className="text-xl font-bold">{hhmm(best.start)}–{best.end}</p><p>Average AQI about {best.mean_aqi} ({best.category.label})</p></div>
            {worst && <div className="rounded-xl border-2 border-aqi-unhealthy bg-aqi-unhealthy-bg p-4"><p className="font-bold text-aqi-unhealthy">Worst daytime slot</p><p className="text-xl font-bold">{hhmm(worst.start)}–{worst.end}</p><p>Average AQI about {worst.mean_aqi} ({worst.category.label})</p></div>}
          </div>
        ) : <p>No forecast hours with AQI data are available.</p>}
        <p className="mt-3 text-sm">Windows are computed from the hourly forecast between 06:00 and 21:00 local time.</p>
      </Card>
      <Card title="Daily plan by time of day">
        <div className="grid gap-3 md:grid-cols-3">
          {blocks.map((b) => (
            <div key={b.name} className="rounded-xl border border-mist p-4">
              <h3 className="font-bold">{b.name}</h3>
              <p className="text-sm">{b.from}–{b.to}, {b.day}</p>
              <p className="my-2"><Pill tone={b.tone}>{b.status}</Pill></p>
              <p>Average AQI about <b>{b.mean_aqi ?? 'n/a'}</b> ({b.category.label}).</p>
              {b.cleanest_hour && <p className="text-sm">Cleanest hour: {b.cleanest_hour} (AQI {b.cleanest_hour_aqi}).</p>}
            </div>
          ))}
        </div>
      </Card>
      <Card title="Travel, exercise, school and work: what to do and why">
        <RecList items={recommendations} empty="Add your household details to get personalised routines." />
      </Card>
    </div>
  )
}
