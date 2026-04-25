const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyRiskTier, soakDaysFor, computeSoakEnds } = require('../lib/risk-tiers');

test('high-risk patterns', () => {
  assert.equal(classifyRiskTier('/api/v1/queues/flags/actions/foo'), 'high');
  assert.equal(classifyRiskTier('/api/v1/security/magic-login'), 'high');
  assert.equal(classifyRiskTier('/api/v1/auth/verify'), 'high');
  assert.equal(classifyRiskTier('/api/v1/payments/webhook'), 'high');
  assert.equal(classifyRiskTier('/api/v1/webhooks/stripe'), 'high');
});

test('medium-risk patterns', () => {
  assert.equal(classifyRiskTier('/api/v1/admin/settings_general_edit'), 'medium');
});

test('low-risk fallback', () => {
  assert.equal(classifyRiskTier('/api/v1/courses/create'), 'low');
  assert.equal(classifyRiskTier('lib/util/format'), 'low');
});

test('soakDaysFor', () => {
  assert.equal(soakDaysFor('high'), 30);
  assert.equal(soakDaysFor('medium'), 14);
  assert.equal(soakDaysFor('low'), 7);
});

test('computeSoakEnds adds days to ISO date', () => {
  assert.equal(computeSoakEnds('2026-04-24', 'low'), '2026-05-01');
  assert.equal(computeSoakEnds('2026-04-24', 'medium'), '2026-05-08');
  assert.equal(computeSoakEnds('2026-04-24', 'high'), '2026-05-24');
});
