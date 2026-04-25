const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { findTestReferences } = require('../lib/test-references');

const FIXTURE = path.join(__dirname, 'fixtures/mini-project');

test('detects url paths referenced from test files', async () => {
  const refs = await findTestReferences(FIXTURE, ['/api/v1/foo/bar', '/api/v1/unused']);
  assert.equal(refs.has('/api/v1/foo/bar'), true);
  assert.equal(refs.has('/api/v1/unused'), false);
});

test('returns an empty set when no test directory exists', async () => {
  const refs = await findTestReferences('/nonexistent', ['/api/v1/foo']);
  assert.equal(refs.size, 0);
});
