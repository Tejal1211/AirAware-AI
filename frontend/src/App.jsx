import { useEffect, useRef, useState } from 'react'
import Assistant from './components/Assistant.jsx'
import Community from './components/Community.jsx'
import Dashboard from './components/Dashboard.jsx'
import HazeAnalyzer from './components/HazeAnalyzer.jsx'
import IndoorAdvisor from './components/IndoorAdvisor.jsx'
import Onboarding from './components/Onboarding.jsx'
import Planner from './components/Planner.jsx'
import Sustainable from './components/Sustainable.jsx'
import { ErrorBox, Spinner } from './components/ui.jsx'
import { useApp } from './context/AppContext.jsx'

const TABS = [
  ['dashboard', 'Air today', Dashboard], ['planner', 'Daily planner', Planner], ['indoor', 'Indoor air', IndoorAdvisor],
  ['assistant', 'Ask AI', Assistant], ['haze', 'Photo haze check', HazeAnalyzer], ['sustain', 'Travel and impact', Sustainable],
  ['community', 'Community', Community],
]

export default function App() {
  const { profile, plan, loading, error, refresh, demo, setDemo, clearProfile } = useApp()
  const [tab, setTab] = useState('dashboard')
  const [editing, setEditing] = useState(false)
  const heading = useRef(null)
  useEffect(() => { heading.current?.focus() }, [tab, editing])

  const Current = TABS.find(([k]) => k === tab)[2]
  const showSetup = !profile || editing

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-3 focus:font-bold">Skip to main content</a>
      <header className="border-b border-mist bg-ink text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div><p className="text-2xl font-extrabold">AirAware AI</p><p className="text-sm text-slate-200">Plan family life around winter smog</p></div>
          {profile && !showSetup && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{profile.location.name}</span>
              <button className="btn border border-white text-white hover:bg-white/10" onClick={() => refresh()}>Refresh data</button>
              <button className="btn border border-white text-white hover:bg-white/10" onClick={() => setEditing(true)}>Edit profile</button>
            </div>
          )}
        </div>
      </header>

      {!showSetup && (
        <nav aria-label="Sections" className="sticky top-0 z-10 border-b border-mist bg-white">
          <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2">
            {TABS.map(([k, label]) => (
              <li key={k}><button onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined} className={`min-h-[48px] whitespace-nowrap px-4 font-semibold ${tab === k ? 'border-b-4 border-pine text-pine-dark' : 'border-b-4 border-transparent text-slate-800 hover:bg-haze'}`}>{label}</button></li>
            ))}
          </ul>
        </nav>
      )}

      <main id="main" className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-extrabold outline-none">
          {showSetup ? 'Set up your household' : TABS.find(([k]) => k === tab)[1]}
        </h1>
        {showSetup ? (
          <>
            {!profile && <p className="max-w-prose text-lg">Tell us a little about your home and routine. We combine it with real air-quality data to give practical, explained advice. No names or accounts are needed.</p>}
            <Onboarding onDone={() => { setEditing(false); setTab('dashboard') }} />
            {profile && <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>}
          </>
        ) : (
          <>
            {demo && <div role="note" className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-aqi-usg bg-aqi-usg-bg p-3 font-semibold text-aqi-usg">Showing SAMPLE data. <button className="btn-secondary" onClick={() => setDemo(false)}>Switch to live data</button></div>}
            {loading && !plan && <Spinner text="Fetching air-quality data…" />}
            {error && (
              <ErrorBox message={error} onRetry={() => refresh()}>
                {!demo && <button className="btn-secondary" onClick={() => setDemo(true)}>Use labelled sample data instead</button>}
                <button className="btn-secondary" onClick={() => { clearProfile(); setEditing(false) }}>Start over</button>
              </ErrorBox>
            )}
            {plan && !error && <Current />}
          </>
        )}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-sm text-slate-700">
        Air data: Open-Meteo (modelled estimates, US AQI). General guidance only, not medical advice. Profile details stay in this browser.
        {profile && <> <button className="underline" onClick={() => { clearProfile(); setEditing(false) }}>Delete my saved profile</button></>}
      </footer>
    </>
  )
}
