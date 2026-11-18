import { useState } from 'react'
import { Briefcase, CheckCircle2, Globe, Home, Info, MapPin, Sparkles, Users } from 'lucide-react'
import { api } from '../api/client.js'
import { useApp } from '../context/AppContext.jsx'
import { Card, CheckField, ErrorBox, SelectField, Spinner, TextField } from './ui.jsx'

const DEFAULT = {
  location: null,
  language: 'English',
  household: { adults: 2, children: 0, older_adults: 0, respiratory_condition: false },
  commute: { mode: 'bus', minutes_one_way: 30 },
  lifestyle: {
    outdoor_exercise: 'occasional',
    works_from_home: false,
    schedule: 'regular_9_5',
    activity_preference: 'balanced',
  },
  indoor: {
    cooking_fuel: 'lpg',
    has_purifier: false,
    windows: 'normal',
    near_busy_road: false,
    has_range_hood: false,
  },
}

const num = (v) => (v === '' ? '' : Number(v))

export default function Onboarding({ onDone }) {
  const { profile, setProfile, setDemo } = useApp()
  const [form, setForm] = useState(profile || DEFAULT)
  const [query, setQuery] = useState(profile?.location?.name || '')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')

  const set = (group, key) => (e) => {
    const t = e.target
    const value = t.type === 'checkbox' ? t.checked : t.type === 'number' ? num(t.value) : t.value
    setForm((f) => ({ ...f, [group]: { ...f[group], [key]: value } }))
  }

  const setRoot = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function search(e) {
    e.preventDefault()
    if (query.trim().length < 2) return setError('Type at least 2 letters of a city or area.')
    setBusy(true)
    setError('')
    setResults([])
    try {
      const r = (await api.geocode(query.trim())).results
      setResults(r)
      if (!r.length) setError('No places found. Try a nearby larger city.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setError('Your browser does not support location. Search for a place instead.')
    setBusy(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setForm((f) => ({
          ...f,
          location: { name: 'My location', latitude: +p.coords.latitude.toFixed(2), longitude: +p.coords.longitude.toFixed(2) },
        }))
        setQuery('My location')
        setResults([])
        setBusy(false)
      },
      () => {
        setBusy(false)
        setError('Location permission was not given. Search for a place instead.')
      },
      { timeout: 10000, maximumAge: 600000 },
    )
  }

  function submit(e, demo = false) {
    e.preventDefault()
    if (!form.location) {
      setFieldError('Please choose a city or area first.')
      document.getElementById('place-search')?.focus()
      return
    }
    setFieldError('')
    setDemo(demo)
    setProfile(form)
    onDone?.()
  }

  const h = form.household

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {/* 1. Location & Language */}
      <Card title="1. Locality & Language Preferences" icon={MapPin}>
        <div className="grid gap-4 sm:grid-cols-3 mb-4">
          <div className="sm:col-span-2">
            <TextField
              id="place-search"
              label="City or Locality"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="For example: Mumbai, Delhi, Bengaluru, London"
              hint="Location entry is manual by default. Coordinates rounded to ~1 km to safeguard privacy."
              autoComplete="off"
              onKeyDown={(e) => e.key === 'Enter' && search(e)}
            />
          </div>
          <SelectField
            label="Preferred Language"
            value={form.language || 'English'}
            onChange={setRoot('language')}
            options={[
              ['English', 'English'],
              ['Hindi', 'हिंदी (Hindi)'],
              ['Marathi', 'मराठी (Marathi)'],
              ['Bengali', 'বাংলা (Bengali)'],
              ['Tamil', 'தமிழ் (Tamil)'],
              ['Telugu', 'తెలుగు (Telugu)'],
              ['Gujarati', 'ગુજરાતી (Gujarati)'],
            ]}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={search} disabled={busy}>
            Search Locality
          </button>
          <button type="button" className="btn-secondary text-xs" onClick={useMyLocation} disabled={busy}>
            Use Device Location
          </button>
        </div>

        {busy && <Spinner text="Looking up location via Open-Meteo geocoding…" />}
        {error && <div className="mt-3"><ErrorBox message={error} /></div>}

        {results.length > 0 && (
          <ul className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2" aria-label="Matching places">
            {results.map((r) => (
              <li key={`${r.latitude},${r.longitude}`}>
                <button
                  type="button"
                  className="w-full text-left rounded p-2 text-xs font-semibold text-ink hover:bg-pine-tint transition-colors"
                  onClick={() => {
                    setForm((f) => ({ ...f, location: r }))
                    setQuery(r.name)
                    setResults([])
                  }}
                >
                  📍 {r.name} ({r.latitude}, {r.longitude})
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs font-bold text-pine-dark" aria-live="polite">
          {form.location ? `Selected: ${form.location.name} (${form.location.latitude}, ${form.location.longitude})` : 'No location selected yet.'}
        </p>
        {fieldError && <p className="err mt-1 text-xs" role="alert">{fieldError}</p>}
      </Card>

      {/* 2. Household Composition */}
      <Card title="2. Household Members & Health Sensitivity" icon={Users}>
        <p className="mb-3 text-xs text-slate-500">
          No medical diagnoses or names are collected. Used strictly to establish conservative safety margins during severe smog.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Adults (18–64)" type="number" min="0" max="12" value={h.adults} onChange={set('household', 'adults')} />
          <TextField label="Children (under 18)" type="number" min="0" max="12" value={h.children} onChange={set('household', 'children')} />
          <TextField label="Seniors (65+)" type="number" min="0" max="12" value={h.older_adults} onChange={set('household', 'older_adults')} />
        </div>
        <div className="mt-3">
          <CheckField
            label="Household member with respiratory or cardiovascular sensitivity (asthma, COPD, heart condition)"
            hint="Escalates Moderate AQI guidance to cautious health protection."
            checked={h.respiratory_condition}
            onChange={set('household', 'respiratory_condition')}
          />
        </div>
      </Card>

      {/* 3. Schedule, Commute & Lifestyle */}
      <Card title="3. Daily Schedule, Commute & Activities" icon={Briefcase}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            label="Daily Work/School Schedule"
            value={form.lifestyle.schedule || 'regular_9_5'}
            onChange={set('lifestyle', 'schedule')}
            options={[
              ['regular_9_5', 'Standard Day (9 AM – 5 PM)'],
              ['morning_shift', 'Early Morning (6 AM – 2 PM)'],
              ['evening_shift', 'Afternoon/Evening (2 PM – 10 PM)'],
              ['flexible', 'Flexible / Varied Hours'],
              ['work_from_home', 'Primarily Work From Home'],
            ]}
          />
          <SelectField
            label="Primary Commute Mode"
            value={form.commute.mode}
            onChange={set('commute', 'mode')}
            options={[
              ['metro', 'Metro / Urban Train'],
              ['bus', 'Public Bus'],
              ['two_wheeler', 'Motorbike / Scooter'],
              ['car', 'Private Car'],
              ['walk', 'Walking'],
              ['bicycle', 'Bicycle'],
              ['other', 'Other Transit'],
            ]}
          />
          <TextField
            label="One-Way Commute (Minutes)"
            type="number"
            min="0"
            max="240"
            value={form.commute.minutes_one_way}
            onChange={set('commute', 'minutes_one_way')}
          />
          <SelectField
            label="Outdoor Workout Frequency"
            value={form.lifestyle.outdoor_exercise}
            onChange={set('lifestyle', 'outdoor_exercise')}
            options={[
              ['none', 'Rarely / None'],
              ['occasional', '1–2 times per week'],
              ['regular', 'Most days / Daily'],
            ]}
          />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <SelectField
            label="Activity Preferences"
            value={form.lifestyle.activity_preference || 'balanced'}
            onChange={set('lifestyle', 'activity_preference')}
            options={[
              ['balanced', 'Balanced (Indoor & Outdoor)'],
              ['mostly_indoor', 'Mostly Indoor Activities'],
              ['mostly_outdoor', 'Mostly Outdoor Activities'],
            ]}
          />
          <div className="pt-6">
            <CheckField
              label="I mostly work or study from home"
              checked={form.lifestyle.works_from_home}
              onChange={set('lifestyle', 'works_from_home')}
            />
          </div>
        </div>
      </Card>

      {/* 4. Indoor Environment */}
      <Card title="4. Indoor Home Conditions" icon={Home}>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Main Kitchen Cooking Fuel"
            value={form.indoor.cooking_fuel}
            onChange={set('indoor', 'cooking_fuel')}
            options={[
              ['electric', 'Electric / Induction (Lowest indoor emissions)'],
              ['lpg', 'LPG / Piped Natural Gas'],
              ['biomass', 'Biomass / Wood / Coal / Kerosene'],
            ]}
          />
          <SelectField
            label="Window Airtightness / Infiltration"
            value={form.indoor.windows}
            onChange={set('indoor', 'windows')}
            options={[
              ['sealed', 'Tight / Double-glazed / Weatherstripped'],
              ['normal', 'Standard residential windows'],
              ['leaky', 'Leaky / Noticeable gaps / Open grilles'],
            ]}
          />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <CheckField
            label="Home has an Air Purifier (HEPA)"
            checked={form.indoor.has_purifier}
            onChange={set('indoor', 'has_purifier')}
          />
          <CheckField
            label="Home is within 100m of a busy road"
            checked={form.indoor.near_busy_road}
            onChange={set('indoor', 'near_busy_road')}
          />
          <CheckField
            label="Kitchen has an exhaust fan / vented hood"
            checked={form.indoor.has_range_hood}
            onChange={set('indoor', 'has_range_hood')}
          />
        </div>
      </Card>

      {/* Submission Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="submit" className="btn-primary text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Generate My Personalized Air Quality Plan
        </button>
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={(e) => submit(e, true)}
        >
          Preview with Labelled Sample Data (Offline Mode)
        </button>
      </div>
    </form>
  )
}
