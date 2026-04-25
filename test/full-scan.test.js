const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeSignals } = require('../lib/full-scan');

test('mergeSignals annotates each action with signals and verdict', () => {
  const scanResults = {
    summary: { totalActions: 3, used: 1, possiblyUnused: 1, likelyUnused: 1 },
    actions: [
      { urlPath: '/api/v1/a', status: 'used', confidence: 'review-needed', referenceCount: 3 },
      { urlPath: '/api/v1/b', status: 'unused', confidence: 'safe-to-delete', referenceCount: 0 },
      { urlPath: '/api/v1/c', status: 'unreferenced-queue-module', confidence: 'review-needed', referenceCount: 0 },
    ],
  };
  const hits = new Map([
    ['/api/v1/a', 100],
    ['/api/v1/b', 0],
    ['/api/v1/c', 0],
  ]);
  const testRefs = new Set(['/api/v1/a']);

  const merged = mergeSignals(scanResults, hits, testRefs);

  const byPath = Object.fromEntries(merged.actions.map(a => [a.urlPath, a]));
  assert.equal(byPath['/api/v1/a'].signals.telemetry_90d, 100);
  assert.equal(byPath['/api/v1/a'].signals.tests, true);
  assert.equal(byPath['/api/v1/a'].verdict, 'keep');

  assert.equal(byPath['/api/v1/b'].signals.telemetry_90d, 0);
  assert.equal(byPath['/api/v1/b'].signals.tests, false);
  assert.equal(byPath['/api/v1/b'].verdict, 'stageable');

  // queue module: never auto-stageable even with zero signals
  assert.equal(byPath['/api/v1/c'].verdict, 'review');
});
