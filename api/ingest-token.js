/* The weigh-in ingest token: a long-lived credential that can do one thing, POST /api/weighin.
 *
 * It is for a script on the person's own phone or computer (an iOS Shortcut reading Apple Health,
 * a cron job) that has no cookie and no passkey. So, like a device link (device-link.js):
 *
 *   - random, 256 bits, shown once when it is made and stored only as a SHA-256: a copy of db.json
 *     holds no token that works. The token is random, so a slow hash would add nothing;
 *   - one per profile: making a new one replaces the one before (that is how it is rotated);
 *   - it is not a session: the session routes never accept it, and it is accepted nowhere but
 *     POST /api/weighin. A leaked one can add weigh-ins to that profile, not read or change
 *     anything else. Revoked from Settings, or by deleting the profile.
 *
 * Pure bookkeeping on `db.ingestTokens`; the routes and the audit are server.js's. */
import crypto from 'node:crypto';

export const TOKEN_PREFIX = 'ogw_';

export function makeIngestToken() {
  return TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
}
export const hashIngestToken = token => crypto.createHash('sha256').update('opengym-ingest:' + token).digest('hex');

// → { token, row }. The token is returned once and never stored.
export function createIngestToken(db, userId, now = Date.now()) {
  db.ingestTokens = (db.ingestTokens || []).filter(r => r && r.userId !== userId);
  const token = makeIngestToken();
  const row = { h: hashIngestToken(token), userId, created: now };
  db.ingestTokens.push(row);
  return { token, row };
}

// The row a token belongs to, or null — a wrong, malformed and revoked token all look the same.
export function findIngestToken(db, token) {
  if (typeof token !== 'string' || !token.startsWith(TOKEN_PREFIX) || token.length > 200) return null;
  const h = Buffer.from(hashIngestToken(token), 'hex');
  return (db.ingestTokens || []).find(r => {
    if (!r || typeof r.h !== 'string') return false;
    const stored = Buffer.from(r.h, 'hex');
    return stored.length === h.length && crypto.timingSafeEqual(stored, h);
  }) || null;
}

// What Settings may know about a profile's token: whether there is one, never anything of it.
export function ingestTokenInfo(db, userId) {
  const r = (db.ingestTokens || []).find(x => x && x.userId === userId);
  return r ? { active: true, created: r.created, last: r.last || null } : { active: false, created: null, last: null };
}

// Says whether anything went, so a caller can skip a save.
export function dropIngestToken(db, userId) {
  const before = (db.ingestTokens || []).length;
  db.ingestTokens = (db.ingestTokens || []).filter(r => r && r.userId !== userId);
  return db.ingestTokens.length !== before;
}
