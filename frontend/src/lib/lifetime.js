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
