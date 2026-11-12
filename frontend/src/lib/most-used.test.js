import { describe, it, expect } from 'vitest'
import { mostUsedIds, freestyleEntries } from './most-used.js'

const w = (d, ...entries) => ({ id: d, d, entries })
const e = (id, done = true) => ({ id, sets: [{ done }] })
const all = () => true

describe('mostUsedIds', () => {
  it('ranks by how many workouts logged the exercise, once per workout', () => {
    const S = { workouts: [w('2026-01-01', e('a'), e('a'), e('b')), w('2026-01-02', e('b'), e('c')), w('2026-01-03', e('b'))] }
    expect(mostUsedIds(S, all)).toEqual(['b', 'c', 'a'])
  })
  it('ignores exercises with no ticked set', () => {
    const S = { workouts: [w('2026-01-01', e('a', false), e('b'))] }
    expect(mostUsedIds(S, all)).toEqual(['b'])
  })
  it('breaks a tie with the most recent workout, then the id', () => {
    const S = { workouts: [w('2026-01-01', e('a'), e('z')), w('2026-01-02', e('b'))] }
    expect(mostUsedIds(S, all)).toEqual(['b', 'a', 'z'])
  })
  it('leaves out exercises that no longer exist, and copes with no workouts', () => {
    expect(mostUsedIds({ workouts: [w('2026-01-01', e('a'), e('gone'))] }, id => id !== 'gone')).toEqual(['a'])
    expect(mostUsedIds({}, all)).toEqual([])
  })
})

describe('freestyleEntries', () => {
  it('builds an unticked entry per existing exercise, in order', () => {
    const S = { unit: 'lb', workouts: [], routines: [], custom: [] }
    const out = freestyleEntries(S, ['0685', 'nope'], id => id === '0685')
    expect(out.map(x => x.id)).toEqual(['0685'])
    expect(out[0].sets.length).toBeGreaterThan(0)
    expect(out[0].sets.every(s => !s.done)).toBe(true)
  })
})
