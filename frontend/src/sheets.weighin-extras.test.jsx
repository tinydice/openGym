// @vitest-environment happy-dom
// A scale's extras (POST /api/weighin) show under the day in the weigh-ins list, only when present.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { weighInsSheet } from './sheets.jsx'

const mounted = []
function mountTopSheet() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [] })
  document.body.innerHTML = ''
  const S = JSON.parse(JSON.stringify(DEF))
  Object.assign(S, { unit: 'lb', weekStart: 1, targetW: null, bodyweight: [
    { d: '2026-10-28', w: 166, t: 1 },
    { d: '2026-10-29', w: 165.4, t: 2, src: 'scale', bf: 18.2, mm: 77.2, bw: 55, vf: 7 },
  ] })
  useStore.setState({ S, user: null })
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('weigh-ins list: scale extras', () => {
  it('shows body fat, muscle, water and visceral fat for a day that has them, and nothing for one that does not', () => {
    weighInsSheet()
    const host = mountTopSheet()
    const extras = [...host.querySelectorAll('.wi-extras')]
    expect(extras).toHaveLength(1)
    expect(extras[0].textContent).toBe('Body fat 18.2% · Muscle 77.2 lb · Water 55% · Visceral fat 7')
  })
})
