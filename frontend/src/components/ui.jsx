import { useId } from 'react'
import { TONE } from '../utils/format.js'

export const Card = ({ title, children, className = '', as: Tag = 'section', ...rest }) => (
  <Tag className={`card ${className}`} {...rest}>
    {title && <h2 className="mb-3 text-lg font-bold">{title}</h2>}
    {children}
  </Tag>
)

export function Field({ label, hint, error, children, id }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  )
}

export function TextField({ label, hint, error, ...props }) {
  const id = useId()
  return <Field label={label} hint={hint} error={error} id={id}><input id={id} className="input" aria-invalid={!!error} aria-describedby={hint ? `${id}-hint` : undefined} {...props} /></Field>
}

export function SelectField({ label, hint, error, options, ...props }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <select id={id} className="input" aria-invalid={!!error} {...props}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </Field>
  )
}

export function CheckField({ label, hint, ...props }) {
  const id = useId()
  return (
    <div className="flex min-h-[44px] items-start gap-3">
      <input id={id} type="checkbox" className="mt-1 h-6 w-6 shrink-0 accent-pine" {...props} />
      <label htmlFor={id} className="text-base"><span className="font-semibold">{label}</span>{hint && <span className="hint block">{hint}</span>}</label>
    </div>
  )
}

export const Spinner = ({ text = 'Loading…' }) => (
  <div role="status" aria-live="polite" className="flex items-center gap-3 p-4 text-slate-800">
    <span className="h-5 w-5 animate-spin rounded-full border-4 border-mist border-t-pine" aria-hidden="true" />{text}
  </div>
)

export const ErrorBox = ({ message, onRetry, children }) => (
  <div role="alert" className="rounded-xl border-2 border-aqi-unhealthy bg-aqi-unhealthy-bg p-4">
    <p className="font-bold text-aqi-unhealthy">Something needs attention</p>
    <p className="mt-1">{message}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {onRetry && <button className="btn-secondary" onClick={onRetry}>Try again</button>}
      {children}
    </div>
  </div>
)

export const EmptyState = ({ title, children }) => (
  <div className="rounded-xl border border-dashed border-slate-500 bg-white p-6 text-center">
    <p className="font-bold">{title}</p><p className="mt-1 text-slate-700">{children}</p>
  </div>
)

export const Pill = ({ tone = 'unknown', children }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-sm font-semibold ${TONE[tone] || TONE.unknown}`}>{children}</span>
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
  return (
    <article className="rounded-xl border border-mist bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold">{r.title}</h3>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
      </div>
      <p>{r.action}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div><dt className="inline font-bold">Why: </dt><dd className="inline">{r.why}</dd></div>
        <div><dt className="inline font-bold">Expected effect: </dt><dd className="inline">{r.expected_impact}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-slate-700">{BASIS[r.basis] || r.basis}</p>
    </article>
  )
}

export const RecList = ({ items, empty }) =>
  items?.length ? <div className="grid gap-3 md:grid-cols-2">{items.map((r) => <RecCard key={r.id} r={r} />)}</div> : <EmptyState title="Nothing to show yet">{empty}</EmptyState>

export const SampleBanner = ({ source }) =>
  source?.is_sample ? (
    <div role="note" className="rounded-xl border-2 border-aqi-usg bg-aqi-usg-bg p-3 font-semibold text-aqi-usg">
      SAMPLE DATA – these numbers are made up for demonstration and do not describe real air quality.
    </div>
  ) : null
