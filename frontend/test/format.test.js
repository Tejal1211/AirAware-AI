import test from 'node:test'
import assert from 'node:assert/strict'
import { hhmm, fmt, TONE, BAND_EDGES } from '../src/utils/format.js'

test('hhmm formats ISO timestamps properly', () => {
  assert.equal(hhmm('2026-11-18T07:30:00'), '07:30')
  assert.equal(hhmm('2026-11-18T23:59:00'), '23:59')
  assert.equal(hhmm(''), '')
  assert.equal(hhmm(null), '')
})

test('fmt formats numbers and handles nullish values', () => {
  assert.equal(fmt(42.567, 1), '42.6')
  assert.equal(fmt(42, 0), '42')
  assert.equal(fmt(null), 'n/a')
  assert.equal(fmt(undefined), 'n/a')
})

test('TONE contains all expected AQI categories and aliases', () => {
  const expectedKeys = ['good', 'moderate', 'usg', 'unhealthy', 'very_unhealthy', 'hazardous', 'unknown', 'caution', 'avoid']
  for (const k of expectedKeys) {
    assert.ok(TONE[k], `Missing tone key: ${k}`)
    assert.ok(typeof TONE[k] === 'string')
  }
})

test('BAND_EDGES has standard AQI breakpoints', () => {
  assert.deepEqual(BAND_EDGES, [0, 50, 100, 150, 200, 300])
})
