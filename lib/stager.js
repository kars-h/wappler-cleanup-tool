const fs = require('fs-extra');
const path = require('path');
const { classifyRiskTier, computeSoakEnds } = require('./risk-tiers');

function buildStagedCandidates(fullScanReport, today, existing = { version: 1, items: [] }) {
  const existingByPath = new Map(existing.items.map(i => [i.path, i]));

  for (const action of fullScanReport.actions) {
    if (action.verdict !== 'stageable') continue;
    if (existingByPath.has(action.urlPath)) continue;

    const tier = classifyRiskTier(action.urlPath);
    existingByPath.set(action.urlPath, {
      path: action.urlPath,
      risk_tier: tier,
      candidate_since: today,
      soak_ends: computeSoakEnds(today, tier),
      signals: action.signals,
    });
  }

  return { version: existing.version || 1, items: Array.from(existingByPath.values()) };
}

async function stageCandidates({ fullScanReport, targetRepo, today = new Date().toISOString().slice(0, 10) }) {
  const candidatesPath = path.join(targetRepo, 'deletion-candidates.json');
  let existing = { version: 1, items: [] };
  if (await fs.pathExists(candidatesPath)) {
    existing = await fs.readJson(candidatesPath);
  }
  const updated = buildStagedCandidates(fullScanReport, today, existing);
  await fs.writeJson(candidatesPath, updated, { spaces: 2 });
  return updated;
}

module.exports = { buildStagedCandidates, stageCandidates };
