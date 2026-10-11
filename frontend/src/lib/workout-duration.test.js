import { describe, expect, it } from 'vitest'
import { workoutDuration, loggedWorkMs } from './history.js'

const w = (min, over = {}) => ({ start: 1_000_000, end: 1_000_000 + 30_000, entries: [{ id: 'x', sets: [{ min, done: true }] }], ...over })

describe('a session’s duration', () => {
  it('is the clock time when that is longer than what the rows logged', () => {
    expect(workoutDuration({ start: 0, end: 50 * 60000, entries: [{ id: 'x', sets: [{ min: 10, done: true }] }] })).toBe(50 * 60000)
  })
  it('is at least the cardio minutes ticked, even when they were ticked in seconds', () => {
    expect(workoutDuration(w(30))).toBe(30 * 60000)
  })
  it('ignores rows that were not done, and counts holds by their seconds', () => {
    const rec = { start: 0, end: 1000, entries: [{ id: 'p', sets: [{ sec: 45, done: true }, { sec: 45, done: true }, { min: 20, done: false }] }] }
    expect(loggedWorkMs(rec)).toBe(90_000)
    expect(workoutDuration(rec)).toBe(90_000)
  })
  it('has no clock to lean on for imported history, and still reads 0 for a lift', () => {
    expect(workoutDuration({ entries: [{ id: 'b', sets: [{ w: 50, r: 5, done: true }] }] })).toBe(0)
  })
})
