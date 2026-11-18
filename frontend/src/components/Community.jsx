import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { useApp } from '../context/AppContext.jsx'
import { Card, EmptyState, ErrorBox, RecList, SelectField, Spinner, TextField } from './ui.jsx'

const CATS = { visible_smog: 'Visible smog', burning_waste: 'Open burning of waste', construction_dust: 'Construction dust', vehicle_smoke: 'Smoky vehicles', industrial_smoke: 'Industrial smoke', other: 'Other' }
const SEV = { 1: 'Mild', 2: 'Noticeable', 3: 'Severe' }

export default function Community() {
  const { plan, profile } = useApp()
  const [area, setArea] = useState(profile.location.name === 'My location' ? '' : profile.location.name.split(',')[0])
  const [form, setForm] = useState({ category: 'burning_waste', severity: 2, note: '' })
  const [list, setList] = useState({ loading: true, error: '', data: null })
  const [post, setPost] = useState({ busy: false, error: '', fieldErrors: {}, ok: false })

  const load = useCallback(async () => {
    setList((l) => ({ ...l, loading: true, error: '' }))
    try { setList({ loading: false, error: '', data: await api.reports(area) }) } catch (e) { setList({ loading: false, error: e.message, data: null }) }
  }, [area])
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault()
    setPost({ busy: true, error: '', fieldErrors: {}, ok: false })
    try {
      await api.report({ ...form, severity: Number(form.severity), area })
      setPost({ busy: false, error: '', fieldErrors: {}, ok: true }); setForm({ ...form, note: '' }); load()
    } catch (err) { setPost({ busy: false, error: err.message, fieldErrors: err.details || {}, ok: false }) }
  }

  return (
    <div className="space-y-5">
      <Card title="Report a pollution source">
        <p className="mb-3">Reports are anonymous and unverified. Please do not include names, phone numbers or exact addresses. They are stored only in server memory and can be cleared at any restart.</p>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <TextField label="Neighbourhood or city" value={area} onChange={(e) => setArea(e.target.value)} maxLength={60} error={post.fieldErrors.area} required />
          <SelectField label="What did you see?" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={Object.entries(CATS)} error={post.fieldErrors.category} />
          <SelectField label="How bad is it?" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} options={Object.entries(SEV)} />
          <TextField label="Short note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={200} hint="Up to 200 characters." />
          <div className="sm:col-span-2"><button className="btn-primary" disabled={post.busy}>{post.busy ? 'Sending…' : 'Submit report'}</button></div>
        </form>
        <div aria-live="polite">
          {post.ok && <p className="mt-3 font-bold text-aqi-good">Report added. Thank you.</p>}
          {post.error && <div className="mt-3"><ErrorBox message={post.error} /></div>}
        </div>
      </Card>

      <Card title="Recent reports">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1"><TextField label="Filter by area" value={area} onChange={(e) => setArea(e.target.value)} /></div>
          <button className="btn-secondary" onClick={load}>Refresh list</button>
        </div>
        {list.loading && <Spinner text="Loading reports…" />}
        {list.error && <ErrorBox message={list.error} onRetry={load} />}
        {list.data && (list.data.reports.length === 0 ? <EmptyState title="No reports for this area yet">Be the first to log something you notice.</EmptyState> : (
          <>
            <p className="mb-2" aria-live="polite">{list.data.total} report(s). {Object.entries(list.data.by_category).map(([k, v]) => `${CATS[k]}: ${v}`).join(' · ')}</p>
            <ul className="space-y-2">
              {list.data.reports.map((r) => (
                <li key={r.id} className="rounded-lg border border-mist p-3"><p className="font-bold">{CATS[r.category]} · {SEV[r.severity]} · {r.area}</p>{r.note && <p>{r.note}</p>}<p className="text-sm text-slate-700">{r.created_at.replace('T', ' ')} UTC</p></li>
              ))}
            </ul>
            <p className="mt-2 text-sm">{list.data.note}</p>
          </>
        ))}
      </Card>

      <Card title="What a community can do"><RecList items={plan.community} /></Card>
    </div>
  )
}
