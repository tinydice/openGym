// @vitest-environment happy-dom
// Train's Most used view: the exercises you log most, tick a few, start a freestyle workout.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { startWithExercises } from '../sheets.jsx'
import Plan from './Plan.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), menuSheet: vi.fn(), planHasRoutines: () => false, exportPlanFile: vi.fn(),
  printWholePlan: vi.fn(), importPlanFile: vi.fn(), startWithExercises: vi.fn(),
}))

const w = (d, ...ids) => ({ id: d, d, entries: ids.map(id => ({ id, sets: [{ done: true }] })) })
let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.removeItem('gym_plan_view')
  startWithExercises.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })
const setWorkouts = workouts => useStore.setState(s => ({ S: { ...s.S, routines: [], week: {}, active: null, workouts } }))
const rows = () => [...host.querySelectorAll('.mu-list .mu-row')]
const startBtn = () => host.querySelector('.mu-start')

describe('Train — Most used', () => {
  it('says so while nothing is logged', () => {
    setWorkouts([])
    act(() => root.render(<Plan />))
    expect(host.textContent).toContain('Nothing logged yet.')
    expect(rows()).toHaveLength(0)
  })

  it('lists the most logged exercise first, and starts only what is picked, in list order', () => {
    // 0685 (run) in all three workouts; the other two once each, 0002 the more recent, so it ranks above 0001
    setWorkouts([w('2026-01-01', '0685', '0001'), w('2026-01-02', '0685'), w('2026-01-03', '0685', '0002')])
    act(() => root.render(<Plan />))
    expect(rows()).toHaveLength(3)
    expect(rows()[0].textContent).toContain('3 workouts')
    expect(startBtn().disabled).toBe(true)
    expect(startBtn().textContent).toBe('Pick exercises to start')
    act(() => { rows()[2].click() })
    act(() => { rows()[0].click() })
    expect(startBtn().textContent).toBe('Start workout · 2 exercises')
    expect(rows()[0].getAttribute('aria-pressed')).toBe('true')
    act(() => { startBtn().click() })
    expect(startWithExercises).toHaveBeenCalledWith(['0685', '0001'])
  })

  it('a second tap unpicks, and the start button dims again', () => {
    setWorkouts([w('2026-01-01', '0685')])
    act(() => root.render(<Plan />))
    act(() => { rows()[0].click() })
    expect(startBtn().disabled).toBe(false)
    act(() => { rows()[0].click() })
    expect(startBtn().disabled).toBe(true)
  })
})
