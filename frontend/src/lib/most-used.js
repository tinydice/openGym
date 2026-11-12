// Train's "Most used" list: the exercises you have logged most, and the entries of a freestyle
// session started from a few of them.
import { EXIDX } from './exercises.js'
import { buildSets, freestyleConfig, defaultConfig, modeOf, applyIntensifierPlan } from './history.js'
import { weightIncrement, defaultIncrement } from './progression.js'
import { withMeaning, historyAs, dbLoadFor, ownedWeightsFor } from './dumbbells.js'
import { dropGrid } from './plates.js'

/** Exercise ids, most often logged first. A workout counts once per exercise, and only when at
 *  least one of its sets was ticked; ties go to the one done most recently. */
export function mostUsedIds(S, exists = id => !!EXIDX[id]) {
  const n = {}, last = {}
  for (const w of S?.workouts || []) {
    for (const id of new Set((w.entries || []).filter(e => (e.sets || []).some(x => x.done)).map(e => e.id))) {
      n[id] = (n[id] || 0) + 1
      if (!last[id] || w.d > last[id]) last[id] = w.d
    }
  }
  return Object.keys(n).filter(exists)
    .sort((a, b) => (n[b] - n[a]) || String(last[b]).localeCompare(String(last[a])) || a.localeCompare(b))
}

/** Entries for a new freestyle session, one per id, each seeded from what you did last time:
 *  the same build as adding an exercise to a freestyle workout (views/Workout.jsx). */
export function freestyleEntries(S, ids, exists = id => !!EXIDX[id]) {
  return ids.filter(exists).map(id => {
    const cfg = freestyleConfig(S, { id, ...defaultConfig(id) })
    const full = { ...cfg, id }
    const step = modeOf(full) === 'reps' ? (ownedWeightsFor(S, full) || weightIncrement(full, S.unit)) : defaultIncrement(id, S.unit)
    return {
      id, target: withMeaning(S, cfg, id), plan: null,
      sets: applyIntensifierPlan(buildSets(historyAs(S, id, dbLoadFor(S, full)), full, { step, preferLast: true }), full, dropGrid(S, full)),
    }
  })
}
