import { useEffect, useRef, useState } from 'react'
import { Calendar, Camera, Home, Leaf, MapPin, RefreshCw, Settings as SettingsIcon, ShieldAlert, Sparkles, Users, Wind } from 'lucide-react'
import Assistant from './components/Assistant.jsx'
import Community from './components/Community.jsx'
import Dashboard from './components/Dashboard.jsx'
import HazeAnalyzer from './components/HazeAnalyzer.jsx'
import IndoorAdvisor from './components/IndoorAdvisor.jsx'
import Onboarding from './components/Onboarding.jsx'
import Planner from './components/Planner.jsx'
import Settings from './components/Settings.jsx'
import Sustainable from './components/Sustainable.jsx'
import { ErrorBox, Spinner } from './components/ui.jsx'
import { useApp } from './context/AppContext.jsx'

const TABS = [
  ['dashboard', 'Dashboard', Dashboard, Wind],
  ['planner', 'Daily Planner', Planner, Calendar],
  ['indoor', 'Indoor Air Advisor', IndoorAdvisor, Home],
  ['assistant', 'AI Assistant', Assistant, Sparkles],
  ['haze', 'Visual Haze Analyzer', HazeAnalyzer, Camera],
  ['sustain', 'Travel & Impact', Sustainable, Leaf],
  ['community', 'Community', Community, Users],
  ['settings', 'Settings', Settings, SettingsIcon],
]

export default function App() {
  const { profile, plan, loading, error, refresh, demo, setDemo, clearProfile } = useApp()
  const [tab, setTab] = useState('dashboard')
  const [editing, setEditing] = useState(false)
  const heading = useRef(null)

  useEffect(() => {
    heading.current?.focus()
  }, [tab, editing])

  const tabItem = TABS.find(([k]) => k === tab) || TABS[0]
  const Current = tabItem[2]
  const showSetup = !profile || editing

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:p-3 focus:font-bold focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="border-b border-mist bg-ink text-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine text-white shadow-sm">
              <Wind className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xl font-black tracking-tight leading-tight">AirAware AI</p>
              <p className="text-xs text-slate-300 font-medium">Urban Air Quality & Family Safety Assistant</p>
            </div>
          </div>

          {profile && !showSetup && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 font-semibold text-slate-200">
                <MapPin className="h-3.5 w-3.5 text-pine" aria-hidden="true" />
                {profile.location.name}
              </span>
              <button
                type="button"
                className="btn border border-white/20 text-white hover:bg-white/10 text-xs py-1 px-2.5 flex items-center gap-1"
                onClick={() => refresh()}
                title="Refresh atmospheric data"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" /> Refresh
              </button>
              <button
                type="button"
                className="btn border border-white/20 text-white hover:bg-white/10 text-xs py-1 px-2.5"
                onClick={() => setEditing(true)}
              >
                Edit Profile
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Navigation Bar with WAI-ARIA Accessible Tablist */}
      {!showSetup && (
        <nav aria-label="Application Sections" className="sticky top-0 z-20 border-b border-mist bg-white shadow-xs">
          <ul
            role="tablist"
            aria-label="AirAware Navigation Tabs"
            className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 scrollbar-none"
          >
            {TABS.map(([k, label, , TabIcon], idx) => {
              const active = tab === k
              return (
                <li key={k} role="presentation">
                  <button
                    id={`tab-${k}`}
                    role="tab"
                    aria-selected={active}
                    aria-controls={`panel-${k}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => setTab(k)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight') {
                        e.preventDefault()
                        const next = TABS[(idx + 1) % TABS.length][0]
                        setTab(next)
                        document.getElementById(`tab-${next}`)?.focus()
                      } else if (e.key === 'ArrowLeft') {
                        e.preventDefault()
                        const prev = TABS[(idx - 1 + TABS.length) % TABS.length][0]
                        setTab(prev)
                        document.getElementById(`tab-${prev}`)?.focus()
                      }
                    }}
                    className={`flex min-h-[48px] items-center gap-2 whitespace-nowrap px-3.5 text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-pine focus-visible:outline-none ${
                      active
                        ? 'border-b-2 border-pine text-pine-dark'
                        : 'border-b-2 border-transparent text-slate-600 hover:text-ink hover:bg-slate-100/60'
                    }`}
                  >
                    <TabIcon className={`h-4 w-4 ${active ? 'text-pine' : 'text-slate-400'}`} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      )}

      {/* Main Content Area */}
      <main id="main" role="main" className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6">
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-black text-ink outline-none">
          {showSetup ? 'Personalized Household Onboarding' : tabItem[1]}
        </h1>

        {showSetup ? (
          <>
            {!profile && (
              <p className="max-w-prose text-sm text-slate-600">
                Welcome to AirAware AI. Please provide brief details about your locality, household members, and daily routines to calibrate your real-time risk assessment and smart daily routine. All data is kept strictly inside your browser.
              </p>
            )}
            <Onboarding onDone={() => { setEditing(false); setTab('dashboard') }} />
            {profile && (
              <div className="pt-2">
                <button type="button" className="btn-secondary text-sm" onClick={() => setEditing(false)}>
                  Cancel Editing
                </button>
              </div>
            )}
          </>
        ) : (
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-6">
            {demo && (
              <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900 shadow-xs">
                <span>Displaying <b>SAMPLE DEMO DATA</b> for testing and evaluation.</span>
                <button type="button" className="btn-secondary text-xs" onClick={() => setDemo(false)}>
                  Switch to Live Environmental API
                </button>
              </div>
            )}

            {loading && !plan && <Spinner text="Fetching live environmental data from Open-Meteo…" />}

            {error && (
              <ErrorBox message={error} onRetry={() => refresh()}>
                {!demo && (
                  <button type="button" className="btn-secondary text-xs" onClick={() => setDemo(true)}>
                    Use Labelled Sample Data Instead
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => { clearProfile(); setEditing(false) }}
                >
                  Start Over
                </button>
              </ErrorBox>
            )}

            {plan && !error && (
              <Current
                onNavigateToAssistant={() => setTab('assistant')}
                onEditProfile={() => setEditing(true)}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4">
          <p>
            AirAware AI · Open-Meteo & Copernicus CAMS Modelled Data · US EPA AQI Standard · General Health & Safety Guidance (Not Medical Advice).
          </p>
          {profile && (
            <button
              type="button"
              className="text-slate-600 hover:text-rose-700 underline"
              onClick={() => { clearProfile(); setEditing(false) }}
            >
              Reset Saved Profile
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
