const HIGH_PATTERNS = [
  /^\/?api\/v1\/queues(\/|$)/,
  /^\/?api\/v1\/security(\/|$)/,
  /^\/?api\/v1\/auth(\/|$)/,
  /^\/?api\/v1\/payments(\/|$)/,
  /^\/?api\/v1\/webhooks(\/|$)/,
];

const MEDIUM_PATTERNS = [
  /^\/?api\/v1\/admin(\/|$)/,
];

const SOAK_DAYS = { high: 30, medium: 14, low: 7 };

function classifyRiskTier(urlPath) {
  for (const rx of HIGH_PATTERNS) if (rx.test(urlPath)) return 'high';
  for (const rx of MEDIUM_PATTERNS) if (rx.test(urlPath)) return 'medium';
  return 'low';
}

function soakDaysFor(tier) {
  return SOAK_DAYS[tier];
}

function computeSoakEnds(isoDate, tier) {
  const days = soakDaysFor(tier);
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

module.exports = { classifyRiskTier, soakDaysFor, computeSoakEnds };
