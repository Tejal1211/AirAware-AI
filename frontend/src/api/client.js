// Single place for network calls. Normalises every failure into an Error with a readable message.
export class ApiError extends Error {
  constructor(message, status, details = {}) {
    super(message)
    this.status = status
    this.details = details
  }
}

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`/api${path}`, options)
  } catch {
    throw new ApiError('Cannot reach the AirAware server. Check that the backend is running and your connection is working.', 0)
  }
  let data = null
  try { data = await res.json() } catch { /* non-JSON body */ }
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status}).`, res.status, data?.details || {})
  return data
}

const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  geocode: (q) => request(`/geocode?q=${encodeURIComponent(q)}`),
  plan: (profile, demo) => request('/plan', json({ profile, demo })),
  ask: (profile, question, demo) => request('/assistant', json({ profile, question, demo })),
  impact: (body) => request('/impact', json(body)),
  reports: (area = '') => request(`/reports?area=${encodeURIComponent(area)}`),
  report: (body) => request('/reports', json(body)),
  haze: (file) => { const f = new FormData(); f.append('image', file); return request('/haze/analyze', { method: 'POST', body: f }) },
}
