import { describe, expect, it } from 'vitest'
import { trendSeries, inRange, changeOver, dayNum } from './weight-trend.js'

const log = (...rows) => rows.map(([d, w]) => ({ d, w, t: 1 }))

describe('trendSeries', () => {
  it('averages a day with the six before it, and only those', () => {
    const s = trendSeries(log(['2026-10-01', 80], ['2026-10-02', 82], ['2026-10-07', 84], ['2026-10-08', 90]))
    expect(s.map(p => p.avg)).toEqual([80, 81, 82, (82 + 84 + 90) / 3])   // 10-08 drops 10-01 (7 days back is out)
    expect(s.map(p => p.n)).toEqual([1, 2, 3, 3])
  })
  it('a lone weigh-in after a long gap is just itself', () => {
    const s = trendSeries(log(['2026-01-01', 90], ['2026-10-12', 165]))
    expect(s[1].avg).toBe(165)
  })
  it('sorts, and skips entries with no day or no positive weight', () => {
    const s = trendSeries([{ d: '2026-10-02', w: 70 }, { d: 'x', w: 70 }, { d: '2026-10-01', w: 0 }, null, { d: '2026-10-01', w: 72 }])
    expect(s.map(p => p.d)).toEqual(['2026-10-01', '2026-10-02'])
  })
  it('is empty for nothing', () => {
    expect(trendSeries(undefined)).toEqual([])
    expect(trendSeries([])).toEqual([])
  })
  it('counts a daylight-saving week as seven days', () => {
    expect(dayNum('2026-11-02') - dayNum('2026-10-26')).toBe(7)
  })
})

describe('inRange / changeOver', () => {
  const series = trendSeries(log(['2026-07-01', 90], ['2026-09-01', 88], ['2026-10-01', 86], ['2026-10-29', 84]))
  it('cuts days back from today; 0 keeps everything', () => {
    expect(inRange(series, 30, '2026-10-30').map(p => p.d)).toEqual(['2026-10-01', '2026-10-29'])
    expect(inRange(series, 90, '2026-10-30').map(p => p.d)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01', '2026-10-29'].filter(d => series.some(p => p.d === d)))
    expect(inRange(series, 0, '2026-10-30')).toHaveLength(4)
  })
  it('reports the move of the average across the cut', () => {
    const c = changeOver(inRange(series, 90, '2026-10-30'))
    expect(c.from).toBe(88)
    expect(c.to).toBe(84)
    expect(c.delta).toBe(-4)
  })
  it('needs two different days', () => {
    expect(changeOver([])).toBeNull()
    expect(changeOver(series.slice(0, 1))).toBeNull()
  })
})
