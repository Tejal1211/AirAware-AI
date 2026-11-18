import { useState } from 'react'
import { api } from '../api/client.js'
import { useApp } from '../context/AppContext.jsx'
import { Card, CheckField, ErrorBox, SelectField, Spinner, TextField } from './ui.jsx'

const DEFAULT = {
  location: null,
  household: { adults: 2, children: 0, older_adults: 0, respiratory_condition: false },
  commute: { mode: 'bus', minutes_one_way: 30 },
  lifestyle: { outdoor_exercise: 'occasional', works_from_home: false },
  indoor: { cooking_fuel: 'lpg', has_purifier: false, windows: 'normal', near_busy_road: false, has_range_hood: false },
}
const num = (v) => (v === '' ? '' : Number(v))

/** Location search + household, commute, lifestyle and indoor questions. Nothing here identifies a person. */
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

  async function search(e) {
    e.preventDefault()
    if (query.trim().length < 2) return setError('Type at least 2 letters of a city or area.')
    setBusy(true); setError(''); setResults([])
    try {
      const r = (await api.geocode(query.trim())).results
      setResults(r)
      if (!r.length) setError('No places found. Try a nearby larger city.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setError('Your browser does not support location. Search for a place instead.')
    setBusy(true); setError('')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setForm((f) => ({ ...f, location: { name: 'My location', latitude: +p.coords.latitude.toFixed(2), longitude: +p.coords.longitude.toFixed(2) } }))
        setQuery('My location'); setResults([]); setBusy(false)
      },
      () => { setBusy(false); setError('Location permission was not given. Search for a place instead.') },
      { timeout: 10000, maximumAge: 600000 },
    )
  }

  function submit(e, demo = false) {
    e.preventDefault()
    if (!form.location) { setFieldError('Choose a location first.'); document.getElementById('place-search')?.focus(); return }
    setFieldError(''); setDemo(demo); setProfile(form); onDone?.()
  }

  const h = form.household
  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Card title="1. Where do you live?">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <TextField id="place-search" label="City or area" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="For example: Delhi" hint="Only approximate coordinates (about 1 km) are used and kept in this browser." autoComplete="off" onKeyDown={(e) => e.key === 'Enter' && search(e)} />
          </div>
          <button type="button" className="btn-secondary" onClick={search} disabled={busy}>Search</button>
          <button type="button" className="btn-secondary" onClick={useMyLocation} disabled={busy}>Use my location</button>
        </div>
        {busy && <Spinner text="Looking up location…" />}
        {error && <div className="mt-3"><ErrorBox message={error} /></div>}
        {results.length > 0 && (
          <ul className="mt-3 space-y-2" aria-label="Matching places">
            {results.map((r) => (
              <li key={`${r.latitude},${r.longitude}`}>
                <button type="button" className="btn-secondary w-full justify-start text-left" onClick={() => { setForm((f) => ({ ...f, location: r })); setQuery(r.name); setResults([]) }}>{r.name}</button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 font-semibold" aria-live="polite">{form.location ? `Selected: ${form.location.name} (${form.location.latitude}, ${form.location.longitude})` : 'No location selected yet.'}</p>
        {fieldError && <p className="err" role="alert">{fieldError}</p>}
      </Card>

      <Card title="2. Who is in your household?">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Adults" type="number" min="0" max="12" value={h.adults} onChange={set('household', 'adults')} />
          <TextField label="Children (under 18)" type="number" min="0" max="12" value={h.children} onChange={set('household', 'children')} />
          <TextField label="Adults 65 or older" type="number" min="0" max="12" value={h.older_adults} onChange={set('household', 'older_adults')} />
        </div>
        <div className="mt-3"><CheckField label="Someone has asthma, heart or lung disease" hint="Used only to make advice more cautious. It is not stored on a server." checked={h.respiratory_condition} onChange={set('household', 'respiratory_condition')} /></div>
      </Card>

      <Card title="3. Commute and lifestyle">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Main way of travelling" value={form.commute.mode} onChange={set('commute', 'mode')} options={[['walk', 'Walk'], ['bicycle', 'Bicycle'], ['two_wheeler', 'Motorbike or scooter'], ['car', 'Car'], ['bus', 'Bus'], ['metro', 'Metro or train'], ['other', 'Other']]} />
          <TextField label="Minutes each way" type="number" min="0" max="240" value={form.commute.minutes_one_way} onChange={set('commute', 'minutes_one_way')} />
          <SelectField label="Outdoor exercise" value={form.lifestyle.outdoor_exercise} onChange={set('lifestyle', 'outdoor_exercise')} options={[['none', 'Rarely'], ['occasional', 'Sometimes'], ['regular', 'Most days']]} />
        </div>
        <div className="mt-3"><CheckField label="I mostly work from home" checked={form.lifestyle.works_from_home} onChange={set('lifestyle', 'works_from_home')} /></div>
      </Card>

      <Card title="4. Your home">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Main cooking fuel" value={form.indoor.cooking_fuel} onChange={set('indoor', 'cooking_fuel')} options={[['electric', 'Electric or induction'], ['lpg', 'LPG or piped gas'], ['biomass', 'Wood, dung or charcoal']]} />
          <SelectField label="How airtight are the windows?" value={form.indoor.windows} onChange={set('indoor', 'windows')} options={[['sealed', 'Tight, few gaps'], ['normal', 'Normal'], ['leaky', 'Leaky, visible gaps']]} />
        </div>
        <div className="mt-3 grid gap-1 sm:grid-cols-3">
          <CheckField label="I have an air purifier" checked={form.indoor.has_purifier} onChange={set('indoor', 'has_purifier')} />
          <CheckField label="Home is near a busy road" checked={form.indoor.near_busy_road} onChange={set('indoor', 'near_busy_road')} />
          <CheckField label="Kitchen has a vented hood" checked={form.indoor.has_range_hood} onChange={set('indoor', 'has_range_hood')} />
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary">Get my air plan</button>
        <button type="button" className="btn-secondary" onClick={(e) => submit(e, true)}>Preview with labelled sample data</button>
      </div>
    </form>
  )
}
