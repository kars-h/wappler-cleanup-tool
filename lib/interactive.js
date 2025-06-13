const inquirer = require('inquirer');
const chalk = require('chalk');
const { table } = require('table');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');
const keypress = require('keypress');

class InteractiveMode {
  constructor(results, options = {}) {
    this.results = results;
    this.options = options;
    this.selectedForDeletion = new Set();
  }

  async start() {
    console.log(this.formatSummary());
    
    while (true) {
      const action = await this.showMainMenu();
      
      switch (action) {
        case 'view_unused':
          await this.viewUnusedActions();
          break;
        case 'view_all':
          await this.viewAllActions();
          break;
        case 'select_delete':
          await this.selectActionsForDeletion();
          break;
        case 'export':
          await this.exportResults();
          break;
        case 'execute_delete':
          await this.executeDelete();
          break;
        case 'exit':
          console.log(chalk.green('Goodbye! 👋'));
          return;
      }
    }
  }

  formatSummary() {
    const { summary } = this.results;
    return `
${chalk.blue.bold('📊 Scan Results Summary')}

${chalk.green('✅ Used actions:')} ${summary.used}
${chalk.yellow('⚠️  Possibly unused:')} ${summary.possiblyUnused}  
${chalk.red('🗑️  Likely unused:')} ${summary.likelyUnused}
${chalk.gray('━'.repeat(40))}
${chalk.bold('Total actions:')} ${summary.totalActions}
`;
  }

