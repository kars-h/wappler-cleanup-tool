const test = require('node:test');
const assert = require('node:assert/strict');
const { BetterStackClient } = require('../lib/betterstack-client');

function mockFetch(response) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: response.ok !== false,
      status: response.status || 200,
      json: async () => response.body,
      text: async () => JSON.stringify(response.body),
    };
  };
  return calls;
}

test('getHitCounts returns hit map for known paths', async () => {
  const calls = mockFetch({
    body: {
      data: [
        { path: '/api/v1/foo', hits: '42' },
        { path: '/api/v1/bar', hits: '0' },
      ],
    },
  });

  const client = new BetterStackClient({
    token: 'test-token',
    endpoint: 'https://example.test/query',
    table: 'tXXXXXX.example_app',
  });
  const result = await client.getHitCounts(['/api/v1/foo', '/api/v1/bar', '/api/v1/missing'], 90);

  assert.equal(result.get('/api/v1/foo'), 42);
  assert.equal(result.get('/api/v1/bar'), 0);
  assert.equal(result.get('/api/v1/missing'), 0); // missing = 0 hits
  assert.equal(calls.length, 1);
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer test-token');
});

test('getHitCounts throws a clear error when token is missing', async () => {
  await assert.rejects(
    async () => new BetterStackClient({ endpoint: 'x', table: 'y' }).getHitCounts([], 90),
    /BETTERSTACK_TOKEN/
  );
});

test('getHitCounts handles non-ok response', async () => {
  mockFetch({ ok: false, status: 429, body: { error: 'rate limited' } });

  const client = new BetterStackClient({ token: 't', endpoint: 'x', table: 'y' });
  await assert.rejects(() => client.getHitCounts(['/a'], 90), /429/);
});
