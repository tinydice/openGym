import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { fmtNum, fmtDate, MONTHS, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { trendSeries, inRange, changeOver, WEIGHT_RANGES } from '../lib/weight-trend.js'
import { Segmented } from './ui.jsx'
import Icon from './Icon.jsx'

// The body-weight chart: every weigh-in as a small faint dot, a bold 7-day average through them,
// the dashed goal line, and no area fill. The range chips cut what is drawn; the average at the
// start of a cut still counts the days before it, so the line does not begin with a lurch.
//
// bodyweight: S.bodyweight ([{ d, w, t }]). `bwDeltaColor` is passed in (it lives in sheets.jsx,
// which imports this file). `showLatest` off lets a card that already leads with the number skip it.

const W = 340   // viewBox width; the svg stretches to its container, height comes from `h`
const DEFAULT_RANGE = 90   // 3M, unless nothing was weighed that recently (then everything)

export default function WeightChart({ bodyweight, unit = '', goal = null, h = 150, showLatest = true, deltaColor }) {
  const [picked, setPicked] = useState(null)   // the chip tapped; null until then
  const [hover, setHover] = useState(null)
  const svgRef = useRef(null), wrapRef = useRef(null), tipRef = useRef(null)
  const cleared = useRef(false)   // a tap that cleared the selection: the drag that follows it does not pick again
  const series = useMemo(() => trendSeries(bodyweight), [bodyweight])
  const range = picked != null ? picked : (inRange(series, DEFAULT_RANGE, todayISO()).length ? DEFAULT_RANGE : 0)
  const cut = useMemo(() => inRange(series, range, todayISO()), [series, range])
  const change = changeOver(cut)
  const latest = series[series.length - 1]

  useLayoutEffect(() => { setHover(null) }, [bodyweight, range])
  // A tap anywhere outside the chart lets go of the selected weigh-in. On a phone nothing else ever
  // would: there is no mouse to leave the chart.
  useEffect(() => {
    if (!hover) return
    const away = e => { if (!wrapRef.current?.contains(e.target)) setHover(null) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [hover])
  // Placed from its measured size so it never hangs off the clipped edge (same approach as LineChart).
  useLayoutEffect(() => {
    const tip = tipRef.current, wrap = wrapRef.current
    if (!hover || !tip || !wrap) return
    const cw = wrap.clientWidth, ch = wrap.clientHeight, tw = tip.offsetWidth, th = tip.offsetHeight, M = 4
    const cx = hover.x / W * cw, cy = hover.y / h * ch
    tip.style.left = Math.max(M, Math.min(cw - tw - M, cx - tw / 2)) + 'px'
    tip.style.top = (cy < th + 14 ? Math.min(ch - th - M, cy + 14) : M) + 'px'
  })

  if (!latest) return <div className="empty small">{t('No data yet')}</div>

  const opts = WEIGHT_RANGES.map(r => ({ value: r.value, label: r.value ? r.label : t('All') }))
  const rangeName = (WEIGHT_RANGES.find(r => r.value === range) || {}).label
  const label = range ? rangeName : t('All')
  const delta = change ? change.delta : null
  const moved = delta != null && fmtNum(Math.abs(delta)) !== fmtNum(0)

  const header = <div className="row between wc-head" style={{ alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
    {showLatest
      ? <div className="row" style={{ gap: 6, alignItems: 'baseline' }}>
        <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.021em' }}>{fmtNum(latest.w)}</span>
        <span className="muted small">{unit}</span>
      </div>
      : <span />}
    <span className="small row" style={{ gap: 3, fontWeight: 500, color: moved && deltaColor ? deltaColor(delta, latest.w) : 'var(--label-2)' }}>
      {change
        ? <>{moved && <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 12 }} />}
          {moved ? fmtNum(Math.abs(delta)) + ' ' + unit : t('No change')}
          <span className="dim" style={{ fontWeight: 400 }}>· {label}</span></>
        : <span className="dim" style={{ fontWeight: 400 }}>{t('Change over {0}', label)}: –</span>}
    </span>
  </div>

  const chips = <Segmented className="seg-range" value={range} onChange={setPicked} options={opts} />

  if (cut.length === 0) return <div className="weight-chart">
    {header}{chips}
    <div className="empty small">{t('No weigh-ins in this range')}</div>
  </div>

  // ---- geometry
  const P = { l: 34, r: 12, t: 10, b: 22 }
  const H = h
  const single = cut.length === 1
  const ys = cut.flatMap(p => [p.w, p.avg])
  let ymin = Math.min(...ys), ymax = Math.max(...ys)
  if (goal != null && isFinite(goal)) { ymin = Math.min(ymin, goal); ymax = Math.max(ymax, goal) }
  if (ymin === ymax) { ymin -= 1; ymax += 1 }
  const pad = (ymax - ymin) * 0.12; ymin -= pad; ymax += pad
  const t0 = cut[0].t, t1 = cut[cut.length - 1].t
  const X = tv => (t1 === t0 ? (P.l + W - P.r) / 2 : P.l + (tv - t0) / (t1 - t0) * (W - P.l - P.r))
  const Y = y => P.t + (1 - (y - ymin) / (ymax - ymin)) * (H - P.t - P.b)

  const grid = []
  const raw = (ymax - ymin) / 3, pow = Math.pow(10, Math.floor(Math.log10(raw)))
  let step = 10 * pow
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * pow) { step = m * pow; break }
  for (let v0 = Math.ceil(ymin / step) * step; v0 <= ymax + 1e-9; v0 += step) {
    const v = Math.round(v0 / step) * step || 0, y = Y(v)
    grid.push(<g key={'y' + v}>
      <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="var(--sep-op)" strokeWidth="1" strokeDasharray="2 4" />
      <text x={P.l - 5} y={y + 3.5} textAnchor="end" fontSize="9.5" fill="var(--label-2)">{fmtNum(v)}</text>
    </g>)
  }
  if (!single) {
    const d0 = new Date(t0), d1 = new Date(t1)
    const ticks = []
    for (let m = new Date(d0.getFullYear(), d0.getMonth() + 1, 1); m <= d1; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      ticks.push({ t: +m, txt: t(MONTHS[m.getMonth()]) })
    }
    if (!ticks.length) {
      for (let i = 0; i <= 2; i++) {
        const tv = t0 + (t1 - t0) * i / 2, dd = new Date(tv)
        ticks.push({ t: tv, txt: dd.getDate() + ' ' + t(MONTHS[dd.getMonth()]), anchor: i === 0 ? 'start' : i === 2 ? 'end' : 'middle' })
      }
    }
    const every = Math.max(1, Math.ceil(ticks.length / 7))
    ticks.forEach((tk, i) => {
      if (i % every) return
      const x = X(tk.t)
      grid.push(<g key={'x' + i}>
        <line x1={x} y1={P.t} x2={x} y2={H - P.b} stroke="var(--sep-op)" strokeWidth="1" strokeDasharray="2 4" />
        <text x={x} y={H - 7} textAnchor={tk.anchor || 'middle'} fontSize="9.5" fill="var(--label-2)">{tk.txt}</text>
      </g>)
    })
  }

  const line = cut.map(p => X(p.t).toFixed(1) + ',' + Y(p.avg).toFixed(1)).join(' ')
  const last = cut[cut.length - 1]
  const hoverPts = cut.map(p => ({ ...p, x: X(p.t), y: Y(p.w) }))
  const showYear = new Set(cut.map(p => p.d.slice(0, 4))).size > 1
  const nearest = e => {
    const r = svgRef.current.getBoundingClientRect()
    const vx = (e.clientX - r.left) / (r.width || W) * W
    let best = hoverPts[0]
    hoverPts.forEach(p => { if (Math.abs(p.x - vx) < Math.abs(best.x - vx)) best = p })
    return best
  }
  // Mouse: the weigh-in under the pointer, gone when it leaves. Finger or pen: a tap picks the nearest
  // weigh-in, a tap on the picked one puts it down again, and a drag slides along the line.
  const onPointerDown = e => {
    if (e.pointerType === 'mouse') return
    const best = nearest(e)
    cleared.current = !!hover && hover.t === best.t
    setHover(cleared.current ? null : best)
  }
  const onPointerMove = e => {
    if (e.pointerType === 'mouse') setHover(nearest(e))
    else if (e.buttons && !cleared.current) setHover(nearest(e))
  }
  const onPointerLeave = e => { if (e.pointerType === 'mouse') setHover(null) }

  return <div className="weight-chart">
    {header}
    {chips}
    <div className="chart">
      <div className="chart-i" ref={wrapRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ aspectRatio: `${W}/${H}` }}>
          {grid}
          {goal != null && isFinite(goal) && <>
            <line x1={P.l} y1={Y(goal)} x2={W - P.r} y2={Y(goal)} stroke="var(--goal)" strokeWidth="1.6" strokeDasharray="7 4" />
            <text x={W - P.r - 2} y={Y(goal) - 5} textAnchor="end" fontSize="9.5" fontWeight="700" fill="var(--goal)">{fmtNum(goal)}</text>
          </>}
          {/* each weigh-in: small and faint, so the average reads as the line and these as the scatter */}
          {cut.map((p, i) => <circle key={'d' + i} className="wc-dot" cx={X(p.t)} cy={Y(p.w)} r="2.2" fill="var(--label)" opacity=".28" />)}
          {!single && <polyline className="wc-avg" points={line} fill="none" stroke="var(--acc)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
          <circle cx={X(last.t)} cy={Y(last.avg)} r="4.2" fill="var(--acc)" />
          {/* the picked weigh-in: a green ring round its own small dot, nothing filled */}
          {hover && <circle className="wc-pick" cx={hover.x} cy={hover.y} r="6.5" fill="none" stroke="var(--green)" strokeWidth="2.2" />}
        </svg>
        {hover && <div className="ctip" ref={tipRef}>
          {fmtDate(hover.d, true, showYear)} · {fmtNum(hover.w)}{unit ? ' ' + unit : ''}
          {hover.n > 1 ? ' · ' + t('Average {0}', fmtNum(hover.avg) + (unit ? ' ' + unit : '')) : ''}
        </div>}
      </div>
    </div>
    <div className="small dim" style={{ marginTop: 4 }}>{t('Dots are weigh-ins, the line is the 7-day average')}</div>
  </div>
}
