/* POST /api/weighin and the ingest token that opens it: real server.js in a child. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { hashIngestToken } from '../ingest-token.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = crypto.randomBytes(32).toString('hex');
function mintSession(uid, sv = 0) {
  const payload = `${uid}:${Date.now() + 86400000}:${sv}`;
  return payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}
const cookie = uid => ({ Cookie: `gymsid=${mintSession(uid)}`, 'Content-Type': 'application/json' });
const bearer = tok => ({ Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' });
const today = () => new Date().toISOString().slice(0, 10);

async function startServer(t, users = [{ id: 'u_w1', name: 'One' }, { id: 'u_w2', name: 'Two' }], extraDb = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-weighin-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({ users: users.map(u => ({ ...u, created: new Date().toISOString() })), creds: [], subs: [], invites: [], ...extraDb }));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost' }
  });
  const h = { log: '', dataDir };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  h.api = `http://127.0.0.1:${await boundPort(child, () => h.log)}`;
  h.call = async (method, url, headers, body) => {
    const r = await fetch(h.api + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  h.state = uid => JSON.parse(fs.readFileSync(path.join(dataDir, `state-${uid}.json`), 'utf8'));
  h.seed = (uid, S) => fs.writeFileSync(path.join(dataDir, `state-${uid}.json`), JSON.stringify(S));
  h.token = async uid => (await h.call('POST', '/api/account/ingest-token', cookie(uid), {})).body.token;
  return h;
}

const BASE = () => ({
  unit: 'lb', routines: [], workouts: [{ id: 'w1', d: '2026-10-01', name: 'A', entries: [] }],
  bodyweight: [{ d: '2026-10-01', w: 170, t: 1 }], _rev: 7, _wid: 'aaaa', _wids: [], _ts: 5
});

test('the token: made once, kept hashed, revocable, and one per profile', async t => {
  const h = await startServer(t);
  assert.equal((await h.call('POST', '/api/account/ingest-token', { 'Content-Type': 'application/json' }, {})).status, 401);
  assert.deepEqual((await h.call('GET', '/api/account/ingest-token', cookie('u_w1'))).body, { active: false, created: null, last: null });
  const a = await h.call('POST', '/api/account/ingest-token', cookie('u_w1'), {});
  assert.equal(a.status, 200);
  assert.match(a.body.token, /^ogw_/);
  const db = fs.readFileSync(path.join(h.dataDir, 'db.json'), 'utf8');
  assert.ok(!db.includes(a.body.token), 'db.json holds no usable token');
  assert.ok(db.includes('ingestTokens'));
  assert.equal((await h.call('GET', '/api/account/ingest-token', cookie('u_w1'))).body.active, true);
  assert.equal((await h.call('GET', '/api/account/ingest-token', cookie('u_w1'))).body.token, undefined);
  const b = await h.call('POST', '/api/account/ingest-token', cookie('u_w1'), {});
  h.seed('u_w1', BASE());
  assert.equal((await h.call('POST', '/api/weighin', bearer(a.body.token), { date: today(), lb: 165 })).status, 401, 'rotated token is dead');
  assert.equal((await h.call('POST', '/api/weighin', bearer(b.body.token), { date: today(), lb: 165 })).status, 200);
  assert.equal((await h.call('DELETE', '/api/account/ingest-token', cookie('u_w1'))).body.active, false);
  assert.equal((await h.call('POST', '/api/weighin', bearer(b.body.token), { date: today(), lb: 164 })).status, 401, 'revoked');
});

test('the token opens POST /api/weighin and nothing else; a session does not open it', async t => {
  const h = await startServer(t);
  h.seed('u_w1', BASE());
  const tok = await h.token('u_w1');
  for (const [m, u] of [['GET', '/api/data'], ['GET', '/api/data/rev'], ['PUT', '/api/data'], ['GET', '/api/account/ingest-token']]) {
    assert.equal((await h.call(m, u, bearer(tok), m === 'PUT' ? { state: { routines: [] } } : undefined)).status, 401, m + ' ' + u);
  }
  assert.equal((await h.call('POST', '/api/weighin', cookie('u_w1'), { date: today(), lb: 165 })).status, 401);
  assert.equal((await h.call('POST', '/api/weighin', { 'Content-Type': 'application/json' }, { date: today(), lb: 165 })).status, 401);
  assert.equal((await h.call('POST', '/api/weighin', bearer('ogw_wrong'), { date: today(), lb: 165 })).status, 401);
  assert.equal(h.state('u_w1')._rev, 7, 'nothing was written');
});

test('a weigh-in lands in the profile, moves the revision, and leaves the rest alone', async t => {
  const h = await startServer(t);
  h.seed('u_w1', BASE());
  const tok = await h.token('u_w1');
  const before = (await h.call('GET', '/api/data/rev', cookie('u_w1'))).body;
  assert.equal(before.rev, 7);
  const r = await h.call('POST', '/api/weighin', bearer(tok), { date: '2026-10-29', kg: 75, extras: { bf: 18.2, vf: 7 } });
  assert.equal(r.status, 200);
  assert.equal(r.body.applied, true);
  assert.equal(r.body.unit, 'lb');
  assert.equal(r.body.rev, 8);
  const S = h.state('u_w1');
  assert.equal(S._rev, 8);
  assert.notEqual(S._wid, 'aaaa');
  assert.deepEqual(S._wids, ['aaaa']);
  assert.deepEqual(S.bodyweight.map(b => [b.d, b.w, b.src, b.bf, b.vf]), [['2026-10-01', 170, undefined, undefined, undefined], ['2026-10-29', 165.35, 'scale', 18.2, 7]]);
  assert.ok(S.bodyweight[1].t > 0);
  assert.deepEqual(S.workouts, BASE().workouts);
  assert.equal(S.unit, 'lb');
  // what an open client polls (the cached rev route) sees it, with the new write id
  const after = (await h.call('GET', '/api/data/rev', cookie('u_w1'))).body;
  assert.equal(after.rev, 8);
  assert.equal(after.wid, S._wid);
  // and a conditional push from a client still holding rev 7 is a conflict, with the entry in the reply
  const put = await h.call('PUT', '/api/data', cookie('u_w1'), { state: BASE(), baseRev: 7 });
  assert.equal(put.status, 409);
  assert.equal(put.body.state.bodyweight.length, 2);
});

test('one entry per day and source: same source replaces, another source is left alone', async t => {
  const h = await startServer(t);
  h.seed('u_w1', BASE());
  const tok = await h.token('u_w1');
  const post = b => h.call('POST', '/api/weighin', bearer(tok), b);
  assert.equal((await post({ date: '2026-10-29', lb: 166 })).body.replaced, false);
  const again = await post({ date: '2026-10-29', lb: 165, extras: { bf: 19 } });
  assert.equal(again.body.replaced, true);
  let S = h.state('u_w1');
  assert.equal(S.bodyweight.filter(b => b.d === '2026-10-29').length, 1);
  assert.equal(S.bodyweight.find(b => b.d === '2026-10-29').w, 165);
  assert.equal(S.bodyweight.find(b => b.d === '2026-10-29').bf, 19);
  // a replacement without extras drops the old extras (it is the day's whole reading)
  await post({ date: '2026-10-29', lb: 164 });
  assert.equal(h.state('u_w1').bodyweight.find(b => b.d === '2026-10-29').bf, undefined);
  // the typed entry for 10-01 is not overwritten, and no revision is spent
  const rev = h.state('u_w1')._rev;
  const skip = await post({ date: '2026-10-01', lb: 150 });
  assert.equal(skip.status, 200);
  assert.equal(skip.body.applied, false);
  assert.equal(h.state('u_w1')._rev, rev);
  assert.equal(h.state('u_w1').bodyweight[0].w, 170);
});

test('bad bodies are 400 and write nothing; a profile with no data is 409', async t => {
  const h = await startServer(t);
  const tok = await h.token('u_w1');
  const post = b => h.call('POST', '/api/weighin', bearer(tok), b);
  assert.equal((await post({ date: today(), lb: 165 })).status, 409);
  h.seed('u_w1', BASE());
  for (const body of [{}, { date: today() }, { date: today(), lb: 165, kg: 75 }, { date: 'x', lb: 165 }, { date: today(), lb: -3 }, { date: today(), lb: 165, extras: { zz: 1 } }]) {
    assert.equal((await post(body)).status, 400, JSON.stringify(body));
  }
  assert.equal(h.state('u_w1')._rev, 7);
});

test('a token writes only to its own profile', async t => {
  const h = await startServer(t);
  h.seed('u_w1', BASE());
  h.seed('u_w2', { ...BASE(), unit: 'kg', bodyweight: [] });
  const tok2 = await h.token('u_w2');
  const r = await h.call('POST', '/api/weighin', bearer(tok2), { date: today(), lb: 165.35 });
  assert.equal(r.body.unit, 'kg');
  assert.equal(h.state('u_w2').bodyweight[0].w, 75);
  assert.equal(h.state('u_w1')._rev, 7);
});

test('a disabled profile\'s token stops working', async t => {
  const tok = 'ogw_' + crypto.randomBytes(32).toString('base64url');
  const h = await startServer(t, [{ id: 'u_w1', name: 'One', disabled: true }, { id: 'u_w2', name: 'Two' }],
    { ingestTokens: [{ h: hashIngestToken(tok), userId: 'u_w1', created: 1 }] });
  h.seed('u_w1', BASE());
  const r = await h.call('POST', '/api/weighin', bearer(tok), { date: today(), lb: 165 });
  assert.equal(r.status, 401);
  assert.equal(h.state('u_w1')._rev, 7);
});
