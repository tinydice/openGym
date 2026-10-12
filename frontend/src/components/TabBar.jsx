import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutineIds, effectiveRoutines } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import Elapsed from './Elapsed.jsx'
import { isPaused, isNotStarted, toggleSession } from '../lib/session-pause.js'
import { useConnectionTrouble } from './SyncBanner.jsx'

// Module scope, not TabBar's render body. Declared inside it, `Tab` was a new function on every
// render, so React saw a different component type each time and threw the button away and built a
// fresh one — on a bar that is fixed on screen, and once a second for the whole of a rest. The
// state it took with it is the DOM node itself: focus, the :active tint, any in-flight transition.
function Tab({ active, icon, label, onClick, dot }) {
  return (
    <button className={active ? 'on' : ''} onClick={onClick} aria-label={dot ? label + ', ' + t('Connection problem') : undefined}>
      <span className="tab-ic"><Icon name={icon} />{dot && <span className="tab-dot" aria-hidden="true" />}</span><span>{label}</span>
    </button>
  )
}

export default function TabBar({ onStart }) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  // With the connection banner switched off, a sync problem shows as a dot on Home, the tab
  // Settings lives under (#369, #330).
  const trouble = useConnectionTrouble()
  if (!user && !isGuest) return null
  const cur = loc.pathname.split('/')[1] || 'home'
  const on = k => cur === k || (cur === 'history' && k === 'stats') || (cur === 'settings' && k === 'home') || (cur === 'muscles' && k === 'library') || (cur === 'structural-balance' && k === 'stats')

  // A live session (not a saved workout being edited, nor one logged after the fact) has a clock.
  const running = !!S.active && !S.active.editingWorkoutId && !S.active.backfill && S.active.start > 0
  const paused = running && isPaused(S.active)
  const fresh = running && isNotStarted(S.active)
  const startWorkout = () => {
    if (!S.active) {
      // A weekday can hold several routines; start the combined session if any of them has
      // exercises, otherwise fall through to the picker.
      if (effectiveRoutines(S, todayISO()).some(r => r.ex.length)) { onStart(effectiveRoutineIds(S, todayISO()), { started: true }); return }
    }
    // With a session open the button is its play/pause, right where you are; the workout itself
    // is opened from Home's Today row.
    if (running) { toggleSession(); return }
    nav('/workout')
  }

  return (
    <nav id="tabbar">
      <Tab active={on('home')} icon="house" label={t('Home')} dot={trouble} onClick={() => nav('/home')} />
      <Tab active={on('plan')} icon="calendar" label={t('Plan')} onClick={() => nav('/plan')} />
      {/* Play and pause in one button. With nothing open it starts today's session, clock
          running; with a session open it starts, pauses and resumes its clock without leaving the
          screen you are on. A session opened but not started reads Start; one that has run shows
          its time, frozen while paused. A past workout being edited or logged after the fact has
          no clock, so there the button just goes back to it. */}
      <button className={'start' + (S.active && !fresh ? ' rec' : '') + (paused ? ' paused' : '') + (S.active && cur === 'workout' ? ' on' : '')} onClick={startWorkout}
        aria-label={running ? (fresh ? t('Start workout') : paused ? t('Resume') : t('Pause')) : undefined}>
        <span className="cir"><Icon name={running && !paused ? 'pause' : 'play'} /></span>
        {running ? (fresh ? <span>{t('Start')}</span> : <span className="tab-time"><Elapsed start={S.active.start} pausedAt={S.active.pausedAt} /></span>)
          : <span>{S.active ? (cur === 'workout' ? t('Workout') : S.active.editingWorkoutId ? t('Edit workout') : t('Resume')) : t('Start')}</span>}
      </button>
      <Tab active={on('stats')} icon="chart" label={t('Stats')} onClick={() => nav('/stats')} />
      <Tab active={on('library')} icon="dumbbell" label={t('Exercises')} onClick={() => nav('/library')} />
    </nav>
  )
}
