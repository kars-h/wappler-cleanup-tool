#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const InteractiveMode = require('../lib/interactive-new');
const Scanner = require('../lib/scanner');
const { runFullScan } = require('../lib/full-scan');

program
  .version('1.0.0')
  .description('Wappler Project Cleanup Tool');

// Default subcommand: legacy interactive cleanup
program
  .command('clean', { isDefault: true })
  .description('Interactive cleanup (default)')
  .option('--non-interactive', 'run in non-interactive mode')
  .option('--dry-run', 'show what would be deleted without actually deleting')
  .option('--output <file>', 'output results to JSON file')
  .option('--project-root <path>', 'specify project root directory', process.cwd())
  .action(runLegacyInteractive);

program
  .command('scan')
  .description('Static-analysis scan (Signal 1 only)')
  .option('--full', 'also run Signal 2 (Better Stack) + Signal 3 (tests)')
  .option('--project-root <path>', 'project root', process.cwd())
  .option('--betterstack-table <table>', 'Better Stack table name', 'tXXXXXX.example_app')
  .option('--output <file>', 'write JSON report to file')
  .action(async (opts) => {
    const projectRoot = path.resolve(opts.projectRoot);
    let results;

    if (opts.full) {
      console.log(chalk.gray('Running full scan (static + telemetry + tests)...'));
      results = await runFullScan({ projectRoot, betterstackTable: opts.betterstackTable });
    } else {
      const scanner = new Scanner(projectRoot);
      results = await scanner.scan();
    }

    if (opts.output) {
      await fs.writeJson(opts.output, results, { spaces: 2 });
      console.log(chalk.green(`Report written to ${opts.output}`));
    } else {
      console.log(JSON.stringify(results.summary, null, 2));
    }
  });

program
  .command('stage')
  .description('Promote scan --full results into deletion-candidates.json')
  .requiredOption('--report <file>', 'path to scan --full JSON report')
  .requiredOption('--target <path>', 'target repo containing deletion-candidates.json')
  .action(async (opts) => {
    const { stageCandidates } = require('../lib/stager');
    const report = await fs.readJson(opts.report);
    const updated = await stageCandidates({ fullScanReport: report, targetRepo: path.resolve(opts.target) });
    const newCount = updated.items.length;
    console.log(chalk.green(`deletion-candidates.json updated: ${newCount} total items`));
  });

program
  .command('verify-canary')
  .description('Query Better Stack for CANARY_HIT events and classify candidates')
  .requiredOption('--target <path>', 'target repo with deletion-candidates.json')
  .option('--betterstack-table <table>', 'Better Stack table', 'tXXXXXX.example_app')
  .action(async (opts) => {
    const { classifyCandidates, queryCanaryHits } = require('../lib/canary-verifier');
    const candidatesPath = path.join(path.resolve(opts.target), 'deletion-candidates.json');
    const candidates = await fs.readJson(candidatesPath);

    const client = new (require('../lib/betterstack-client').BetterStackClient)({ table: opts.betterstackTable });
    const hits = await queryCanaryHits(client, candidates.items.map(i => i.path));
    const today = new Date().toISOString().slice(0, 10);
    const { cleared, stillHit, stillWatching } = classifyCandidates(candidates, hits, today);

    console.log(chalk.green(`\nCleared (${cleared.length}): safe to delete`));
    for (const c of cleared) console.log(`  ${c.path}`);

    console.log(chalk.red(`\nStill hit (${stillHit.length}): do NOT delete`));
    for (const c of stillHit) console.log(`  ${c.path}  (${c.canary_hits} hits)`);

    console.log(chalk.yellow(`\nStill watching (${stillWatching.length}): soak not yet complete`));
    for (const c of stillWatching) console.log(`  ${c.path}  (${c.days_remaining} days remaining)`);
  });

program
  .command('delete')
  .description('Delete action files whose canary has cleared')
  .requiredOption('--target <path>', 'target repo')
  .option('--betterstack-table <table>', 'Better Stack table', 'tXXXXXX.example_app')
  .option('--confirmed', 'actually delete (without this flag, prints what would be deleted)')
  .action(async (opts) => {
    const { classifyCandidates, queryCanaryHits } = require('../lib/canary-verifier');
    const { performDeletion } = require('../lib/deleter');

    const targetRepo = path.resolve(opts.target);
    const candidates = await fs.readJson(path.join(targetRepo, 'deletion-candidates.json'));
    const client = new (require('../lib/betterstack-client').BetterStackClient)({ table: opts.betterstackTable });
    const hits = await queryCanaryHits(client, candidates.items.map(i => i.path));
    const today = new Date().toISOString().slice(0, 10);
    const { cleared } = classifyCandidates(candidates, hits, today);

    if (cleared.length === 0) {
      console.log(chalk.yellow('Nothing cleared for deletion yet.'));
      return;
    }

    console.log(chalk.green(`Cleared for deletion (${cleared.length}):`));
    for (const c of cleared) console.log(`  ${c.path}`);

    if (!opts.confirmed) {
      console.log(chalk.gray('\nDry run. Re-run with --confirmed to perform deletion.'));
      return;
    }

    const { deleted } = await performDeletion({ targetRepo, cleared });
    console.log(chalk.green(`\nDeleted ${deleted.length} files:`));
    for (const f of deleted) console.log(`  ${f}`);

    console.log(chalk.cyan(`\nNext: review, then commit:`));
    console.log(chalk.cyan(`  cd ${targetRepo}`));
    console.log(chalk.cyan(`  git add -A`));
    console.log(chalk.cyan(`  git commit -m "chore: remove ${deleted.length} unused server actions (canary-cleared)"`));
  });

program.parse();

async function runLegacyInteractive(options) {
  console.log(chalk.blue.bold('\n🧹 Wappler Project Cleanup Tool\n'));
  const projectRoot = path.resolve(options.projectRoot);
  const scanner = new Scanner(projectRoot);
  console.log(chalk.gray('Scanning project for server actions and references...'));
  const results = await scanner.scan();

  if (options.nonInteractive) {
    const { Reporter } = require('../lib/reporter');
    const reporter = new Reporter(results);
    if (options.output) {
      await reporter.saveJson(options.output);
      console.log(chalk.green(`Results saved to ${options.output}`));
    } else {
      reporter.printSummary();
    }
  } else {
    const interactive = new InteractiveMode(results, options);
    await interactive.start();
  }
}
