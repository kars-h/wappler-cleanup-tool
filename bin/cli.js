#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');
const InteractiveMode = require('../lib/interactive-new');
const Scanner = require('../lib/scanner');

program
  .version('1.0.0')
  .description('Wappler Project Cleanup Tool')
  .option('--non-interactive', 'run in non-interactive mode')
  .option('--dry-run', 'show what would be deleted without actually deleting')
  .option('--output <file>', 'output results to JSON file')
  .option('--project-root <path>', 'specify project root directory', process.cwd())
  .parse();

const options = program.opts();

async function main() {
  console.log(chalk.blue.bold('\n🧹 Wappler Project Cleanup Tool\n'));
  
  try {
    const projectRoot = path.resolve(options.projectRoot);
    const scanner = new Scanner(projectRoot);
    
    // Always scan first
    console.log(chalk.gray('Scanning project for server actions and references...'));
    const results = await scanner.scan();
    
    if (options.nonInteractive) {
      // Non-interactive mode - just show results
      const { Reporter } = require('../lib/reporter');
      const reporter = new Reporter(results);
      
      if (options.output) {
        await reporter.saveJson(options.output);
        console.log(chalk.green(`Results saved to ${options.output}`));
      } else {
        reporter.printSummary();
      }
    } else {
      // Default: Interactive mode
      const interactive = new InteractiveMode(results, options);
      await interactive.start();
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

main();