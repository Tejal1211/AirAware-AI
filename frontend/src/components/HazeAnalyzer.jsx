import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { Card, ErrorBox, Pill, Spinner } from './ui.jsx'

const MAX_MB = 5
const TYPES = ['image/jpeg', 'image/png', 'image/webp']
const METRIC_TEXT = {
  contrast_rms: ['Contrast', 'Higher is crisper. Haze flattens contrast.'],
  edge_sharpness: ['Edge detail', 'Higher means more fine detail in the scene.'],
  dark_channel_mean: ['Haze cue (dark channel)', 'Lower is clearer. Haze lifts the darkest pixels.'],
  saturation_mean: ['Colour saturation', 'Haze washes colours out.'],
}

export default function HazeAnalyzer() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [state, setState] = useState({ loading: false, error: '', result: null })

  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function choose(e) {
    const f = e.target.files?.[0]
    setState({ loading: false, error: '', result: null })
    if (!f) return setFile(null)
    if (!TYPES.includes(f.type)) { setFile(null); return setState((s) => ({ ...s, error: 'Choose a JPG, PNG or WebP photo.' })) }
    if (f.size > MAX_MB * 1024 * 1024) { setFile(null); return setState((s) => ({ ...s, error: `That file is larger than ${MAX_MB} MB. Choose a smaller photo.` })) }
    setFile(f)
  }

  async function analyze() {
    setState({ loading: true, error: '', result: null })
    try { setState({ loading: false, error: '', result: await api.haze(file) }) } catch (e) { setState({ loading: false, error: e.message, result: null }) }
  }

  const { loading, error, result } = state
  return (
    <div className="space-y-5">
      <Card title="Photo haze check">
        <p className="mb-3 rounded-lg bg-pine-tint p-3"><b>Important:</b> this tool measures how clear the <i>photo</i> looks. It does <b>not</b> measure AQI or PM2.5. Use it as a visual cue alongside the real data on the dashboard.</p>
        <label htmlFor="haze-file" className="label">Photo of your skyline or street (JPG, PNG or WebP, up to {MAX_MB} MB)</label>
        <input id="haze-file" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={choose} className="input file:mr-3 file:rounded file:border-0 file:bg-pine file:px-3 file:py-1 file:font-semibold file:text-white" />
        <p className="hint">Photos are analysed in memory and are not saved. For best results use daylight and include distant buildings or sky.</p>
        <div className="mt-4"><button className="btn-primary" onClick={analyze} disabled={!file || loading}>{loading ? 'Analysing…' : 'Analyse photo'}</button></div>
        {error && <div className="mt-4"><ErrorBox message={error} /></div>}
        {loading && <Spinner text="Analysing photo…" />}
        {!file && !error && !result && <p className="mt-4 text-slate-700">No photo chosen yet.</p>}
      </Card>

      {result && (
        <Card title="Result" aria-live="polite">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              {preview && <img src={preview} alt="The photo you uploaded" className="max-h-64 w-full rounded-lg border border-mist object-contain" />}
              {result.dark_channel_preview && <figure className="mt-3"><img src={result.dark_channel_preview} alt="Haze map: brighter areas show where the darkest pixels are lifted, a cue for haze" className="max-h-40 rounded-lg border border-mist" /><figcaption className="hint">Haze map (dark channel). Brighter means more haze-like.</figcaption></figure>}
            </div>
            <div>
              <p className="text-sm font-semibold">Visual clarity score</p>
              <p className="text-6xl font-extrabold" aria-label={`Visual clarity score ${result.clarity_score} out of 100`}>{result.clarity_score}<span className="text-2xl">/100</span></p>
              <p className="my-2"><Pill tone={result.tone}>{result.label}</Pill></p>
              <p>{result.summary}</p>
              {result.notes.map((n) => <p key={n} className="mt-2 font-semibold">{n}</p>)}
              <dl className="mt-4 space-y-2 text-sm">
                {Object.entries(result.metrics).filter(([k]) => METRIC_TEXT[k]).map(([k, v]) => (
                  <div key={k}><dt className="inline font-bold">{METRIC_TEXT[k][0]}: </dt><dd className="inline">{v}. {METRIC_TEXT[k][1]}</dd></div>
                ))}
              </dl>
            </div>
          </div>
          <p className="mt-4 rounded-lg bg-pine-tint p-3 text-sm">{result.disclaimer}</p>
        </Card>
      )}
    </div>
  )
}
