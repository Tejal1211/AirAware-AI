import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Flame, Info, MapPin, RefreshCw, Send, ShieldAlert, Sparkles, Users } from 'lucide-react'
import { api } from '../api/client.js'
import { useApp } from '../context/AppContext.jsx'
import { Card, EmptyState, ErrorBox, RecList, SelectField, Spinner, TextField } from './ui.jsx'

const CATS = {
  burning_waste: 'Open Burning of Leaves / Waste',
  visible_smog: 'Dense Visible Smog Layer',
  construction_dust: 'Uncontrolled Construction Dust',
  vehicle_smoke: 'Grossly Polluting / Smoky Vehicles',
  industrial_smoke: 'Industrial Chimney Smoke Plume',
  other: 'Other Local Pollution Source',
}

const SEV = {
  1: 'Mild (localized nuisance)',
  2: 'Noticeable (irritating eyes/throat)',
  3: 'Severe (dense cloud, heavy smoke)',
}

export default function Community() {
  const { plan, profile } = useApp()
  const [area, setArea] = useState(profile.location.name === 'My location' ? '' : profile.location.name.split(',')[0])
  const [form, setForm] = useState({ category: 'burning_waste', severity: 2, note: '' })
  const [list, setList] = useState({ loading: true, error: '', data: null })
  const [post, setPost] = useState({ busy: false, error: '', fieldErrors: {}, ok: false })

  const load = useCallback(async () => {
    setList((l) => ({ ...l, loading: true, error: '' }))
    try {
      setList({ loading: false, error: '', data: await api.reports(area) })
    } catch (e) {
      setList({ loading: false, error: e.message, data: null })
    }
  }, [area])

  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault()
    setPost({ busy: true, error: '', fieldErrors: {}, ok: false })
    try {
      await api.report({ ...form, severity: Number(form.severity), area })
      setPost({ busy: false, error: '', fieldErrors: {}, ok: true })
      setForm({ ...form, note: '' })
      load()
    } catch (err) {
      setPost({ busy: false, error: err.message, fieldErrors: err.details || {}, ok: false })
    }
  }

  return (
    <div className="space-y-6">
      {/* Community Transparency Banner */}
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
        <div className="flex items-center gap-2 font-bold text-amber-900 mb-1">
          <Info className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <span>Citizen Observation Platform (Privacy First)</span>
        </div>
        <p>
          Community-submitted observations are <b>unverified citizen reports</b>, not certified environmental monitor readings. Never include personal names, telephone numbers, or precise house addresses. Reports are stored anonymously in volatile memory.
        </p>
      </div>

      {/* Report Form */}
      <Card title="Report a Visible Smoke or Smog Hotspot" icon={AlertTriangle}>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Neighbourhood or City Area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            maxLength={60}
            error={post.fieldErrors.area}
            placeholder="e.g. Rohini Sector 14, Delhi"
            required
          />
          <SelectField
            label="What pollution activity did you observe?"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            options={Object.entries(CATS)}
            error={post.fieldErrors.category}
          />
          <SelectField
            label="Severity Level"
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value })}
            options={Object.entries(SEV)}
          />
          <TextField
            label="Brief Observation Note (Optional)"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            maxLength={200}
            placeholder="e.g. Pile of dry leaves smoldering near park gate"
            hint="Up to 200 characters without personal data."
          />
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="btn-primary flex items-center gap-2 text-sm"
              disabled={post.busy}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {post.busy ? 'Submitting…' : 'Submit Anonymous Report'}
            </button>
          </div>
        </form>

        <div aria-live="polite">
          {post.ok && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-bold text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <span>Report successfully posted to community feed. Thank you for citizen vigilance.</span>
            </div>
          )}
          {post.error && <div className="mt-3"><ErrorBox message={post.error} /></div>}
        </div>
      </Card>

      {/* Recent Community Feed */}
      <Card title="Recent Neighborhood Citizen Reports" icon={Users}>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <TextField label="Filter Feed by Area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Type city or sector…" />
          </div>
          <button type="button" className="btn-secondary text-xs flex items-center gap-1.5" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh Feed
          </button>
        </div>

        {list.loading && <Spinner text="Loading localized citizen reports…" />}
        {list.error && <ErrorBox message={list.error} onRetry={load} />}

        {list.data && (list.data.reports.length === 0 ? (
          <EmptyState title="No citizen reports logged for this area yet">
            Be the first to log an unverified local smoke hotspot or dust event.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-600" aria-live="polite">
              Total {list.data.total} active observation(s) in this filter window:
            </p>
            <ul className="space-y-2.5">
              {list.data.reports.map((r) => (
                <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-100 pb-1.5">
                    <span className="font-bold text-ink">{CATS[r.category] || r.category}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                      {SEV[r.severity]?.split('(')[0] || `Level ${r.severity}`}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-pine shrink-0" aria-hidden="true" />
                    <span className="font-semibold text-ink">{r.area}</span>
                    <span className="text-slate-400">· {r.created_at.replace('T', ' ')} UTC</span>
                  </div>
                  {r.note && <p className="mt-1 text-slate-700 font-normal italic">"{r.note}"</p>}
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">{list.data.note}</p>
          </div>
        ))}
      </Card>

      {/* Community Action Tips */}
      <Card title="Collective Community Actions for Clean Air" icon={Sparkles}>
        <p className="mb-3 text-xs text-slate-600">
          Neighborhood scale interventions that housing societies, schools, and resident welfare associations (RWAs) can adopt to reduce ground-level winter smog.
        </p>
        <RecList items={plan.community} />
      </Card>
    </div>
  )
}
