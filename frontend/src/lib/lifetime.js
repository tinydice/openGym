// All-time totals for the top of Stats: everything lifted (the same weight × reps volume each
// workout already counts, warm-ups left out) and every kilometre run. A run's distance is its own
// when the set logged one, else its minutes at its speed (stored in km/h, lib/speed.js).
import { workoutVolume } from './history.js'
import { EXIDX } from './exercises.js'

const RUN = /\b(run|running|jog|jogging|sprint)\b/i
export const isRunExercise = id => RUN.test(EXIDX[id]?.n || '')

export function setKm(set) {
  const km = Number(set?.km ?? set?.dist)
  if (km > 0) return km
  const min = Number(set?.min), speed = Number(set?.speed)
  return min > 0 && speed > 0 ? min * speed / 60 : 0
}

export function lifetimeTotals(S) {
  let lifted = 0, runKm = 0
  for (const w of S?.workouts || []) {
    lifted += workoutVolume(w)
    for (const e of w?.entries || []) {
      if (!isRunExercise(e.id)) continue
      for (const s of e.sets || []) if (s?.done) runKm += setKm(s)
    }
  }
  return { lifted, runKm }
}

// The two numbers share a phone-width card half, so a big one changes unit rather than run off:
// from 100,000 lb it is tons (2,000 lb), from 100,000 kg metric tonnes, from 10,000 of a distance
// unit it is thousands. `value` is already rounded for display; `size` steps the text down for
// the few lengths that still need it.
export function liftedDisplay(amount, unit) {
  if (unit === 'lb' && amount >= 100000) return { value: Math.round(amount / 2000 * 10) / 10, unit: 'tons' }
  if (unit !== 'lb' && amount >= 100000) return { value: Math.round(amount / 1000 * 10) / 10, unit: 't' }
  return { value: Math.round(amount), unit }
}
export function distanceDisplay(amount, unit) {
  if (amount >= 10000) return { value: Math.round(amount / 1000 * 10) / 10, unit: 'k ' + unit }
  return { value: Math.round(amount * 10) / 10, unit }
}
export const fitSize = text => (text.length > 9 ? 20 : text.length > 7 ? 24 : 30)
