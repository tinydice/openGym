import { describe, expect, it } from 'vitest'
import { lifetimeTotals, setKm } from './lifetime.js'

describe('all-time totals', () => {
  it('adds up every done set lifted and every km run', () => {
    const S = { workouts: [
      { entries: [{ id: '0032', sets: [{ w: 100, r: 5, done: true }, { w: 100, r: 5, done: false }] }] },
      { entries: [{ id: '0685', sets: [{ min: 30, speed: 10, done: true }] }] },
      { entries: [{ id: '0685', sets: [{ km: 5, min: 28, speed: 10.7, done: true }, { min: 20, speed: 10, done: false }] }] },
    ] }
    const t = lifetimeTotals(S)
    expect(t.lifted).toBe(500)
    expect(t.runKm).toBeCloseTo(10)
  })
  it('reads a run set by its own distance first, else minutes at speed', () => {
    expect(setKm({ km: 3 })).toBe(3)
    expect(setKm({ min: 60, speed: 8 })).toBe(8)
    expect(setKm({ min: 30 })).toBe(0)
  })
})
