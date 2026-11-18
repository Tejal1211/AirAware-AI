import { useApp } from '../context/AppContext.jsx'
import { Card, RecList } from './ui.jsx'
import { hhmm } from '../utils/format.js'

const AREAS = [['ventilation', 'Ventilation'], ['cooking', 'Cooking smoke'], ['dust', 'Dust'], ['filtration', 'Filtration']]

export default function IndoorAdvisor() {
  const { plan } = useApp()
  const { recommendations, best_ventilation_window: w } = plan.indoor
  return (
    <div className="space-y-5">
      <Card title="Best time to air your home">
        {w ? <p className="text-lg">Cleanest 2-hour slot: <b>{hhmm(w.start)}–{w.end}</b> (average AQI about {w.mean_aqi}, {w.category.label}).</p> : <p>No forecast data to suggest a slot.</p>}
        <p className="mt-1 text-sm">Outdoor AQI now is {plan.air.current.us_aqi ?? 'n/a'}. Advice below changes with outdoor air, your windows, cooking fuel and purifier.</p>
      </Card>
      {AREAS.map(([area, title]) => {
        const items = recommendations.filter((r) => r.area === area)
        return items.length ? <Card key={area} title={title}><RecList items={items} /></Card> : null
      })}
    </div>
  )
}
