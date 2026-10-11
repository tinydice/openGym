// Pausing a running session. The clock stops at `pausedAt`; Resume moves the start (and the
// stamps of the sets already ticked) forward by however long the pause lasted, so everything that
// reads `start` — the clock, the saved duration, the forgotten-session gap in sessionEnd — sees a
// session that simply did not run in between. Leaving the screen does not resume it; only
// Resume does.
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'

export const isPaused = active => !!active && Number(active.pausedAt) > 0

export function pauseActive(active, now = Date.now()) {
  if (!active || isPaused(active) || active.editingWorkoutId || active.backfill) return
  active.pausedAt = now
}

export function resumeActive(active, now = Date.now()) {
  if (!isPaused(active)) return
  const gap = Math.max(0, now - active.pausedAt)
  delete active.pausedAt
  if (Number.isFinite(active.start)) active.start += gap
  for (const entry of active.entries || []) for (const set of entry.sets || []) {
    if (Number.isFinite(set.at)) set.at += gap
  }
}

// A rest countdown the pause held, so Resume lets it go on and leaves one the athlete paused
// themselves alone.
let restHeldByPause = false

export function pauseSession() {
  const ui = useUI.getState()
  restHeldByPause = !!ui.timer && !ui.timer.paused && !ui.timer.ready
  if (restHeldByPause) ui.pauseRest()
  useStore.getState().update(s => { pauseActive(s.active) })
}

export function resumeSession() {
  useStore.getState().update(s => { resumeActive(s.active) })
  if (restHeldByPause) useUI.getState().resumeRest()
  restHeldByPause = false
}
