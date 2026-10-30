// The numbers behind the weight chart (components/WeightChart.jsx): a rolling average over the
// weigh-ins, the cut of it that a range chip shows, and the change across that cut. Pure, so the
// chart only draws what this says.
//
// A single morning's weight swings with water, salt and the last meal by more than the body moves in
// a week, so the line that means something is the average of the last few days, with every weigh-in
// kept as a faint dot around it.

export const AVG_DAYS = 7
export const DAY_MS = 86400000

// The chips under the card, in days (0 = everything).
export const WEIGHT_RANGES = [
  { value: 30, label: '1M' }, { value: 90, label: '3M' }, { value: 365, label: '1Y' }, { value: 0, label: 'All' },
]

// Whole days since 1970 for an iso date, in UTC so a daylight-saving week is still 7 days long.
export const dayNum = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS) : NaN
}
const noonMs = iso => new Date(iso + 'T12:00:00').getTime()

/**
 * Every usable weigh-in, oldest first, each with `avg`: the mean of the weigh-ins on that day and
 * the `days - 1` days before it (so a day with one weigh-in after a gap averages just that one).
 * An entry with no day or no positive weight is skipped. Returns [{ d, t, w, avg, n }].
 */
export function trendSeries(bodyweight, days = AVG_DAYS) {
  const rows = (Array.isArray(bodyweight) ? bodyweight : [])
    .filter(b => b && Number(b.w) > 0 && isFinite(dayNum(b.d)))
    .map(b => ({ d: b.d, w: Number(b.w), day: dayNum(b.d) }))
    .sort((a, b) => a.day - b.day || (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))
  let lo = 0, sum = 0
  return rows.map((r, i) => {
    sum += r.w
    while (rows[lo].day <= r.day - days) { sum -= rows[lo].w; lo++ }
    const n = i - lo + 1
    return { d: r.d, t: noonMs(r.d), w: r.w, avg: sum / n, n }
  })
}

/** The part of a series inside a range chip: `days` back from `today` (an iso date), 0 for all. */
export function inRange(series, days, today) {
  if (!days) return series
  const from = dayNum(today) - days
  return series.filter(p => dayNum(p.d) > from)
}

/** How far the average moved across a cut of the series, or null when it holds fewer than two days. */
export function changeOver(cut) {
  if (!cut || cut.length < 2) return null
  const a = cut[0], b = cut[cut.length - 1]
  if (a.d === b.d) return null
  return { from: a.avg, to: b.avg, delta: b.avg - a.avg }
}
