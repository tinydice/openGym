import { describe, expect, it } from 'vitest'
import { lifetimeTotals, setKm, liftedDisplay, distanceDisplay, fitSize } from './lifetime.js'

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

describe('the all-time numbers fit their half of the card', () => {
  it('pounds turn into tons from 100,000 lb, kg into tonnes', () => {
    expect(liftedDisplay(13240, 'lb')).toEqual({ value: 13240, unit: 'lb' })
    expect(liftedDisplay(132400, 'lb')).toEqual({ value: 66.2, unit: 'tons' })
    expect(liftedDisplay(250000, 'kg')).toEqual({ value: 250, unit: 't' })
  })
  it('distance turns into thousands from 10,000', () => {
    expect(distanceDisplay(8.84, 'mi')).toEqual({ value: 8.8, unit: 'mi' })
    expect(distanceDisplay(12345, 'mi')).toEqual({ value: 12.3, unit: 'k mi' })
  })
  it('long text steps down in size', () => {
    expect(fitSize('13,240')).toBe(30)
    expect(fitSize('99,999.9')).toBe(24)
    expect(fitSize('1,234,567.8')).toBe(20)
  })
})
