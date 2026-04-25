const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyCandidates } = require('../lib/canary-verifier');

test('classifyCandidates sorts items into cleared / still-hit / still-watching', () => {
  const today = '2026-05-10';
  const candidates = {
    items: [
      { path: '/a', candidate_since: '2026-04-24', soak_ends: '2026-05-01', risk_tier: 'low' },
      { path: '/b', candidate_since: '2026-04-24', soak_ends: '2026-05-01', risk_tier: 'low' },
      { path: '/c', candidate_since: '2026-05-05', soak_ends: '2026-05-12', risk_tier: 'low' },
    ],
  };
  const canaryHits = new Map([
    ['/a', 0],
    ['/b', 7],
    ['/c', 0],
  ]);

  const { cleared, stillHit, stillWatching } = classifyCandidates(candidates, canaryHits, today);

  assert.deepEqual(cleared.map(c => c.path), ['/a']);
  assert.deepEqual(stillHit.map(c => c.path), ['/b']);
  assert.deepEqual(stillWatching.map(c => c.path), ['/c']);
});
