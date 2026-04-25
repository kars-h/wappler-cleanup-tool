const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { performDeletion } = require('../lib/deleter');

test('performDeletion removes cleared action files and rewrites candidates.json', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'wct-del-'));

  const fileA = path.join(tmp, 'app/api/v1/courses/old.json');
  const fileB = path.join(tmp, 'app/api/v1/other/keep.json');
  await fs.outputFile(fileA, '{}');
  await fs.outputFile(fileB, '{}');

  const candidates = {
    version: 1,
    items: [
      { path: '/api/v1/courses/old', risk_tier: 'low', candidate_since: '2026-04-24', soak_ends: '2026-05-01', signals: {} },
      { path: '/api/v1/other/keep', risk_tier: 'low', candidate_since: '2026-04-24', soak_ends: '2026-05-01', signals: {} },
    ],
  };
  await fs.writeJson(path.join(tmp, 'deletion-candidates.json'), candidates);

  const cleared = [candidates.items[0]];
  const result = await performDeletion({ targetRepo: tmp, cleared });

  assert.equal(await fs.pathExists(fileA), false, 'cleared file removed');
  assert.equal(await fs.pathExists(fileB), true, 'non-cleared file kept');
  const updated = await fs.readJson(path.join(tmp, 'deletion-candidates.json'));
  assert.equal(updated.items.length, 1);
  assert.equal(updated.items[0].path, '/api/v1/other/keep');
  assert.deepEqual(result.deleted, ['app/api/v1/courses/old.json']);

  await fs.remove(tmp);
});
