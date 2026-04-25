const Scanner = require('./scanner');
const { BetterStackClient } = require('./betterstack-client');
const { findTestReferences } = require('./test-references');

function mergeSignals(scanResults, hits, testRefs) {
  const annotated = scanResults.actions.map(action => {
    const telemetry = hits.get(action.urlPath) ?? 0;
    const hasTests = testRefs.has(action.urlPath);

    let verdict;
    if (action.status === 'unreferenced-queue-module') {
      verdict = 'review';
    } else if (action.status === 'used' || telemetry > 0) {
      verdict = 'keep';
    } else if (hasTests) {
      verdict = 'review';
    } else {
      verdict = 'stageable';
    }

    return {
      ...action,
      signals: {
        static: action.status === 'used' ? 'used' : 'unused',
        telemetry_90d: telemetry,
        tests: hasTests,
      },
      verdict,
    };
  });
  return { ...scanResults, actions: annotated };
}

async function runFullScan({ projectRoot, betterstackTable }) {
  const scanner = new Scanner(projectRoot);
  const scanResults = await scanner.scan();

  const allPaths = scanResults.actions.map(a => a.urlPath);
  const client = new BetterStackClient({ table: betterstackTable });
  const hits = await client.getHitCounts(allPaths, 90);
  const testRefs = await findTestReferences(projectRoot, allPaths);

  return mergeSignals(scanResults, hits, testRefs);
}

module.exports = { runFullScan, mergeSignals };
