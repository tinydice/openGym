/* A weigh-in from outside the app (POST /api/weighin): validate the body, convert it to the
 * profile's unit, and fold it into the profile's `bodyweight` list.
 *
 * The list holds ONE entry per day (the app, its sync merge and its delete records all key it by
 * `d`), so "one entry per day per source" means: an entry carries the `src` it came from, a later
 * post from the same source on the same day replaces it, and a day that already holds an entry from
 * another source (one typed in the app has no `src`) is left alone rather than overwritten.
 *
 * Pure; the route, the token and the write sequence are server.js's. */

const LB_PER_KG = 2.2046226218;
const KG = { min: 20, max: 500 };           // bounds on what a person weighs, in kg
const EXTRAS = {                            // key -> [min, max]; bf, bw are percent, vf a scale rating
  bf: [1, 75], mm: [1, 400], bw: [10, 90], vf: [0, 60]
};
export const SOURCE_RE = /^[a-z0-9_-]{1,20}$/;
export const DEFAULT_SOURCE = 'scale';

const round = (n, p = 100) => Math.round(n * p) / p;
const num = v => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const absent = v => v === undefined || v === null || v === '';
const validDate = s => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T12:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
};

/**
 * → { ok: true, entry } with entry { d, w, [bf, mm, bw, vf], src } in `unit` ('kg' or 'lb'),
 *   or { ok: false, error }. `now` (ms) bounds the date: no later than tomorrow (a phone's today
 *   can be a day ahead of the server's), no earlier than 2000.
 */
export function parseWeighIn(body, unit, now = Date.now()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'a JSON object is required' };
  const known = new Set(['date', 'kg', 'lb', 'extras', 'source']);
  for (const k of Object.keys(body)) if (!known.has(k)) return { ok: false, error: `unknown field: ${k}` };
  if (!validDate(body.date)) return { ok: false, error: 'date must be a real day as YYYY-MM-DD' };
  const tomorrow = new Date(now + 86400000).toISOString().slice(0, 10);
  if (body.date > tomorrow) return { ok: false, error: 'date is in the future' };
  if (body.date < '2000-01-01') return { ok: false, error: 'date is too far back' };
  const hasKg = !absent(body.kg), hasLb = !absent(body.lb);
  if (hasKg === hasLb) return { ok: false, error: 'send exactly one of kg or lb' };
  const given = num(hasKg ? body.kg : body.lb);
  if (!isFinite(given)) return { ok: false, error: `${hasKg ? 'kg' : 'lb'} must be a number` };
  const kg = hasKg ? given : given / LB_PER_KG;
  if (kg < KG.min || kg > KG.max) return { ok: false, error: 'weight is outside what a person weighs (20 to 500 kg)' };
  const u = unit === 'lb' ? 'lb' : 'kg';
  // To the profile's unit. Muscle mass travels in the same unit as the weight that was sent.
  const conv = v => (u === 'lb' ? (hasKg ? v * LB_PER_KG : v) : (hasKg ? v : v / LB_PER_KG));
  const entry = { d: body.date, w: round(conv(given)) };
  let src = DEFAULT_SOURCE;
  if (!absent(body.source)) {
    if (typeof body.source !== 'string' || !SOURCE_RE.test(body.source)) return { ok: false, error: 'source must be 1 to 20 of a-z 0-9 _ -' };
    src = body.source;
  }
  const ex = body.extras;
  if (!absent(ex)) {
    if (typeof ex !== 'object' || Array.isArray(ex)) return { ok: false, error: 'extras must be an object' };
    for (const k of Object.keys(ex)) {
      if (!EXTRAS[k]) return { ok: false, error: `unknown extra: ${k} (use bf, mm, bw, vf)` };
      if (absent(ex[k])) continue;
      const n = num(ex[k]);
      if (!isFinite(n)) return { ok: false, error: `${k} must be a number` };
      const [lo, hi] = EXTRAS[k];
      // Muscle mass is a weight: range-checked in kg, stored in the profile's unit.
      const check = k === 'mm' ? (hasKg ? n : n / LB_PER_KG) : n;
      if (check < lo || check > hi) return { ok: false, error: `${k} is out of range` };
      const v = k === 'mm' ? conv(n) : n;
      entry[k] = round(v, 10);
    }
  }
  entry.src = src;
  return { ok: true, entry };
}

/**
 * Fold `entry` into `state.bodyweight` (mutates it; `t` is the write time that the sync merge
 * orders edits by). → { applied: true, replaced } or { applied: false, reason }.
 */
export function upsertWeighIn(state, entry, now = Date.now()) {
  if (!Array.isArray(state.bodyweight)) state.bodyweight = [];
  const list = state.bodyweight;
  const i = list.findIndex(b => b && b.d === entry.d);
  if (i >= 0 && list[i].src !== entry.src) return { applied: false, reason: 'that day already has a weigh-in from another source' };
  const row = { ...entry, t: now };
  if (i >= 0) list[i] = row; else list.push(row);
  list.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return { applied: true, replaced: i >= 0 };
}
