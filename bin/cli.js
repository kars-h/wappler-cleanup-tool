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
