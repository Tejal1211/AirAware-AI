import { useId } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, HelpCircle, Info, ShieldAlert, Sparkles, Tag, Zap } from 'lucide-react'
import { TONE } from '../utils/format.js'

export const Card = ({ title, icon: Icon, children, className = '', as: TagElement = 'section', ...rest }) => {
  const headingId = useId()
  return (
    <TagElement className={`card ${className}`} aria-labelledby={title ? headingId : undefined} {...rest}>
      {title && (
        <div className="mb-3 flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-pine shrink-0" aria-hidden="true" />}
          <h2 id={headingId} className="text-lg font-bold text-ink">{title}</h2>
        </div>
      )}
      {children}
    </TagElement>
  )
}

export function Field({ label, hint, error, children, id }) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {hint && <p className="hint mt-1 text-xs text-slate-600" id={hintId}>{hint}</p>}
      {error && <p className="err mt-1 text-xs font-semibold text-rose-700" id={errorId} role="alert">{error}</p>}
    </div>
  )
}

export function TextField({ label, hint, error, id: propId, ...props }) {
  const genId = useId()
  const id = propId || genId
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <input
        id={id}
        className="input focus-visible:ring-2 focus-visible:ring-pine focus-visible:outline-none"
        aria-invalid={!!error}
        aria-describedby={describedBy}
        {...props}
      />
    </Field>
  )
}

export function SelectField({ label, hint, error, options, id: propId, ...props }) {
  const genId = useId()
  const id = propId || genId
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <select
        id={id}
        className="input focus-visible:ring-2 focus-visible:ring-pine focus-visible:outline-none"
        aria-invalid={!!error}
        aria-describedby={describedBy}
        {...props}
      >
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </Field>
  )
}

export function CheckField({ label, hint, id: propId, ...props }) {
  const genId = useId()
  const id = propId || genId
  const hintId = `${id}-hint`
  return (
    <div className="flex min-h-[44px] items-start gap-3">
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0 rounded border-mist text-pine accent-pine focus:ring-pine focus-visible:ring-2 focus-visible:outline-none"
        aria-describedby={hint ? hintId : undefined}
        {...props}
      />
      <label htmlFor={id} className="text-base cursor-pointer">
        <span className="font-semibold text-ink">{label}</span>
        {hint && <span className="hint block text-xs text-slate-600" id={hintId}>{hint}</span>}
      </label>
    </div>
  )
}

export const Spinner = ({ text = 'Loading…' }) => (
  <div role="status" aria-live="polite" className="flex items-center gap-3 p-4 text-slate-800">
    <span className="h-5 w-5 animate-spin rounded-full border-4 border-mist border-t-pine" aria-hidden="true" />
    <span className="font-medium">{text}</span>
  </div>
)

export const ErrorBox = ({ message, onRetry, children }) => (
  <div role="alert" className="rounded-xl border-2 border-aqi-unhealthy bg-aqi-unhealthy-bg p-4 text-ink">
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-5 w-5 text-aqi-unhealthy shrink-0" aria-hidden="true" />
      <p className="font-bold text-aqi-unhealthy">Something needs attention</p>
    </div>
    <p className="mt-1 text-sm">{message}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {onRetry && <button className="btn-secondary text-sm" onClick={onRetry}>Try again</button>}
      {children}
    </div>
  </div>
)

export const EmptyState = ({ title, children }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
    <Info className="mx-auto mb-2 h-8 w-8 text-slate-400" aria-hidden="true" />
    <p className="font-bold text-ink">{title}</p>
    <p className="mt-1 text-sm text-slate-600">{children}</p>
  </div>
)

export const Pill = ({ tone = 'unknown', children }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold ${TONE[tone] || TONE.unknown}`}>
    {children}
  </span>
)

const EFFECT = {
  personal_exposure: ['Lowers your exposure', 'bg-sky-100 text-sky-900 border-sky-800'],
  emission_reduction: ['Cuts emissions', 'bg-emerald-100 text-emerald-900 border-emerald-800'],
  both: ['Lowers exposure and emissions', 'bg-teal-100 text-teal-900 border-teal-800'],
  awareness: ['Awareness', 'bg-slate-200 text-slate-900 border-slate-700'],
}
const BASIS = { guideline: 'Based on public-health guidance', forecast: 'Based on your forecast', general_practice: 'General good practice' }

export function RecCard({ r }) {
  const [label, cls] = EFFECT[r.effect_type] || EFFECT.awareness
  const prioColors = {
    High: 'bg-rose-100 text-rose-800 border-rose-300',
    Medium: 'bg-amber-100 text-amber-800 border-amber-300',
    Low: 'bg-slate-100 text-slate-800 border-slate-300',
  }
  const prioText = r.priority_label || (r.priority === 1 ? 'High' : r.priority === 2 ? 'Medium' : 'Low')

  return (
    <article className="rounded-xl border border-mist bg-white p-4 shadow-sm hover:shadow transition-shadow">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-ink">{r.title}</h3>
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${prioColors[prioText] || prioColors.Medium}`}>
            {prioText}
          </span>
        </div>
      </div>
      <p className="text-sm font-medium text-slate-800">{r.action}</p>

      <div className="mt-3 space-y-1.5 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
        <div><span className="font-bold text-ink">Why:</span> {r.reason || r.why}</div>
        <div><span className="font-bold text-ink">Expected Benefit:</span> {r.benefit || r.expected_impact}</div>
        {r.timing && (
          <div className="flex items-center gap-1 pt-1 text-slate-600">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span><b>When:</b> {r.timing}</span>
            {r.difficulty && <span className="ml-2">· <b>Cost/Effort:</b> {r.difficulty}</span>}
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
        <span>{BASIS[r.basis] || r.basis}</span>
        {r.category && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium">{r.category}</span>}
      </div>
    </article>
  )
}

export function RecList({ items, empty = 'No recommendations right now.' }) {
  if (!items || items.length === 0) return <EmptyState title="Nothing to show">{empty}</EmptyState>
  return <div className="grid gap-3 md:grid-cols-2">{items.map((r) => <RecCard key={r.id || r.title} r={r} />)}</div>
}

export const SampleBanner = ({ source }) => {
  if (!source?.is_sample) return null
  return (
    <div role="note" className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
      <Info className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
      <span>Showing <b>SAMPLE DATA</b> for testing and offline demonstration. Real live readings will appear when connected.</span>
    </div>
  )
}
