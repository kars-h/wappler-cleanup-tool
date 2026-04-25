const DEFAULT_ENDPOINT = 'https://eu-nbg-2-connect.betterstackdata.com/';

class BetterStackClient {
  constructor({ token, endpoint, table }) {
    this.token = token || process.env.BETTERSTACK_TOKEN;
    this.endpoint = endpoint || DEFAULT_ENDPOINT;
    this.table = table;
  }

  async getHitCounts(urlPaths, days = 90) {
    if (!this.token) {
      throw new Error('BETTERSTACK_TOKEN env var is required to query telemetry.');
    }
    if (urlPaths.length === 0) return new Map();

    const escaped = urlPaths.map(p => `'${p.replace(/'/g, "''")}'`).join(', ');
    const sql = `
      SELECT JSONExtractString(raw, 'server_action_path') AS path,
             toString(count()) AS hits
      FROM ${this.table}
      WHERE dt > now() - INTERVAL ${days} DAY
        AND JSONExtractString(raw, 'server_action_path') IN (${escaped})
      GROUP BY path
    `.trim();

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'text/plain',
      },
      body: sql,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Better Stack query failed ${response.status}: ${body}`);
    }

    const json = await response.json();
    const rows = json.data || [];
    const map = new Map();
    for (const p of urlPaths) map.set(p, 0);
    for (const row of rows) map.set(row.path, Number(row.hits));
    return map;
  }
}

module.exports = { BetterStackClient };
