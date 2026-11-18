import { useEffect, useState } from 'react'
import { AlertCircle, Camera, CheckCircle2, Eye, FileImage, Info, ShieldAlert, Sparkles, UploadCloud } from 'lucide-react'
import { api } from '../api/client.js'
import { Card, ErrorBox, Pill, Spinner } from './ui.jsx'

const MAX_MB = 5
const TYPES = ['image/jpeg', 'image/png', 'image/webp']
const METRIC_TEXT = {
  contrast_rms: ['Contrast (RMS)', 'Higher values indicate crisper distinction between light and shadow. Smog flattens scene contrast.'],
  edge_sharpness: ['Edge Acutance (Laplacian)', 'Measures high-frequency gradient variance. Atmospheric haze diffuses distant architectural edges.'],
  dark_channel_mean: ['Haze Indicator (Dark Channel Prior)', 'Lower indicates clearer conditions. He et al. Dark Channel prior: atmospheric aerosols lift shadow pixel intensities.'],
  saturation_mean: ['Color Saturation (HSV)', 'Aerosol scattering washes out natural sky, vegetation, and building colors.'],
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
    if (!TYPES.includes(f.type)) {
      setFile(null)
      return setState((s) => ({ ...s, error: 'Please choose a standard JPG, PNG or WebP photograph.' }))
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFile(null)
      return setState((s) => ({ ...s, error: `File size exceeds ${MAX_MB} MB. Please upload a smaller image.` }))
    }
    setFile(f)
  }

  async function analyze() {
    setState({ loading: true, error: '', result: null })
    try {
      setState({ loading: false, error: '', result: await api.haze(file) })
    } catch (e) {
      setState({ loading: false, error: e.message, result: null })
    }
  }

  const { loading, error, result } = state

  return (
    <div className="space-y-6">
      {/* Upload & Context Card */}
      <Card title="OpenCV Computer Vision Haze Analyzer" icon={Camera}>
        <div className="mb-4 rounded-xl border border-sky-300 bg-sky-50 p-4 text-xs text-sky-950">
          <div className="flex items-center gap-2 font-bold text-sky-900 mb-1">
            <Info className="h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
            <span>Important Scientific Disclaimer</span>
          </div>
          <p>
            This module evaluates <b>photographic visibility and image contrast</b> using real-time OpenCV algorithms (dark channel prior, Laplacian variance, and HSV saturation). It does <b>NOT</b> measure particulate concentration (PM2.5 / PM10) or toxic gases. Never base medical or safety decisions solely on photo analysis.
          </p>
        </div>

        <label htmlFor="haze-file" className="label flex items-center gap-1.5 font-bold text-sm text-ink">
          <UploadCloud className="h-4 w-4 text-pine" aria-hidden="true" />
          Upload skyline, street, or horizon photo (JPG, PNG or WebP, up to {MAX_MB} MB)
        </label>
        
        <input
          id="haze-file"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={choose}
          className="input file:mr-3 file:rounded-md file:border-0 file:bg-pine file:px-3 file:py-1.5 file:font-semibold file:text-white hover:file:bg-pine-dark cursor-pointer text-xs"
        />
        <p className="hint text-xs text-slate-500 mt-1">
          Photographs are processed entirely in server memory and never stored on disk. For optimal results, capture daylight scenes containing distant horizons or buildings.
        </p>

        <div className="mt-4">
          <button
            type="button"
            className="btn-primary flex items-center gap-2 text-sm"
            onClick={analyze}
            disabled={!file || loading}
          >
            {loading ? <Spinner text="Running OpenCV pipeline…" /> : <><Sparkles className="h-4 w-4" aria-hidden="true" /> Run OpenCV Haze Analysis</>}
          </button>
        </div>

        {error && <div className="mt-4"><ErrorBox message={error} /></div>}
        {!file && !error && !result && (
          <p className="mt-4 text-xs text-slate-500 flex items-center gap-1.5">
            <FileImage className="h-4 w-4 text-slate-400" aria-hidden="true" /> No photograph selected yet.
          </p>
        )}
      </Card>

      {/* Analysis Results */}
      {result && (
        <Card title="Computer Vision Analysis Output" icon={Eye} aria-live="polite">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Visual Images Comparison */}
            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1">1. Original Image</span>
                {preview && (
                  <img
                    src={preview}
                    alt="Uploaded user scene"
                    className="max-h-60 w-full rounded-xl border border-slate-200 object-contain bg-slate-100"
                  />
                )}
              </div>

              {result.dark_channel_preview && (
                <div>
                  <span className="text-xs font-bold text-slate-700 block mb-1">2. Processed Dark-Channel Haze Map (Viridis Colormap)</span>
                  <figure>
                    <img
                      src={result.dark_channel_preview}
                      alt="Dark-channel haze map"
                      className="max-h-48 rounded-xl border border-slate-200 object-contain shadow-sm"
                    />
                    <figcaption className="text-xs text-slate-500 mt-1">
                      Brighter areas reveal aerosol scattering where minimum RGB channel intensity is lifted by atmospheric haze.
                    </figcaption>
                  </figure>
                </div>
              )}
            </div>

            {/* Metrics & Categorization */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Visual Clarity Score</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-6xl font-black text-ink">{result.clarity_score}</span>
                <span className="text-xl font-bold text-slate-400">/ 100</span>
              </div>

              <div className="my-3">
                <Pill tone={result.tone}>{result.label}</Pill>
              </div>

              <p className="text-sm font-semibold text-slate-800">{result.summary}</p>

              {result.notes && result.notes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {result.notes.map((n) => (
                    <p key={n} className="text-xs font-medium text-amber-800 bg-amber-50 rounded p-1.5 border border-amber-200">
                      {n}
                    </p>
                  ))}
                </div>
              )}

              {/* Technical Indicator Breakdown */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-2">OpenCV Metric Breakdown:</h4>
                <dl className="space-y-2 text-xs">
                  {Object.entries(result.metrics)
                    .filter(([k]) => METRIC_TEXT[k])
                    .map(([k, v]) => (
                      <div key={k} className="border-b border-slate-200/60 pb-1.5 last:border-0">
                        <dt className="font-bold text-ink">{METRIC_TEXT[k][0]}: <span className="font-mono text-pine-dark">{v}</span></dt>
                        <dd className="text-slate-600 mt-0.5">{METRIC_TEXT[k][1]}</dd>
                      </div>
                    ))}
                </dl>
              </div>

              <p className="mt-4 text-xs text-slate-500">
                Processed resolution: {result.analyzed_size?.width} × {result.analyzed_size?.height} px (downscaled for efficiency). {result.disclaimer}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
