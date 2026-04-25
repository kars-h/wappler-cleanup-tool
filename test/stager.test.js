const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStagedCandidates } = require('../lib/stager');

test('buildStagedCandidates filters only stageable and assigns tier + dates', () => {
  const fullScanReport = {
    actions: [
      { urlPath: '/api/v1/courses/old', verdict: 'stageable', signals: { static: 'unused', telemetry_90d: 0, tests: false } },
      { urlPath: '/api/v1/courses/live', verdict: 'keep', signals: { static: 'used', telemetry_90d: 10, tests: false } },
      { urlPath: '/api/v1/security/old', verdict: 'stageable', signals: { static: 'unused', telemetry_90d: 0, tests: false } },
      { urlPath: '/api/v1/admin/old', verdict: 'stageable', signals: { static: 'unused', telemetry_90d: 0, tests: false } },
      { urlPath: '/api/v1/queues/flags/actions/x', verdict: 'review', signals: { static: 'unused', telemetry_90d: 0, tests: false } },
    ],
  };
  const today = '2026-04-24';
  const result = buildStagedCandidates(fullScanReport, today);

  assert.equal(result.items.length, 3);
  const byPath = Object.fromEntries(result.items.map(i => [i.path, i]));
  assert.equal(byPath['/api/v1/courses/old'].risk_tier, 'low');
  assert.equal(byPath['/api/v1/courses/old'].soak_ends, '2026-05-01');
  assert.equal(byPath['/api/v1/security/old'].risk_tier, 'high');
  assert.equal(byPath['/api/v1/security/old'].soak_ends, '2026-05-24');
  assert.equal(byPath['/api/v1/admin/old'].risk_tier, 'medium');
  assert.equal(byPath['/api/v1/admin/old'].soak_ends, '2026-05-08');
  assert.equal(result.items[0].candidate_since, today);
});

test('buildStagedCandidates preserves existing items and adds only new', () => {
  const existing = {
    version: 1,
    items: [{ path: '/api/v1/a', risk_tier: 'low', candidate_since: '2026-04-01', soak_ends: '2026-04-08', signals: {} }],
  };
  const report = {
    actions: [
      { urlPath: '/api/v1/a', verdict: 'stageable', signals: {} },
      { urlPath: '/api/v1/b', verdict: 'stageable', signals: {} },
    ],
  };
  const merged = buildStagedCandidates(report, '2026-04-24', existing);
  assert.equal(merged.items.length, 2);
  assert.equal(merged.items[0].candidate_since, '2026-04-01');
});
