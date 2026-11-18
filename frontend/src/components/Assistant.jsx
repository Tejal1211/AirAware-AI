import { useState } from 'react'
import { api } from '../api/client.js'
import { useApp } from '../context/AppContext.jsx'
import { Card, ErrorBox, Spinner } from './ui.jsx'

const SUGGESTIONS = ['Is it safe for my kids to play outside today?', 'Should I open the windows?', 'What is the best way to travel to work today?', 'Do masks help?']

export default function Assistant() {
  const { profile, demo } = useApp()
  const [q, setQ] = useState('')
  const [s, setS] = useState({ loading: false, error: '', answer: null, asked: '' })

  async function ask(question) {
    const text = (question ?? q).trim()
    if (text.length < 3) return setS({ ...s, error: 'Type a question of at least 3 characters.' })
    setS({ loading: true, error: '', answer: null, asked: text })
    try { setS({ loading: false, error: '', answer: await api.ask(profile, text, demo), asked: text }) } catch (e) { setS({ loading: false, error: e.message, answer: null, asked: text }) }
  }
  const a = s.answer
  return (
    <Card title="Ask AirAware">
      <p className="mb-3">Answers use your location's air data and your household details. Google Gemini writes the reply when it is available; otherwise the app answers from its built-in decision rules and says so.</p>
      <form onSubmit={(e) => { e.preventDefault(); ask() }}>
        <label htmlFor="q" className="label">Your question</label>
        <textarea id="q" className="input min-h-[96px]" maxLength={500} value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example: Should my 6-year-old go to football practice at 5 pm?" />
        <p className="hint">{q.length}/500 characters</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
          {SUGGESTIONS.map((t) => <button key={t} type="button" className="btn-secondary text-left" onClick={() => { setQ(t); ask(t) }}>{t}</button>)}
        </div>
        <div className="mt-4"><button className="btn-primary" disabled={s.loading}>{s.loading ? 'Thinking…' : 'Ask'}</button></div>
      </form>
      <div aria-live="polite" className="mt-4">
        {s.loading && <Spinner text="Preparing your answer…" />}
        {s.error && <ErrorBox message={s.error} />}
        {a && (
          <div className="rounded-xl border border-mist bg-haze p-4">
            <p className="text-sm font-semibold">You asked: {s.asked}</p>
            <p className="my-2 inline-block rounded-full bg-pine-tint px-3 py-0.5 text-sm font-bold text-pine-dark">
              {a.source === 'gemini' ? 'Written by Google Gemini from your data' : 'Rule-based answer (Gemini unavailable, so built-in decision rules were used)'}
            </p>
            {a.basis.is_sample_data && <p className="font-bold text-aqi-usg">Based on SAMPLE data.</p>}
            <div className="whitespace-pre-line">{a.answer}</div>
            <p className="mt-3 text-sm">Based on US AQI {a.basis.us_aqi ?? 'n/a'} ({a.basis.category}). {a.disclaimer}</p>
          </div>
        )}
      </div>
    </Card>
  )
}
