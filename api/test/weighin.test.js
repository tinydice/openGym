import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWeighIn, upsertWeighIn } from '../weighin.js';

const NOW = Date.parse('2026-10-30T12:00:00Z');
const ok = (body, unit = 'lb') => { const r = parseWeighIn(body, unit, NOW); assert.equal(r.ok, true, JSON.stringify(r)); return r.entry; };
const bad = (body, unit = 'lb') => { const r = parseWeighIn(body, unit, NOW); assert.equal(r.ok, false, JSON.stringify(r)); return r.error; };

test('lb into an lb profile and kg into a kg profile are kept as sent', () => {
  assert.deepEqual(ok({ date: '2026-10-30', lb: 165.4 }, 'lb'), { d: '2026-10-30', w: 165.4, src: 'scale' });
  assert.deepEqual(ok({ date: '2026-10-30', kg: 75 }, 'kg'), { d: '2026-10-30', w: 75, src: 'scale' });
});
test('the other unit is converted, to two decimals', () => {
  assert.equal(ok({ date: '2026-10-30', kg: 75 }, 'lb').w, 165.35);
  assert.equal(ok({ date: '2026-10-30', lb: 165.35 }, 'kg').w, 75);
  assert.equal(ok({ date: '2026-10-30', kg: '75.5' }, 'kg').w, 75.5);   // a Shortcut sends text
});
test('extras are kept, muscle mass follows the weight\'s unit, empties are dropped', () => {
  const e = ok({ date: '2026-10-30', kg: 75, extras: { bf: 18.24, mm: 35, bw: 55.5, vf: 7, } }, 'lb');
  assert.equal(e.bf, 18.2); assert.equal(e.bw, 55.5); assert.equal(e.vf, 7);
  assert.equal(e.mm, 77.2);                  // 35 kg in lb
  assert.deepEqual(ok({ date: '2026-10-30', lb: 165, extras: { bf: null, mm: '' } }), { d: '2026-10-30', w: 165, src: 'scale' });
});
test('source is validated and stored', () => {
  assert.equal(ok({ date: '2026-10-30', lb: 165, source: 'vesync' }).src, 'vesync');
  bad({ date: '2026-10-30', lb: 165, source: 'Has Space' });
});
test('refuses what is not a weigh-in', () => {
  bad(null); bad([]); bad({});
  bad({ lb: 165 });
  bad({ date: '2026-10-30' });
  bad({ date: '2026-10-30', lb: 165, kg: 75 });
  bad({ date: '2026-10-30', lb: 'heavy' });
  bad({ date: '2026-10-30', lb: 5 });
  bad({ date: '2026-10-30', kg: 900 });
  bad({ date: '2026-02-30', lb: 165 });
  bad({ date: '30/10/2026', lb: 165 });
  bad({ date: '2026-11-05', lb: 165 });                  // the future
  bad({ date: '1999-12-31', lb: 165 });
  bad({ date: '2026-10-30', lb: 165, extra: 1 });         // unknown field
  bad({ date: '2026-10-30', lb: 165, extras: { fat: 1 } });
  bad({ date: '2026-10-30', lb: 165, extras: { bf: 120 } });
  bad({ date: '2026-10-30', lb: 165, extras: { bf: 'x' } });
  bad({ date: '2026-10-30', lb: 165, extras: [] });
});
test('tomorrow is allowed (a phone ahead of the server)', () => { ok({ date: '2026-10-31', lb: 165 }); });

test('upsert: adds in date order, replaces its own source, leaves another source alone', () => {
  const S = { bodyweight: [{ d: '2026-10-01', w: 170, t: 1 }, { d: '2026-10-29', w: 166, t: 2, src: 'scale' }] };
  assert.deepEqual(upsertWeighIn(S, { d: '2026-10-30', w: 165, src: 'scale' }, 99), { applied: true, replaced: false });
  assert.deepEqual(S.bodyweight.map(b => b.d), ['2026-10-01', '2026-10-29', '2026-10-30']);
  assert.equal(S.bodyweight[2].t, 99);
  assert.deepEqual(upsertWeighIn(S, { d: '2026-10-30', w: 164, bf: 18, src: 'scale' }, 100), { applied: true, replaced: true });
  assert.equal(S.bodyweight.length, 3);
  assert.deepEqual(S.bodyweight[2], { d: '2026-10-30', w: 164, bf: 18, src: 'scale', t: 100 });
  // an entry typed in the app (no src) is not overwritten
  const r = upsertWeighIn(S, { d: '2026-10-01', w: 150, src: 'scale' }, 101);
  assert.equal(r.applied, false);
  assert.equal(S.bodyweight[0].w, 170);
});
test('upsert makes the list when the profile has none', () => {
  const S = {};
  upsertWeighIn(S, { d: '2026-10-30', w: 165, src: 'scale' }, 5);
  assert.equal(S.bodyweight.length, 1);
});
