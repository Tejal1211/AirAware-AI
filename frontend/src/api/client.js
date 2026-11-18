/**
 * Unified API Client for AirAware AI REST services.
 * Handles request construction, JSON normalization, and error wrapping.
 */

/**
 * Standardized API Error class carrying HTTP status code and field-level validation details.
 */
export class ApiError extends Error {
  /**
   * @param {string} message - Human-readable error message.
   * @param {number} status - HTTP status code (0 for network failure).
   * @param {Record<string, string>} [details={}] - Field-specific error mappings.
   */
  constructor(message, status, details = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

/**
 * Core HTTP request handler.
 * @param {string} path - API endpoint path starting with leading slash.
 * @param {RequestInit} [options={}] - Standard fetch options.
 * @returns {Promise<any>}
 */
async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`/api${path}`, options)
  } catch (err) {
    throw new ApiError('Cannot reach the AirAware server. Check that the backend is running and your connection is working.', 0)
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    /* non-JSON response body */
  }
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status}).`, res.status, data?.details || {})
  }
  return data
}

/**
 * Helper to build JSON POST request options.
 * @param {any} body - JSON serializable object.
 * @returns {RequestInit}
 */
const json = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

/**
 * API methods mapped to backend endpoints.
 */
export const api = {
  /** Check server health and Gemini configuration. */
  health: () => request('/health'),

  /** Search localities by place name. */
  geocode: (q) => request(`/geocode?q=${encodeURIComponent(q)}`),

  /** Fetch current atmospheric pollutants and trend. */
  airQuality: (lat, lon, demo = false) =>
    request(`/air-quality?lat=${lat}&lon=${lon}${demo ? '&demo=1' : ''}`),

  /** Fetch 48-72h forecast series and optimal windows. */
  forecast: (lat, lon, demo = false) =>
    request(`/forecast?lat=${lat}&lon=${lon}${demo ? '&demo=1' : ''}`),

  /** Generate complete air safety plan and 8-phase daily schedule. */
  plan: (profile, demo = false) => request('/plan', json({ profile, demo })),

  /** Generate structured recommendations. */
  recommendations: (profile, demo = false) => request('/recommendations', json({ profile, demo })),

  /** Natural language AI assistant chat query. */
  ask: (profile, question, demo = false) => request('/assistant', json({ profile, question, demo })),

  /** Alias for assistant. */
  assistant: (profile, question, demo = false) => request('/assistant', json({ profile, question, demo })),

  /** Calculate emission savings and personal exposure index. */
  impact: (body) => request('/impact', json(body)),

  /** List anonymized community reports. */
  reports: (area = '') => request(`/reports?area=${encodeURIComponent(area)}`),

  /** Submit community pollution observation. */
  report: (body) => request('/reports', json(body)),

  /** Alias for submitting community report. */
  addReport: (body) => request('/reports', json(body)),

  /** Upload outdoor photograph for OpenCV haze clarity analysis. */
  haze: (file) => {
    const f = new FormData()
    f.append('image', file)
    return request('/haze/analyze', { method: 'POST', body: f })
  },
}
