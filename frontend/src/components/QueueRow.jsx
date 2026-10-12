import { queueView } from '../lib/queue.js'
import { effectiveRoutineIds } from '../lib/history.js'
import { fmtDate } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { isNotStarted } from '../lib/session-pause.js'

// Home's progress row for a coach week (S.queue) — it stands in for the seven weekday dots
// while a planner-written queue runs the week, because its sessions have no weekday: they are done in
// order, on whatever days you train. One chip per session in slot order; the next undone one
// is lit, and any undone chip starts its own routine, in whatever order the day calls for. A
// done chip is inert: that session is logged. A session pinned to another day (the day sheet,
// S.dayPlan) is not lit and wears its day instead of a state word — it still starts on a tap.
// Reads through queueView so the words here and the today row (effectiveRoutineIds →
// queueNext) can never disagree about which is next.
export default function QueueRow({ S, today, onStart, managed }) {
  const v0 = queueView(S, today)
  if (!v0) return null
  // A session open right now is the loop's current one: its chip says so (in the plain grey state
  // word, not lit), and nothing
  // else reads "Up next" until it is finished. Found by the slot it was picked from, else by its
  // routine — the up-next session when that is the one, otherwise the first open slot of it.
  const A = S.active && !S.active.editingWorkoutId && !S.active.backfill ? S.active : null
  const open = i => i.state !== 'done' && i.state !== 'skipped'
  const upNext = v0.items.findIndex(i => i.state === 'next')
  const inA = i => (A?.routineIds || []).includes(i.id)
  const activeIdx = !A ? -1
    : Number.isInteger(A.slot) && v0.items[A.slot] && open(v0.items[A.slot]) && inA(v0.items[A.slot]) ? A.slot
    : upNext >= 0 && inA(v0.items[upNext]) ? upNext
    : v0.items.findIndex(i => open(i) && inA(i))
  const v = activeIdx < 0 ? v0 : { ...v0, items: v0.items.map((i, n) => (n === activeIdx ? { ...i, state: 'active' } : i.state === 'next' ? { ...i, state: 'later' } : i)) }
  const word = { done: t('Done'), next: t('Up next'), later: t('Later'), skipped: t('Skipped'), active: isNotStarted(A) ? t('Open') : t('In progress') }
  const current = activeIdx >= 0 ? v.items[activeIdx] : null
  const next = v.items.find(i => i.state === 'next')
  const doneCount = v.items.filter(i => i.state === 'done').length
  // With every remaining session pinned to its own day nothing floats, so there is no 'next'
  // chip at all; the status line then names the soonest pinned one with its day.
  const pinned = v.items.filter(i => i.state === 'pinned').sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0))[0]
  // "today" only when the today row really offers it: a 'rest' or routine override for today
  // wins over the queue there (effectiveRoutineIds), and this line must not contradict it.
  const shownToday = !!next && effectiveRoutineIds(S, today, today).includes(next.id)
  // A pass this app manages refills itself (lib/rotation.js) — "ask the coach" and naming a
  // whole week are a planner's copy, wrong for a pass with no coach and no week shape at all.
  const status = current ? (isNotStarted(A) ? t('Open: {0}', current.name) : t('In progress: {0}', current.name))
    : v.complete ? (managed ? t('Round complete') : t('Week complete, ask the coach'))
    : v.waiting ? (managed ? t('Next round starts {0}.', fmtDate(v.startsOn, true)) : t('Next week starts {0}', fmtDate(v.startsOn, true)))
    : shownToday ? t('Next: {0}, today', next.name)
    : next ? t('Next: {0}', next.name)
    : t('Next: {0}', pinned.name + ' · ' + fmtDate(pinned.on, true))
  return <div className="queue">
    <div className="row between" style={{ marginBottom: 8 }}>
      {/* Your own loop is called 'Rotation' in the language on screen: its saved name is only ever
          the word itself, which older saves kept in the language the loop was made in. */}
      <div className="small muted" style={{ fontWeight: 500 }}>{managed ? t('Rotation') : v.label}</div>
      {/* Your own loop speaks in rounds, as Plan does; a coach's week keeps its plain count. */}
      <div className="small muted">{managed ? t('{0} of {1} done this round.', doneCount, v.items.length) : `${doneCount} / ${v.items.length}`}</div>
    </div>
    {/* The state word keeps its sentence case ("Up next", as on Plan): .chip capitalizes every
        word for the routine names, which made it "Up Next" here (QA 10-06). A pinned chip's date
        keeps .chip's capitals, so it reads "Seg., 12 out." and not "seg." in Portuguese. */}
    {/* Two columns read top to bottom, left column first: the next session is the one below,
        never the one beside it. */}
    <div className="chips queue-grid" style={{ gridTemplateRows: `repeat(${Math.ceil(v.items.length / 2)}, auto)` }}>
      {v.items.map((i, n) => <button key={n} className={'chip' + (i.state === 'next' ? ' on' : '')}
        disabled={i.state === 'done'} onClick={() => onStart(i.id, n)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, opacity: i.state === 'done' ? 0.55 : i.state === 'skipped' ? 0.7 : undefined }}>
        {i.state === 'done' && <Icon name="check" />}<span className="qname">{i.name}</span><span className={'dim' + (i.state === 'pinned' ? '' : ' qstate')}>{i.state === 'pinned' ? fmtDate(i.on, true) : word[i.state]}</span>
      </button>)}
    </div>
    <div className="small muted queue-status" style={{ marginTop: 8 }}>{status}</div>
  </div>
}
