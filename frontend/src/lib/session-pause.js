// Pausing a running session. The clock stops at `pausedAt`; Resume moves the start (and the
// stamps of the sets ticked before the pause) forward by however long the pause lasted, so
// everything that reads `start` — the clock, the saved duration, the forgotten-session gap in
// sessionEnd — sees a session that simply did not run in between. Leaving the screen does not
// resume it; only the play button does.
//
// A session opened from Home or the Start screen is not started yet: it is born paused at 0:00
// (`notStarted`), and the first play starts its clock.
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'

export const isPaused = active => !!active && Number(active.pausedAt) > 0
export const isNotStarted = active => isPaused(active) && active.notStarted === true

/** The clock fields of a new session: running from now, or opened and waiting for play. */
export const clockFields = (started, now = Date.now()) => (started ? { start: now } : { start: now, pausedAt: now, notStarted: true })

export function pauseActive(active, now = Date.now()) {
  if (!active || isPaused(active) || active.editingWorkoutId || active.backfill) return
  active.pausedAt = now
}

export function resumeActive(active, now = Date.now()) {
  if (!isPaused(active)) return
  const pausedAt = active.pausedAt
  const gap = Math.max(0, now - pausedAt)
  delete active.pausedAt
  delete active.notStarted
  if (Number.isFinite(active.start)) active.start += gap
  // A set ticked while the clock stood still keeps its stamp; only the run before the pause moves.
  for (const entry of active.entries || []) for (const set of entry.sets || []) {
    if (Number.isFinite(set.at) && set.at <= pausedAt) set.at += gap
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

export const toggleSession = () => (isPaused(useStore.getState().S.active) ? resumeSession() : pauseSession())

export function resumeSession() {
  useStore.getState().update(s => { resumeActive(s.active) })
  if (restHeldByPause) useUI.getState().resumeRest()
  restHeldByPause = false
}
