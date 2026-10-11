// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { isPaused, isNotStarted, clockFields, pauseActive, resumeActive } from './session-pause.js'

const session = () => ({
  start: 1_000_000, entries: [{ sets: [{ done: true, at: 1_100_000 }, { done: false }] }],
})

describe('pausing a session', () => {
  it('stamps the pause and does nothing to a backfill or a saved-workout edit', () => {
    const a = session(); pauseActive(a, 1_200_000)
    expect(isPaused(a)).toBe(true)
    expect(a.pausedAt).toBe(1_200_000)
    pauseActive(a, 1_300_000)
    expect(a.pausedAt).toBe(1_200_000)
    const b = { ...session(), backfill: { durationMin: 30 } }; pauseActive(b, 5)
    expect(isPaused(b)).toBe(false)
    const c = { ...session(), editingWorkoutId: 'w' }; pauseActive(c, 5)
    expect(isPaused(c)).toBe(false)
  })

  it('resume moves the start and the tick stamps by the length of the pause', () => {
    const a = session()
    pauseActive(a, 1_200_000)
    resumeActive(a, 1_500_000)
    expect(a.pausedAt).toBeUndefined()
    expect(a.start).toBe(1_300_000)
    expect(a.entries[0].sets[0].at).toBe(1_400_000)
    expect(a.entries[0].sets[1].at).toBeUndefined()
  })

  it('resume on a running session changes nothing', () => {
    const a = session(); resumeActive(a, 9_999_999)
    expect(a).toEqual(session())
  })
})

describe('a session opened but not started', () => {
  it('is born paused at 0:00 and its first play starts the clock then', () => {
    const a = { ...clockFields(false, 1_000), entries: [{ sets: [{ done: true, at: 5_000 }] }] }
    expect(isNotStarted(a)).toBe(true)
    resumeActive(a, 60_000)
    expect(isNotStarted(a)).toBe(false)
    expect(a.notStarted).toBeUndefined()
    expect(a.start).toBe(60_000)
    // a set ticked before play keeps its stamp
    expect(a.entries[0].sets[0].at).toBe(5_000)
  })
  it('the play button starts one at once', () => {
    expect(clockFields(true, 7)).toEqual({ start: 7 })
  })
})
