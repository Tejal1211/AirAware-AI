import { useState } from 'react'
import { Bot, CheckCircle2, HelpCircle, Info, Send, ShieldAlert, Sparkles, User } from 'lucide-react'
import { api } from '../api/client.js'
import { useApp } from '../context/AppContext.jsx'
import { Card, ErrorBox, Spinner } from './ui.jsx'

const SUGGESTIONS = [
  'Should my child attend outdoor school practice today?',
  'What is the safest window to open home windows today?',
  'How should I commute given today\'s PM2.5 levels?',
  'Do cloth masks help with winter smog or do I need an N95?',
  'What should I do if my home is near a busy arterial road?',
]

export default function Assistant() {
  const { profile, demo } = useApp()
  const [q, setQ] = useState('')
  const [s, setS] = useState({ loading: false, error: '', answer: null, asked: '' })

  async function ask(question) {
    const text = (question ?? q).trim()
    if (text.length < 3) return setS({ ...s, error: 'Type a question of at least 3 characters.' })
    setS({ loading: true, error: '', answer: null, asked: text })
    try {
      const res = await api.ask(profile, text, demo)
      setS({ loading: false, error: '', answer: res, asked: text })
    } catch (e) {
      setS({ loading: false, error: e.message, answer: null, asked: text })
    }
  }

  const a = s.answer

  return (
    <div className="space-y-6">
      <Card title="AI Family Air Quality Assistant" icon={Sparkles}>
        <p className="mb-4 text-xs text-slate-600">
          Grounded exclusively on your local air measurements, hourly forecast, and your specific household profile. Powered by Google Gemini with a deterministic public-health rule engine fallback.
        </p>

        {/* User Context Summary */}
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <span className="font-bold text-ink">Active Context Passed to Assistant: </span>
          <span>{profile.location.name} · {profile.household.adults} adults, {profile.household.children} children, {profile.household.older_adults} seniors · Commute: {profile.commute.mode} ({profile.commute.minutes_one_way}m) · Cooking: {profile.indoor.cooking_fuel} · Purifier: {profile.indoor.has_purifier ? 'Yes' : 'No'}</span>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); ask() }}>
          <label htmlFor="q" className="label font-bold text-xs text-ink flex items-center gap-1.5">
            <HelpCircle className="h-4 w-4 text-pine" aria-hidden="true" />
            Ask any question about today's air, routines, or protective steps:
          </label>
          <textarea
            id="q"
            className="input min-h-[96px] text-sm"
            maxLength={500}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="For example: I travel by two-wheeler every morning at 8:30 AM. What precautions should I take?"
          />
          <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
            <span>Untrusted prompt injection defenses active</span>
            <span>{q.length}/500 characters</span>
          </div>

          <div className="mt-3">
            <span className="text-xs font-bold text-slate-700 block mb-1.5">Suggested Questions:</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
              {SUGGESTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="btn-secondary text-xs text-left py-1 px-2.5"
                  onClick={() => { setQ(t); ask(t) }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <button
              type="submit"
              className="btn-primary flex items-center gap-2 text-sm"
              disabled={s.loading}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {s.loading ? 'Thinking…' : 'Ask Assistant'}
            </button>
          </div>
        </form>

        <div aria-live="polite" className="mt-5">
          {s.loading && <Spinner text="Analyzing your household context and atmospheric forecast…" />}
          {s.error && <ErrorBox message={s.error} />}

          {a && (
            <div className="rounded-xl border border-mist bg-slate-50/80 p-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2 mb-3">
                <User className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <p className="text-xs font-bold text-slate-700">You asked: "{s.asked}"</p>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Bot className="h-5 w-5 text-pine" aria-hidden="true" />
                <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                  a.source === 'gemini'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}>
                  {a.source === 'gemini'
                    ? 'Generated by Google Gemini (Grounded on deterministic plan)'
                    : 'Rule-Based Fallback (Deterministic engine)'}
                </span>
                {a.basis?.is_sample_data && (
                  <span className="rounded-full bg-rose-100 text-rose-800 px-2.5 py-0.5 text-xs font-bold border border-rose-200">
                    SAMPLE DATA
                  </span>
                )}
              </div>

              <div className="whitespace-pre-line text-sm text-slate-800 leading-relaxed font-normal bg-white p-4 rounded-lg border border-slate-200">
                {a.answer}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between border-t border-slate-200 pt-2 text-xs text-slate-500">
                <span>Evaluated at US AQI {a.basis?.us_aqi ?? 'N/A'} ({a.basis?.category ?? 'Current'})</span>
                <span>{a.disclaimer}</span>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
