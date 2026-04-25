const { BetterStackClient } = require('./betterstack-client');

function classifyCandidates(candidates, canaryHits, today) {
  const cleared = [];
  const stillHit = [];
  const stillWatching = [];

  for (const item of candidates.items) {
    const hits = canaryHits.get(item.path) ?? 0;
    if (hits > 0) {
      stillHit.push({ ...item, canary_hits: hits });
    } else if (today >= item.soak_ends) {
      cleared.push({ ...item, canary_hits: 0 });
    } else {
      stillWatching.push({ ...item, canary_hits: 0, days_remaining: daysBetween(today, item.soak_ends) });
    }
  }
  return { cleared, stillHit, stillWatching };
}

function daysBetween(a, b) {
  const diff = new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z');
  return Math.ceil(diff / 86400000);
}

async function queryCanaryHits(client, paths) {
  if (paths.length === 0) return new Map();

  const escaped = paths.map(p => `'${p.replace(/'/g, "''")}'`).join(', ');
  const sql = `
    SELECT JSONExtractString(raw, 'candidate_path') AS path,
           toString(count()) AS hits
    FROM ${client.table}
    WHERE JSONExtractString(raw, 'event') = 'CANARY_HIT'
      AND JSONExtractString(raw, 'candidate_path') IN (${escaped})
    GROUP BY path
  `.trim();

  const response = await fetch(client.endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${client.token}`, 'Content-Type': 'text/plain' },
    body: sql,
  });
  if (!response.ok) throw new Error(`Canary query failed ${response.status}: ${await response.text()}`);
  const json = await response.json();

  const map = new Map();
  for (const p of paths) map.set(p, 0);
  for (const row of (json.data || [])) map.set(row.path, Number(row.hits));
  return map;
}

module.exports = { classifyCandidates, queryCanaryHits };
