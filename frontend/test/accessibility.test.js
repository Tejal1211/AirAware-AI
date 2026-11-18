import test from 'node:test'
import assert from 'node:assert/strict'
import { TONE } from '../src/utils/format.js'

test('all TONE color combinations pair light backgrounds with deep high-contrast text', () => {
  for (const [key, classes] of Object.entries(TONE)) {
    assert.ok(typeof classes === 'string', `TONE[${key}] must be string`)
    // Validate that background has a dark text counterpart for WCAG AA compliance (4.5:1+)
    if (classes.includes('bg-emerald')) {
      assert.ok(classes.includes('text-emerald-950') || classes.includes('text-emerald-900'))
    }
    if (classes.includes('bg-amber')) {
      assert.ok(classes.includes('text-amber-950') || classes.includes('text-amber-900'))
    }
    if (classes.includes('bg-rose')) {
      assert.ok(classes.includes('text-rose-950') || classes.includes('text-rose-900'))
    }
    if (classes.includes('bg-purple')) {
      assert.ok(classes.includes('text-purple-950') || classes.includes('text-purple-900'))
    }
  }
})

test('TONE covers all required AQI categories without missing fallbacks', () => {
  const categories = ['good', 'moderate', 'usg', 'unhealthy', 'very_unhealthy', 'hazardous', 'unknown']
  for (const cat of categories) {
    assert.ok(TONE[cat], `Missing tone class for: ${cat}`)
  }
})
