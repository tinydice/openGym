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

// Picking a weigh-in. Mouse: it follows the pointer. Finger: a tap picks, a tap on it again or
// anywhere else puts it down, a drag slides. The pick is a green ring, never a filled white dot.
describe('WeightChart picking a weigh-in', () => {
  const fire = (el, type, init = {}) => {
    const Ev = globalThis.PointerEvent || MouseEvent
    const e = new Ev(type, { bubbles: true, cancelable: true, ...init })
    if (!('pointerType' in e)) Object.defineProperty(e, 'pointerType', { value: init.pointerType || 'touch' })
    act(() => { el.dispatchEvent(e) })
  }
  const data = [mk(20, 170), mk(10, 168), mk(2, 166)]
  const dotX = i => Number(host.querySelectorAll('.wc-dot')[i].getAttribute('cx'))
  const area = () => host.querySelector('.chart-i')
  const tap = i => fire(area(), 'pointerdown', { pointerType: 'touch', clientX: dotX(i) })
  const ring = () => host.querySelector('.wc-pick')

  it('the picked weight is written in green beside the ring', () => {
    draw({ bodyweight: data })
    expect(host.querySelector('.wc-last').textContent).toBe('166')
    tap(1)
    expect(host.querySelector('.wc-last')).toBeNull()
    expect(host.querySelector('.wc-val').textContent).toBe('168')
  })
  it('a tap rings the nearest weigh-in in green, with no filled dot and no crosshair', () => {
    draw({ bodyweight: data })
    expect(ring()).toBeNull()
    tap(1)
    expect(ring()).toBeTruthy()
    expect(Number(ring().getAttribute('cx'))).toBeCloseTo(dotX(1), 1)
    expect(ring().getAttribute('fill')).toBe('none')
    expect(ring().getAttribute('stroke')).toBe('var(--green)')
    expect(host.querySelector('.cvl')).toBeNull()
    expect(host.querySelector('.ctip')).toBeTruthy()
  })
  it('a tap on the picked weigh-in puts it down again, and the drag after it does not pick again', () => {
    draw({ bodyweight: data })
    tap(1)
    tap(1)
    expect(ring()).toBeNull()
    fire(area(), 'pointermove', { pointerType: 'touch', buttons: 1, clientX: dotX(2) })
    expect(ring()).toBeNull()
  })
  it('a tap anywhere outside the chart lets go of it', () => {
    draw({ bodyweight: data })
    tap(2)
    expect(ring()).toBeTruthy()
    fire(document.body, 'pointerdown', { pointerType: 'touch' })
    expect(ring()).toBeNull()
  })
  it('tapping another weigh-in moves the ring, and a finger drag slides it', () => {
    draw({ bodyweight: data })
    tap(0)
    tap(2)
    expect(Number(ring().getAttribute('cx'))).toBeCloseTo(dotX(2), 1)
    fire(area(), 'pointermove', { pointerType: 'touch', buttons: 1, clientX: dotX(1) })
    expect(Number(ring().getAttribute('cx'))).toBeCloseTo(dotX(1), 1)
  })
  it('a mouse hovers to pick and leaving lets go; clicking does not toggle it', () => {
    draw({ bodyweight: data })
    fire(area(), 'pointermove', { pointerType: 'mouse', clientX: dotX(1) })
    expect(ring()).toBeTruthy()
    fire(area(), 'pointerdown', { pointerType: 'mouse', clientX: dotX(1) })
    expect(ring()).toBeTruthy()
    // React builds pointer-leave from pointerout, with nothing entered (relatedTarget null) = left the window
    fire(area(), 'pointerout', { pointerType: 'mouse', relatedTarget: null })
    expect(ring()).toBeNull()
  })
  it('the goal line uses the goal color, not yellow', () => {
    draw({ bodyweight: data, goal: 160 })
    const line = host.querySelector('line[stroke-dasharray="7 4"]')
    expect(line.getAttribute('stroke')).toBe('var(--goal)')
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
