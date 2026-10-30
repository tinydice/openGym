import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIngestToken, findIngestToken, ingestTokenInfo, dropIngestToken, hashIngestToken, TOKEN_PREFIX } from '../ingest-token.js';

test('a token is random, prefixed, and only its hash is kept', () => {
  const db = {};
  const { token, row } = createIngestToken(db, 'u1', 1000);
  assert.ok(token.startsWith(TOKEN_PREFIX));
  assert.ok(token.length >= 40);
  assert.equal(row.h, hashIngestToken(token));
  assert.ok(!JSON.stringify(db).includes(token));
  assert.notEqual(createIngestToken({}, 'u1').token, token);
});

test('find: the right token, and nothing else', () => {
  const db = {};
  const a = createIngestToken(db, 'u1').token;
  const b = createIngestToken(db, 'u2').token;
  assert.equal(findIngestToken(db, a).userId, 'u1');
  assert.equal(findIngestToken(db, b).userId, 'u2');
  for (const bad of [undefined, null, '', 'ogw_', 'ogw_nope', a + 'x', a.slice(1), 42, 'x'.repeat(500)]) assert.equal(findIngestToken(db, bad), null);
  assert.equal(findIngestToken({}, a), null);
});

test('one per profile: a new token replaces the old, revoke removes it', () => {
  const db = {};
  const first = createIngestToken(db, 'u1', 1).token;
  const second = createIngestToken(db, 'u1', 2).token;
  assert.equal(db.ingestTokens.length, 1);
  assert.equal(findIngestToken(db, first), null);
  assert.equal(findIngestToken(db, second).userId, 'u1');
  assert.deepEqual(ingestTokenInfo(db, 'u1'), { active: true, created: 2, last: null });
  assert.equal(dropIngestToken(db, 'u1'), true);
  assert.equal(dropIngestToken(db, 'u1'), false);
  assert.deepEqual(ingestTokenInfo(db, 'u1'), { active: false, created: null, last: null });
  assert.equal(findIngestToken(db, second), null);
});
