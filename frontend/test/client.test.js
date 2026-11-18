import test from 'node:test'
import assert from 'node:assert/strict'
import { api } from '../src/api/client.js'

test('api client is structured with all required module endpoints', () => {
  assert.ok(typeof api.health === 'function')
  assert.ok(typeof api.geocode === 'function')
  assert.ok(typeof api.airQuality === 'function')
  assert.ok(typeof api.plan === 'function')
  assert.ok(typeof api.assistant === 'function')
  assert.ok(typeof api.haze === 'function')
  assert.ok(typeof api.impact === 'function')
  assert.ok(typeof api.reports === 'function')
  assert.ok(typeof api.addReport === 'function')
})

test('api client handles network failure gracefully', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error('Network timeout')
  }
  try {
    await assert.rejects(
      async () => {
        await api.health()
      },
      (err) => {
        assert.equal(err.name, 'ApiError')
        assert.equal(err.status, 0)
        assert.ok(err.message.includes('Cannot reach the AirAware server'))
        return true
      }
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('api client parses structured JSON errors from backend', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: 'Invalid profile data', details: { 'location.latitude': 'Out of range' } }),
  })
  try {
    await assert.rejects(
      async () => {
        await api.plan({ profile: {} })
      },
      (err) => {
        assert.equal(err.message, 'Invalid profile data')
        assert.deepEqual(err.details, { 'location.latitude': 'Out of range' })
        return true
      }
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('api client constructs query parameters properly for geocode and airQuality', async () => {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    calls.push(url)
    return {
      ok: true,
      json: async () => ({ results: [] }),
    }
  }
  try {
    await api.geocode('Delhi')
    assert.ok(calls[0].includes('q=Delhi'))

    await api.airQuality(28.61, 77.21, true)
    assert.ok(calls[1].includes('lat=28.61'))
    assert.ok(calls[1].includes('lon=77.21'))
    assert.ok(calls[1].includes('demo=1'))
  } finally {
    globalThis.fetch = originalFetch
  }
})
