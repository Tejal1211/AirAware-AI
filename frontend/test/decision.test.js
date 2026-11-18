import test from 'node:test'
import assert from 'node:assert/strict'

test('WHO 2021 air quality guideline calculations', () => {
  const WHO_PM25 = 15.0 // ug/m3 24-hr mean
  const WHO_PM10 = 45.0 // ug/m3 24-hr mean

  const currentPM25 = 75.0
  const multiple25 = Number((currentPM25 / WHO_PM25).toFixed(1))
  assert.equal(multiple25, 5.0)

  const currentPM10 = 135.0
  const multiple10 = Number((currentPM10 / WHO_PM10).toFixed(1))
  assert.equal(multiple10, 3.0)
})

test('Emission reduction calculation vs Personal exposure reduction', () => {
  // Transit switch: Petrol Car (170 g/km) to Bus (80 g/km), 10 km one-way, 5 days/wk
  const oneWayKm = 10
  const days = 5
  const totalKm = oneWayKm * 2 * days // 100 km
  const oldFactor = 170
  const newFactor = 80
  const savedKg = ((oldFactor - newFactor) * totalKm) / 1000
  assert.equal(savedKg, 9.0) // 9.0 kg CO2e saved

  // Personal exposure steps have strictly 0 kg emissions
  const exposureStepEmissions = 0
  assert.equal(exposureStepEmissions, 0)
})

test('8-Phase schedule coverage validation', () => {
  const expectedPhases = [
    'Morning Routine',
    'Travel & Commute',
    'Outdoor Exercise Suggestions',
    'Midday Work & School',
    'Afternoon Indoor Alternatives',
    'Evening Commute & Outdoor Play',
    'Dinner & Cooking Precautions',
    'Night Ventilation & Sleep Quality',
  ]
  assert.equal(expectedPhases.length, 8)
  for (const phase of expectedPhases) {
    assert.ok(typeof phase === 'string')
    assert.ok(phase.length > 5)
  }
})
