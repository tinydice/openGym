// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import WeightChart from './WeightChart.jsx'
import LineChart from './LineChart.jsx'
import { isoOf } from '../lib/format.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return isoOf(d) }
const mk = (n, w) => ({ d: daysAgo(n), w, t: 1 })
const draw = props => act(() => root.render(<WeightChart unit="lb" {...props} />))
const chip = label => [...host.querySelectorAll('.seg button')].find(b => b.textContent === label)

describe('WeightChart', () => {
  it('draws a dot per weigh-in and a line, with no area fill', () => {
    draw({ bodyweight: [mk(20, 170), mk(10, 168), mk(2, 166)] })
    expect(host.querySelectorAll('.wc-dot')).toHaveLength(3)
    expect(host.querySelector('polyline.wc-avg')).toBeTruthy()
    expect(host.querySelector('polygon')).toBeNull()
    expect(host.querySelector('linearGradient')).toBeNull()
  })
  it('has the four range chips, 3M first selected', () => {
    draw({ bodyweight: [mk(20, 170), mk(2, 166)] })
    expect([...host.querySelectorAll('.seg button')].map(b => b.textContent)).toEqual(['1M', '3M', '1Y', 'All'])
    expect(chip('3M').getAttribute('aria-pressed')).toBe('true')
  })
  it('a chip narrows what is drawn, and the header shows latest and change', () => {
    draw({ bodyweight: [mk(200, 180), mk(60, 172), mk(20, 170), mk(2, 166)] })
    expect(host.querySelectorAll('.wc-dot')).toHaveLength(3)       // 3M
    act(() => chip('1M').click())
    expect(host.querySelectorAll('.wc-dot')).toHaveLength(2)
    act(() => chip('All').click())
    expect(host.querySelectorAll('.wc-dot')).toHaveLength(4)
    const head = host.querySelector('.wc-head').textContent
    expect(head).toContain('166')
    expect(head).toContain('14')      // 180 -> 166 over All
  })
  it('a single weigh-in is a dot, with no line and no change figure', () => {
    draw({ bodyweight: [{ d: daysAgo(3), w: 165, t: 1 }] })
    expect(host.querySelectorAll('.wc-dot')).toHaveLength(1)
    expect(host.querySelector('polyline.wc-avg')).toBeNull()
    expect(host.querySelector('.wc-head').textContent).toContain('165')
  })
  it('keeps the dashed goal line', () => {
    draw({ bodyweight: [mk(5, 170), mk(1, 168)], goal: 160 })
    expect(host.querySelector('line[stroke-dasharray="7 4"]')).toBeTruthy()
  })
  it('opens on All when nothing was weighed in the last three months', () => {
    draw({ bodyweight: [mk(400, 180), mk(300, 175)] })
    expect(chip('All').getAttribute('aria-pressed')).toBe('true')
    expect(host.querySelectorAll('.wc-dot')).toHaveLength(2)
  })
  it('says so when a picked range holds nothing', () => {
    draw({ bodyweight: [mk(100, 180), mk(2, 175)].slice(0, 1) })
    act(() => chip('1M').click())
    expect(host.textContent).toContain('No weigh-ins in this range')
  })
  it('can leave the latest value to the card around it', () => {
    draw({ bodyweight: [mk(5, 170), mk(1, 168)], showLatest: false })
    expect(host.querySelector('.wc-head').textContent).not.toContain('168 lb')
  })
})

describe('LineChart fill', () => {
  const pts = [{ t: Date.UTC(2026, 0, 1), y: 80, d: '2026-01-01' }, { t: Date.UTC(2026, 0, 15), y: 82, d: '2026-01-15' }]
  it('has the gradient area by default and drops it with fill={false}', () => {
    act(() => root.render(<LineChart points={pts} />))
    expect(host.querySelector('polygon')).toBeTruthy()
    act(() => root.render(<LineChart points={pts} fill={false} />))
    expect(host.querySelector('polygon')).toBeNull()
    expect(host.querySelector('polyline')).toBeTruthy()
  })
})
