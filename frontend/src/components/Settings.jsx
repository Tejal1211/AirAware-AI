import { useState } from 'react'
import { CheckCircle2, Globe, HardDrive, Key, MapPin, RefreshCw, Settings as SettingsIcon, ShieldCheck, Trash2, Users } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Card } from './ui.jsx'

export default function Settings({ onEditProfile }) {
  const { profile, clearProfile, demo, setDemo } = useApp()
  const [cleared, setCleared] = useState(false)

  if (!profile) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        <p>No active profile configured yet. Please complete onboarding.</p>
      </div>
    )
  }

  function handleReset() {
    if (window.confirm('Are you sure you want to delete your saved household profile? This will clear all locally stored preferences.')) {
      clearProfile()
      setCleared(true)
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Application & Household Profile Settings" icon={SettingsIcon}>
        <p className="mb-4 text-xs text-slate-600">
          Manage your saved preferences. All data is kept exclusively in your browser's private local storage; no names, telephone numbers, or identifiers are transmitted or stored on any server.
        </p>

        {/* Current Active Profile Overview */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 mb-3">
            <span className="font-bold text-sm text-ink flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-pine" aria-hidden="true" />
              {profile.location.name} ({profile.location.latitude}, {profile.location.longitude})
            </span>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={onEditProfile}
            >
              Edit Household Profile
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <span className="text-slate-500 block">Preferred Language</span>
              <b className="text-ink">{profile.language || 'English'}</b>
            </div>
            <div>
              <span className="text-slate-500 block">Household Composition</span>
              <b className="text-ink">
                {profile.household.adults} adults · {profile.household.children} children · {profile.household.older_adults} seniors
              </b>
            </div>
            <div>
              <span className="text-slate-500 block">Health Vulnerability Flag</span>
              <b className={profile.household.respiratory_condition ? 'text-amber-800' : 'text-slate-700'}>
                {profile.household.respiratory_condition ? 'Asthma / Heart condition indicated' : 'None reported'}
              </b>
            </div>
            <div>
              <span className="text-slate-500 block">Daily Commute</span>
              <b className="capitalize text-ink">{profile.commute.mode} ({profile.commute.minutes_one_way} mins one-way)</b>
            </div>
            <div>
              <span className="text-slate-500 block">Kitchen Environment</span>
              <b className="capitalize text-ink">Fuel: {profile.indoor.cooking_fuel} · Exhaust: {profile.indoor.has_range_hood ? 'Yes' : 'No'}</b>
            </div>
            <div>
              <span className="text-slate-500 block">Air Filtration</span>
              <b className="text-ink">{profile.indoor.has_purifier ? 'HEPA Purifier Present' : 'No Purifier'}</b>
            </div>
          </div>
        </div>

        {/* Demo Mode Toggle */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <span className="font-bold text-sm text-ink block">Offline Demonstration / Sample Mode</span>
            <span className="text-xs text-slate-500">
              {demo ? 'Currently using clearly labelled mock winter smog data for demonstration.' : 'Currently using live Open-Meteo environmental data.'}
            </span>
          </div>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => setDemo(!demo)}
          >
            {demo ? 'Switch to Live Environmental API' : 'Switch to Labelled Sample Data'}
          </button>
        </div>

        {/* Privacy & Storage Section */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-ink">
            <ShieldCheck className="h-4 w-4 text-pine" aria-hidden="true" />
            <span>Privacy & Storage Guarantees</span>
          </div>
          <p className="text-slate-600">
            AirAware AI is designed with privacy-preserving principles: zero tracking cookies, zero persistent databases of user identifiers, and coarse coordinate truncation (~1 km).
          </p>
          <div className="pt-2">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 font-bold text-rose-800 hover:bg-rose-100 transition-colors"
              onClick={handleReset}
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-700" aria-hidden="true" />
              Delete Saved Local Profile & Reset All Data
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}