  async showMainMenu() {
    const choices = [
      {
        name: `${chalk.red('🗑️')} View likely unused actions (${this.results.summary.likelyUnused})`,
        value: 'view_unused'
      },
      {
        name: `${chalk.blue('📋')} View all actions (${this.results.summary.totalActions})`,
        value: 'view_all'
      },
      {
        name: `${chalk.yellow('☑️')} Select actions for deletion (${this.selectedForDeletion.size} selected)`,
        value: 'select_delete'
      },
      {
        name: `${chalk.cyan('💾')} Export results to JSON`,
        value: 'export'
      }
    ];

    if (this.selectedForDeletion.size > 0) {
      choices.push({
        name: `${chalk.red.bold('🚨 DELETE')} selected actions (${this.selectedForDeletion.size})`,
        value: 'execute_delete'
      });
    }

    choices.push({
      name: `${chalk.gray('👋')} Exit`,
      value: 'exit'
    });

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices,
        pageSize: 10
      }
    ]);

    return action;
  }

  async viewUnusedActions() {
    const unusedActions = this.results.actions.filter(
      action => action.status === 'likely-unused' || action.status === 'possibly-unused'
    );

    if (unusedActions.length === 0) {
      console.log(chalk.green('\n🎉 No unused actions found!\n'));
      return;
    }

    await this.displayActionsTable(unusedActions, 'Potentially Unused Actions');
  }

  async viewAllActions() {
    await this.displayActionsTable(this.results.actions, 'All Server Actions');
  }

  async displayActionsTable(actions, title) {
    console.log(chalk.blue.bold(`\n📋 ${title}\n`));

    const data = [
      [
        chalk.bold('Status'),
        chalk.bold('Confidence'), 
        chalk.bold('Refs'),
        chalk.bold('Action Path'),
        chalk.bold('File Path')
      ]
    ];

    for (const action of actions.slice(0, 20)) { // Show first 20
      const statusIcon = this.getStatusIcon(action.status);
      const confidenceColor = this.getConfidenceColor(action.confidence);
      
      data.push([
        statusIcon,
        confidenceColor(action.confidence),
        action.referenceCount.toString(),
        this.truncate(action.urlPath, 40),
        this.truncate(action.filePath, 50)
      ]);
    }

    console.log(table(data, {
      border: {
        topBody: '─',
        topJoin: '┬',
        topLeft: '┌',
        topRight: '┐',
        bottomBody: '─',
        bottomJoin: '┴',
        bottomLeft: '└',
        bottomRight: '┘',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│'
      }
    }));

    if (actions.length > 20) {
      console.log(chalk.gray(`... and ${actions.length - 20} more actions\n`));
    }

    // Ask if user wants to see details for any specific action
    const { viewDetails } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'viewDetails',
        message: 'Would you like to see details for a specific action?',
        default: false
      }
    ]);

    if (viewDetails) {
      await this.showActionDetails(actions);
    }
  }

  async showActionDetails(actions) {
    const choices = actions.map((action, index) => ({
      name: `${this.getStatusIcon(action.status)} ${action.urlPath} (${action.referenceCount} refs)`,
      value: index
    }));

    const { selectedIndex } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedIndex',
        message: 'Select an action to view details:',
        choices,
        pageSize: 15
      }
    ]);

    const action = actions[selectedIndex];
    this.displayActionDetails(action);
  }

  displayActionDetails(action) {
    console.log(`
${chalk.blue.bold('🔍 Action Details')}

${chalk.bold('URL Path:')} ${action.urlPath}
${chalk.bold('File Path:')} ${action.filePath}
${chalk.bold('Status:')} ${this.getStatusIcon(action.status)} ${action.status}
${chalk.bold('Confidence:')} ${this.getConfidenceColor(action.confidence)(action.confidence)}
${chalk.bold('References:')} ${action.referenceCount}

${chalk.bold('📁 References Found:')}
${action.references.length === 0 ? 
  chalk.gray('  No references found') : 
  action.references.map(ref => 
    `  ${chalk.cyan(ref.type)}: ${ref.sourceFile}`
  ).join('\n')
}

${chalk.bold('📄 Action Content:')}
${chalk.gray(JSON.stringify(action.content, null, 2).slice(0, 500))}${action.content ? '...' : ''}
`);
  }

  async selectActionsForDeletion() {
    const unusedActions = this.results.actions.filter(
      action => action.status === 'likely-unused' || action.status === 'possibly-unused'
    );

    if (unusedActions.length === 0) {
      console.log(chalk.green('\n🎉 No potentially unused actions found!\n'));
      return;
    }

    const choices = [
      new inquirer.Separator(chalk.gray('─── Actions ───')),
      ...unusedActions.map(action => ({
        name: `${this.getStatusIcon(action.status)} ${action.urlPath} (${this.getConfidenceColor(action.confidence)(action.confidence)} confidence)`,
        value: action.urlPath,
        checked: this.selectedForDeletion.has(action.urlPath)
      })),
      new inquirer.Separator(),
      {
        name: chalk.cyan('↩️  Back to main menu'),
        value: '__BACK_TO_MENU__'
      }
    ];

    // Create a custom checkbox prompt with ESC handling
    const result = await this.customCheckboxPrompt(choices);
    
    // If user escaped, return early
    if (result === null) {
      console.log(chalk.yellow('\n↩️ Returning to main menu...\n'));
      return;
    }

    const { selected } = result;

    // Check if user selected "Back to main menu"
    if (selected.includes('__BACK_TO_MENU__')) {
      console.log(chalk.yellow('\n↩️ Returning to main menu...\n'));
      return;
    }

    this.selectedForDeletion.clear();
    selected.forEach(path => this.selectedForDeletion.add(path));

    console.log(chalk.green(`\n✅ Selected ${this.selectedForDeletion.size} actions for deletion\n`));
  }

  async exportResults() {
    const { filename } = await inquirer.prompt([
      {
        type: 'input',
        name: 'filename',
        message: 'Export filename:',
        default: `server-action-analysis-${new Date().toISOString().split('T')[0]}.json`
      }
    ]);

    const spinner = ora('Exporting results...').start();
    
    try {
      await fs.writeJson(filename, this.results, { spaces: 2 });
      spinner.succeed(`Results exported to ${chalk.green(filename)}`);
    } catch (error) {
      spinner.fail('Export failed');
      console.error(chalk.red(error.message));
    }
  }

  async executeDelete() {
    if (this.selectedForDeletion.size === 0) {
      console.log(chalk.yellow('\n⚠️ No actions selected for deletion\n'));
      return;
    }

    // Show what will be deleted
    console.log(chalk.red.bold('\n🚨 WARNING: The following actions will be PERMANENTLY DELETED:\n'));
    
    for (const urlPath of this.selectedForDeletion) {
      const action = this.results.actions.find(a => a.urlPath === urlPath);
      console.log(`  ${chalk.red('🗑️')} ${action.filePath}`);
    }

    // Confirmation
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red.bold('Are you ABSOLUTELY SURE you want to delete these files?'),
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.green('\n✅ Deletion cancelled\n'));
      return;
    }

    // Create backup first
    const { createBackup } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'createBackup',
        message: 'Create backup before deletion?',
        default: true
      }
    ]);

    const spinner = ora('Processing deletion...').start();

    try {
      let backupDir = null;
      
      if (createBackup) {
        backupDir = `backups/server-actions-${Date.now()}`;
        await fs.ensureDir(backupDir);
        
        for (const urlPath of this.selectedForDeletion) {
          const action = this.results.actions.find(a => a.urlPath === urlPath);
          const sourcePath = path.join(this.options.projectRoot || process.cwd(), action.filePath);
          const backupPath = path.join(backupDir, action.filePath);
          
          await fs.ensureDir(path.dirname(backupPath));
          await fs.copy(sourcePath, backupPath);
        }
        
        spinner.text = 'Backup created. Deleting files...';
      }

      // Delete the files
      let deletedCount = 0;
      for (const urlPath of this.selectedForDeletion) {
        const action = this.results.actions.find(a => a.urlPath === urlPath);
        const filePath = path.join(this.options.projectRoot || process.cwd(), action.filePath);
        
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
          deletedCount++;
        }
      }

      spinner.succeed(`Successfully deleted ${deletedCount} server actions`);
      
      if (backupDir) {
        console.log(chalk.blue(`📦 Backup created: ${backupDir}`));
      }

      // Clear selection
      this.selectedForDeletion.clear();

    } catch (error) {
      spinner.fail('Deletion failed');
      console.error(chalk.red(error.message));
    }
  }

  getStatusIcon(status) {
    switch (status) {
      case 'used': return chalk.green('✅');
      case 'possibly-unused': return chalk.yellow('⚠️');
      case 'likely-unused': return chalk.red('🗑️');
      default: return '❓';
    }
  }

  getConfidenceColor(confidence) {
    switch (confidence) {
      case 'high': return chalk.red;
      case 'medium': return chalk.yellow;
      case 'low': return chalk.green;
      default: return chalk.gray;
    }
  }

  truncate(str, length) {
    return str.length > length ? str.substring(0, length - 3) + '...' : str;
  }

  async customCheckboxPrompt(choices) {
    // Let's use a simpler approach - just use the "Back to main menu" option
    // ESC key handling with inquirer is complex and causes UI conflicts
    
    const result = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: 'Select actions to delete (use the "Back to main menu" option to go back):',
        choices,
        pageSize: 15
      }
    ]);

    return result;
  }
}

module.exports = InteractiveMode;