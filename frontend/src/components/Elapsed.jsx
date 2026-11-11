import { useEffect, useState } from 'react'
import { fmtElapsed } from '../lib/duration.js'

// A session's running time, "12:34" since `start` ("1:02:03" from an hour on). Its own little component so the only thing
// that re-renders every second is this text: the workout header and the tab bar's button
// both show it. A paused session (`pausedAt`) holds still at the time it stopped on.
export default function Elapsed({ start, pausedAt }) {
  const [t, setT] = useState('0:00')
  useEffect(() => {
    const tick = () => setT(fmtElapsed(((pausedAt || Date.now()) - start) / 1000))
    tick()
    if (pausedAt) return
    const iv = setInterval(tick, 1000); return () => clearInterval(iv)
  }, [start, pausedAt])
  return <span>{t}</span>
}
