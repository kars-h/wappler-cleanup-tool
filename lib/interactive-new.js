const inquirer = require('inquirer');
const chalk = require('chalk');
const { table } = require('table');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');
const IgnoreList = require('./ignore-list');
const KeyboardNavigation = require('./keyboard-nav');
const EmptyFolderDetector = require('./empty-folders');
const RoutesScanner = require('./routes-scanner');
const RoutesIgnoreList = require('./routes-ignore-list');
const RoutesKeyboardNavigation = require('./routes-keyboard-nav');

class InteractiveMode {
  constructor(results, options = {}) {
    this.results = results;
    this.options = options;
    this.selectedForDeletion = new Set();
    this.ignoreList = new IgnoreList(options.projectRoot || process.cwd());
    this.currentFilter = 'safe-only'; // Default to safe-to-delete only
  }

  async start() {
    // Wait for ignore list to load
    await this.ignoreList.loadIgnoreList();
    
    console.log(this.formatSummary());
    
    while (true) {
      const action = await this.showMainMenu();
      
      switch (action) {
        case 'manage_actions':
          await this.manageActions();
          break;
        case 'scan_routes':
          await this.scanDeadRoutes();
          break;
        case 'export':
          await this.exportResults();
          break;
        case 'execute_delete':
          await this.executeDelete();
          break;
        case 'view_ignored':
          await this.viewIgnoredActions();
          break;
        case 'manage_empty_folders':
          await this.manageEmptyFolders();
          break;
        case 'exit':
          console.log(chalk.green('Goodbye! 👋'));
          return;
      }
    }
  }

  formatSummary() {
    const { summary } = this.results;
    const ignoredCount = this.ignoreList.getIgnoredActions().length;
    const emptyFoldersCount = this.results.emptyFolders ? this.results.emptyFolders.length : 0;
    
    return `
${chalk.blue.bold('📊 Scan Results Summary')}

${chalk.green('✅ Used actions:')} ${summary.used}
${chalk.yellow('⚠️  Possibly unused:')} ${summary.possiblyUnused}  
${chalk.red('🗑️  Likely unused:')} ${summary.likelyUnused}
${chalk.gray('🙈 Ignored actions:')} ${ignoredCount}
${chalk.yellow('📁 Empty folders:')} ${emptyFoldersCount}
${chalk.gray('━'.repeat(40))}
${chalk.bold('Total actions:')} ${summary.totalActions}
`;
  }

  async showMainMenu() {
    const ignoredCount = this.ignoreList.getIgnoredActions().length;
    const emptyFoldersCount = this.results.emptyFolders ? this.results.emptyFolders.length : 0;
    
    const choices = [
      {
        name: `${chalk.blue('📋')} Manage server actions (select/ignore/delete)`,
        value: 'manage_actions'
      },
      {
        name: `${chalk.magenta('🛣️')} Scan dead routes in routes.json`,
        value: 'scan_routes'
      },
      {
        name: `${chalk.cyan('💾')} Export results to JSON`,
        value: 'export'
      }
    ];

    if (ignoredCount > 0) {
      choices.push({
        name: `${chalk.gray('🙈')} View ignored actions (${ignoredCount})`,
        value: 'view_ignored'
      });
    }

    // Always show empty folders option
    const emptyFoldersText = emptyFoldersCount > 0 ? 
      `Manage empty folders (${emptyFoldersCount})` : 
      `Manage empty folders (none found)`;
    choices.push({
      name: `${chalk.yellow('📁')} ${emptyFoldersText}`,
      value: 'manage_empty_folders'
    });

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

  async manageActions() {
    const keyboardNav = new KeyboardNavigation(this);
    
    while (true) {
      const result = await keyboardNav.start();
      
      if (result === 'back') {
        break;
      } else if (result === 'filter') {
        await this.changeFilter();
      } else if (result === 'delete') {
        await this.executeDelete();
      } else if (result === 'view_ignored') {
        await this.viewIgnoredActions();
      }
    }
  }

  async showActionsListWithNavigation() {
    return new Promise((resolve) => {
      const allActions = this.buildUnifiedActionListSimple();
      
      if (allActions.length === 0) {
        console.log(chalk.yellow('\nNo actions to show with current filter.\n'));
        resolve('back');
        return;
      }

      // Create choices for inquirer
      const choices = allActions.map(action => ({
        name: this.formatActionDisplay(action),
        value: action.urlPath,
        short: action.urlPath
      }));

      // Add control options
      choices.push(
        new inquirer.Separator(),
        {
          name: '🔄 Change filter',
          value: '__FILTER__'
        },
        {
          name: '↩️ Back to main menu', 
          value: '__BACK__'
        }
      );

      const prompt = inquirer.createPromptModule();
      const listPrompt = prompt([{
        type: 'list',
        name: 'selected',
        message: `${chalk.blue('↑↓')} navigate | ${chalk.yellow('←')} ignore | ${chalk.red('→')} mark for deletion | ${chalk.gray('SPACE')} reset | ${chalk.green('ENTER')} execute deletion`,
        choices,
        pageSize: 20,
        loop: false
      }]);

      // Handle custom keypress events
      process.stdin.on('keypress', (ch, key) => {
        if (!key) return;

        const currentIndex = this.getCurrentPromptIndex(listPrompt);
        if (currentIndex === -1) return;

        const currentAction = allActions[currentIndex];
        if (!currentAction) return;

        switch (key.name) {
          case 'left':
            this.handleLeftArrow(currentAction);
            break;
          case 'right':
            this.handleRightArrow(currentAction);
            break;
          case 'space':
            this.handleSpaceReset(currentAction);
            break;
        }
      });

      listPrompt.then((answer) => {
        process.stdin.removeAllListeners('keypress');
        
        if (answer.selected === '__FILTER__') {
          resolve('filter');
        } else if (answer.selected === '__BACK__') {
          resolve('back');
        } else if (this.selectedForDeletion.size > 0) {
          resolve('delete');
        } else {
          resolve('continue');
        }
      }).catch(() => {
        process.stdin.removeAllListeners('keypress');
        resolve('back');
      });
    });
  }

  buildUnifiedActionListSimple() {
    // Group 1: Marked for deletion
    const markedActions = this.results.actions.filter(action => 
      this.selectedForDeletion.has(action.urlPath)
    );
    
    // Group 2: Available actions (excluding ignored)
    const availableActions = this.getFilteredUnmarkedActions();
    
    // Only include marked and available actions (ignored actions are handled separately)
    return [...markedActions, ...availableActions];
  }

  formatActionDisplay(action) {
    const isMarked = this.selectedForDeletion.has(action.urlPath);
    const isIgnored = this.ignoreList.isIgnored(action.urlPath);
    const confidenceColor = this.getConfidenceColor(action.confidence);
    
    let icon, color;
    if (isMarked) {
      icon = '❌';
      color = chalk.red;
    } else if (isIgnored) {
      icon = '🙈';
      color = chalk.gray;
    } else {
      icon = '📋';
      color = chalk.blue;
    }
    
    return color(`${icon} ${action.urlPath} (${confidenceColor(action.confidence)} confidence, ${action.referenceCount} refs)`);
  }

  getCurrentPromptIndex(listPrompt) {
    // This is a workaround to get the current selected index
    // In practice, we'll need to track this ourselves
    return 0; // Placeholder - will implement proper tracking
  }

  async handleLeftArrow(action) {
    if (!this.ignoreList.isIgnored(action.urlPath)) {
      await this.ignoreList.addToIgnore(action.urlPath);
      this.selectedForDeletion.delete(action.urlPath);
      console.log(chalk.yellow(`🙈 Ignored: ${action.urlPath}`));
      // Refresh display
      this.refreshDisplay();
    }
  }

  async handleRightArrow(action) {
    if (!this.selectedForDeletion.has(action.urlPath)) {
      this.selectedForDeletion.add(action.urlPath);
      await this.ignoreList.removeFromIgnore(action.urlPath);
      console.log(chalk.red(`❌ Marked for deletion: ${action.urlPath}`));
      // Refresh display
      this.refreshDisplay();
    }
  }

  async handleSpaceReset(action) {
    const wasMarked = this.selectedForDeletion.has(action.urlPath);
    const wasIgnored = this.ignoreList.isIgnored(action.urlPath);
    
    if (wasMarked || wasIgnored) {
      this.selectedForDeletion.delete(action.urlPath);
      await this.ignoreList.removeFromIgnore(action.urlPath);
      console.log(chalk.blue(`📋 Reset to neutral: ${action.urlPath}`));
      // Refresh display
      this.refreshDisplay();
    }
  }

  refreshDisplay() {
    // Force a re-render of the list
    process.stdout.write('\x1B[2J\x1B[0f'); // Clear screen
    console.log(this.formatSummary());
  }

  async handleActionSelection(urlPath) {
    const action = this.results.actions.find(a => a.urlPath === urlPath);
    const isMarked = this.selectedForDeletion.has(urlPath);
    const isIgnored = this.ignoreList.isIgnored(urlPath);

    let choices = [];
    
    if (isMarked) {
      choices.push({
        name: `${chalk.green('✅')} Remove from deletion list`,
        value: 'unmark'
      });
    } else if (isIgnored) {
      choices.push({
        name: `${chalk.green('👁️')} Unignore this action`,
        value: 'unignore'
      });
    } else {
      choices.push({
        name: `${chalk.red('🗑️')} Mark for deletion`,
        value: 'mark'
      });
      choices.push({
        name: `${chalk.yellow('🙈')} Add to ignore list`,
        value: 'ignore'
      });
    }

    choices.push({
      name: `${chalk.gray('↩️')} Back to list`,
      value: 'back'
    });

    const { actionChoice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'actionChoice',
        message: `Action: ${action.urlPath}`,
        choices
      }
    ]);

    switch (actionChoice) {
      case 'mark':
        this.selectedForDeletion.add(urlPath);
        console.log(chalk.green(`✅ Marked for deletion: ${urlPath}`));
        break;
      case 'unmark':
        this.selectedForDeletion.delete(urlPath);
        console.log(chalk.green(`✅ Removed from deletion: ${urlPath}`));
        break;
      case 'ignore':
        await this.ignoreList.addToIgnore(urlPath);
        console.log(chalk.yellow(`🙈 Ignored: ${urlPath}`));
        break;
      case 'unignore':
        await this.ignoreList.removeFromIgnore(urlPath);
        console.log(chalk.green(`👁️ Unignored: ${urlPath}`));
        break;
      case 'back':
        break;
    }

    return 'continue';
  }

  async showActionsList() {
    console.clear();
    console.log(this.formatSummary());

    const ignoredUrls = new Set(this.ignoreList.getIgnoredActions());
    const markedForDeletion = Array.from(this.selectedForDeletion);
    const ignoredActions = this.results.actions.filter(action => ignoredUrls.has(action.urlPath));
    const unmarkedActions = this.results.actions.filter(action => 
      !ignoredUrls.has(action.urlPath) && !this.selectedForDeletion.has(action.urlPath)
    );

    // Show marked for deletion group
    if (markedForDeletion.length > 0) {
      console.log(chalk.red.bold(`\n🗑️ MARKED FOR DELETION (${markedForDeletion.length})`));
      console.log(chalk.gray('Press R to remove from deletion list'));
      console.log(chalk.gray('━'.repeat(60)));
      
      markedForDeletion.slice(0, 10).forEach((urlPath, index) => {
        const action = this.results.actions.find(a => a.urlPath === urlPath);
        const statusIcon = this.getStatusIcon(action.status);
        const confidenceColor = this.getConfidenceColor(action.confidence);
        console.log(`${chalk.gray(String(index + 1).padStart(2))}. ${chalk.red('🗑️')} ${urlPath} (${confidenceColor(action.confidence)} confidence)`);
      });
      
      if (markedForDeletion.length > 10) {
        console.log(chalk.gray(`    ... and ${markedForDeletion.length - 10} more`));
      }
    }

    // Show ignored group
    if (ignoredActions.length > 0) {
      console.log(chalk.gray.bold(`\n🙈 IGNORED (${ignoredActions.length})`));
      console.log(chalk.gray('Press U to unignore'));
      console.log(chalk.gray('━'.repeat(60)));
      
      ignoredActions.slice(0, 5).forEach((action, index) => {
        console.log(`${chalk.gray(String(index + 1).padStart(2))}. ${chalk.gray('🙈')} ${action.urlPath}`);
      });
      
      if (ignoredActions.length > 5) {
        console.log(chalk.gray(`    ... and ${ignoredActions.length - 5} more`));
      }
    }

    // Show available actions
    const filteredActions = this.getFilteredUnmarkedActions();
    if (filteredActions.length > 0) {
      console.log(chalk.blue.bold(`\n📋 AVAILABLE ACTIONS (${filteredActions.length}) - Filter: ${this.currentFilter}`));
      console.log(chalk.green('Press D to mark for deletion'));
      console.log(chalk.yellow('Press I to ignore'));
      console.log(chalk.gray('━'.repeat(60)));
      
      filteredActions.slice(0, 15).forEach((action, index) => {
        const statusIcon = this.getStatusIcon(action.status);
        const confidenceColor = this.getConfidenceColor(action.confidence);
        console.log(`${chalk.gray(String(index + 1).padStart(2))}. ${statusIcon} ${action.urlPath} (${confidenceColor(action.confidence)} confidence, ${action.referenceCount} refs)`);
      });
      
      if (filteredActions.length > 15) {
        console.log(chalk.gray(`    ... and ${filteredActions.length - 15} more`));
      }
    }

    console.log(chalk.blue('\n💡 Keyboard Shortcuts:'));
    console.log(chalk.gray('D + number = Mark for deletion | I + number = Ignore | R + number = Remove from deletion | U + number = Unignore'));
    
    // Get keyboard input
    await this.handleKeyboardInput(filteredActions, markedForDeletion, ignoredActions);
  }

  getFilteredUnmarkedActions() {
    const ignoredUrls = new Set(this.ignoreList.getIgnoredActions());
    
    return this.results.actions.filter(action => {
      const isIgnored = ignoredUrls.has(action.urlPath);
      const isMarkedForDeletion = this.selectedForDeletion.has(action.urlPath);
      
      if (isIgnored || isMarkedForDeletion) return false;
      
      switch (this.currentFilter) {
        case 'unused-only':
          return action.status === 'unused';
        case 'safe-only':
          return action.confidence === 'safe-to-delete';
        case 'all':
        default:
          return true;
      }
    });
  }

  async handleKeyboardInput(availableActions, markedActions, ignoredActions) {
    const { input } = await inquirer.prompt([
      {
        type: 'input',
        name: 'input',
        message: 'Enter command (D5 = mark #5 for deletion, I3 = ignore #3, or press Enter to continue):'
      }
    ]);

    if (!input.trim()) return;

    const command = input.trim().toUpperCase();
    const match = command.match(/^([DIRU])(\d+)$/);
    
    if (!match) {
      console.log(chalk.red('❌ Invalid command. Use format like D5, I3, R2, U1'));
      await this.waitForEnter();
      return;
    }

    const [, action, numberStr] = match;
    const number = parseInt(numberStr) - 1; // Convert to 0-based index

    try {
      switch (action) {
        case 'D': // Mark for deletion
          if (number >= 0 && number < availableActions.length) {
            const actionToMark = availableActions[number];
            this.selectedForDeletion.add(actionToMark.urlPath);
            console.log(chalk.green(`✅ Marked ${actionToMark.urlPath} for deletion`));
          } else {
            console.log(chalk.red(`❌ Invalid number. Choose 1-${availableActions.length}`));
          }
          break;

        case 'I': // Ignore
          if (number >= 0 && number < availableActions.length) {
            const actionToIgnore = availableActions[number];
            await this.ignoreList.addToIgnore(actionToIgnore.urlPath);
            console.log(chalk.yellow(`🙈 Ignored ${actionToIgnore.urlPath}`));
          } else {
            console.log(chalk.red(`❌ Invalid number. Choose 1-${availableActions.length}`));
          }
          break;

        case 'R': // Remove from deletion
          if (number >= 0 && number < markedActions.length) {
            const actionToRemove = markedActions[number];
            this.selectedForDeletion.delete(actionToRemove);
            console.log(chalk.green(`✅ Removed ${actionToRemove} from deletion list`));
          } else {
            console.log(chalk.red(`❌ Invalid number. Choose 1-${markedActions.length}`));
          }
          break;

        case 'U': // Unignore
          if (number >= 0 && number < ignoredActions.length) {
            const actionToUnignore = ignoredActions[number];
            await this.ignoreList.removeFromIgnore(actionToUnignore.urlPath);
            console.log(chalk.green(`👁️ Unignored ${actionToUnignore.urlPath}`));
          } else {
            console.log(chalk.red(`❌ Invalid number. Choose 1-${ignoredActions.length}`));
          }
          break;
      }
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
    }

    await this.waitForEnter();
  }

  async waitForEnter() {
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...'
      }
    ]);
  }

  getFilteredActions() {
    const ignoredUrls = new Set(this.ignoreList.getIgnoredActions());
    
    return this.results.actions.filter(action => {
      const isIgnored = ignoredUrls.has(action.urlPath);
      
      switch (this.currentFilter) {
        case 'unused-only':
          return !isIgnored && (action.status === 'likely-unused' || action.status === 'possibly-unused');
        case 'ignored-only':
          return isIgnored;
        case 'all':
        default:
          return !isIgnored; // Show all non-ignored
      }
    });
  }

  async buildActionChoices(actions) {
    const choices = [
      new inquirer.Separator(chalk.gray(`─── Actions (${this.currentFilter}) ───`))
    ];

    for (const action of actions) {
      const isSelected = this.selectedForDeletion.has(action.urlPath);
      const statusIcon = this.getStatusIcon(action.status);
      const confidenceColor = this.getConfidenceColor(action.confidence);
      
      choices.push({
        name: `${statusIcon} ${action.urlPath} (${confidenceColor(action.confidence)} confidence, ${action.referenceCount} refs)`,
        value: `action:${action.urlPath}`,
        checked: isSelected
      });
    }

    choices.push(
      new inquirer.Separator(),
      {
        name: chalk.cyan('🔄 Change filter'),
        value: 'change-filter'
      },
      {
        name: chalk.yellow('🙈 Add selected to ignore list'),
        value: 'ignore-selected'
      },
      {
        name: chalk.cyan('↩️  Back to main menu'),
        value: 'back-to-menu'
      }
    );

    return choices;
  }

  getManageMessage() {
    const selectedCount = this.selectedForDeletion.size;
    const filterText = this.currentFilter === 'all' ? 'all actions' : 
                      this.currentFilter === 'unused-only' ? 'unused actions only' : 
                      'ignored actions only';
    
    return `Manage server actions (${filterText}) - ${selectedCount} selected for deletion:`;
  }

  async processActionSelection(selectedActions) {
    // Handle special actions
    if (selectedActions.includes('back-to-menu')) {
      return;
    }
    
    if (selectedActions.includes('change-filter')) {
      await this.changeFilter();
      return;
    }
    
    if (selectedActions.includes('ignore-selected')) {
      await this.ignoreSelectedActions();
      return;
    }

    // Update deletion selection
    this.selectedForDeletion.clear();
    selectedActions
      .filter(item => item.startsWith('action:'))
      .forEach(item => {
        const urlPath = item.replace('action:', '');
        this.selectedForDeletion.add(urlPath);
      });

    console.log(chalk.green(`\n✅ Updated selection: ${this.selectedForDeletion.size} actions selected for deletion\n`));
  }

  async changeFilter() {
    const { filter } = await inquirer.prompt([
      {
        type: 'list',
        name: 'filter',
        message: 'Choose filter:',
        choices: [
          { name: 'All actions (non-ignored)', value: 'all' },
          { name: 'Unused actions only', value: 'unused-only' },
          { name: 'Safe to delete only (0 references)', value: 'safe-only' }
        ],
        default: this.currentFilter
      }
    ]);
    
    this.currentFilter = filter;
    console.log(chalk.blue(`\n📋 Filter changed to: ${filter}\n`));
  }

  async ignoreSelectedActions() {
    if (this.selectedForDeletion.size === 0) {
      console.log(chalk.yellow('\n⚠️ No actions selected\n'));
      return;
    }

    const spinner = ora('Adding actions to ignore list...').start();
    
    try {
      for (const urlPath of this.selectedForDeletion) {
        await this.ignoreList.addToIgnore(urlPath);
      }
      
      // Clear selection since they're now ignored
      this.selectedForDeletion.clear();
      
      spinner.succeed(`Added actions to ignore list`);
      console.log(chalk.gray(`Ignore list saved to: ${this.ignoreList.getIgnoreFilePath()}\n`));
    } catch (error) {
      spinner.fail('Failed to update ignore list');
      console.error(chalk.red(error.message));
    }
  }

  async viewIgnoredActions() {
    const ignoredActions = this.ignoreList.getIgnoredActions();
    
    if (ignoredActions.length === 0) {
      console.log(chalk.green('\n🎉 No actions are being ignored!\n'));
      return;
    }

    const choices = ignoredActions.map(urlPath => ({
      name: `${chalk.gray('🙈')} ${urlPath}`,
      value: urlPath
    }));

    choices.push(
      new inquirer.Separator(),
      {
        name: chalk.cyan('↩️  Back to main menu'),
        value: '__BACK__'
      }
    );

    const { selected } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: 'Ignored actions (select to unignore):',
        choices,
        pageSize: 15
      }
    ]);

    if (selected.includes('__BACK__') || selected.length === 0) {
      return;
    }

    // Remove from ignore list
    const spinner = ora('Removing from ignore list...').start();
    
    try {
      for (const urlPath of selected) {
        await this.ignoreList.removeFromIgnore(urlPath);
      }
      spinner.succeed(`Removed ${selected.length} actions from ignore list`);
    } catch (error) {
      spinner.fail('Failed to update ignore list');
      console.error(chalk.red(error.message));
    }
  }

  async manageEmptyFolders() {
    const emptyFolders = this.results.emptyFolders || [];
    
    if (emptyFolders.length === 0) {
      console.log(chalk.green('\n🎉 No empty folders found!\n'));
      return;
    }

    console.log(chalk.yellow(`\n📁 Found ${emptyFolders.length} empty folders:\n`));
    
    const choices = emptyFolders.map((folder, index) => ({
      name: `${chalk.yellow('📁')} ${folder.relativePath}`,
      value: folder.path,
      checked: false
    }));

    choices.push(
      new inquirer.Separator(),
      {
        name: chalk.cyan('↩️  Back to main menu'),
        value: '__BACK__'
      }
    );

    const { selected } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: 'Select empty folders to delete:',
        choices,
        pageSize: 15
      }
    ]);

    if (selected.includes('__BACK__') || selected.length === 0) {
      return;
    }

    // Filter out the back option
    const foldersToDelete = selected.filter(path => path !== '__BACK__');

    if (foldersToDelete.length === 0) {
      return;
    }

    // Confirmation
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red.bold(`Delete ${foldersToDelete.length} empty folders? This cannot be undone.`),
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.green('\n✅ Deletion cancelled\n'));
      return;
    }

    // Delete folders
    const spinner = ora('Deleting empty folders...').start();
    const emptyFolderDetector = new EmptyFolderDetector(this.options.projectRoot || process.cwd());
    
    try {
      const results = await emptyFolderDetector.deleteEmptyFolders(foldersToDelete);
      
      if (results.errors.length === 0) {
        spinner.succeed(`Successfully deleted ${results.deleted.length} empty folders`);
        
        // Update the results to remove deleted folders
        this.results.emptyFolders = this.results.emptyFolders.filter(
          folder => !results.deleted.includes(folder.path)
        );
      } else {
        spinner.warn(`Deleted ${results.deleted.length} folders, ${results.errors.length} failed`);
        console.log(chalk.yellow('\nErrors:'));
        results.errors.forEach(error => console.log(chalk.red(`  • ${error.path}: ${error.error}`)));
      }

      console.log(chalk.blue('\n💡 Tip: Use "git status" to see what was deleted'));
    } catch (error) {
      spinner.fail('Failed to delete folders');
      console.error(chalk.red(error.message));
    }
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
      const exportData = {
        ...this.results,
        ignoredActions: this.ignoreList.getIgnoredActions(),
        selectedForDeletion: Array.from(this.selectedForDeletion),
        exportedAt: new Date().toISOString()
      };
      
      const fullPath = path.resolve(filename);
      await fs.writeJson(fullPath, exportData, { spaces: 2 });
      spinner.succeed(`Results exported to ${chalk.green(fullPath)}`);
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

    console.clear();
    console.log(chalk.red.bold(`\n🚨 DELETION CONFIRMATION\n`));
    console.log(chalk.red.bold(`You're about to delete ${this.selectedForDeletion.size} server actions:`));
    console.log(chalk.blue.bold(`\n⚠️ IMPORTANT: Make sure you have committed your changes to git for backup!\n`));
    
    // Show first 10 files
    const actions = Array.from(this.selectedForDeletion).slice(0, 10);
    actions.forEach((urlPath, index) => {
      const action = this.results.actions.find(a => a.urlPath === urlPath);
      console.log(`${chalk.gray(String(index + 1).padStart(2))}. ${chalk.red('❌')} ${action.filePath}`);
    });
    
    if (this.selectedForDeletion.size > 10) {
      console.log(chalk.gray(`    ... and ${this.selectedForDeletion.size - 10} more files`));
    }

    // Single confirmation
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red.bold('This cannot be undone. Are you ABSOLUTELY SURE?'),
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.green('\n✅ Deletion cancelled\n'));
      await this.waitForEnter();
      return;
    }

    const spinner = ora('Deleting server actions...').start();

    try {
      // Delete the files
      let deletedCount = 0;
      let errors = [];
      
      for (const urlPath of this.selectedForDeletion) {
        const action = this.results.actions.find(a => a.urlPath === urlPath);
        const filePath = path.join(this.options.projectRoot || process.cwd(), action.filePath);
        
        try {
          if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
            deletedCount++;
          }
        } catch (error) {
          errors.push(`${action.filePath}: ${error.message}`);
        }
      }

      spinner.text = 'Scanning for empty folders...';
      
      // Find and offer to delete empty folders
      const emptyFolderDetector = new EmptyFolderDetector(this.options.projectRoot || process.cwd());
      const emptyFolders = await emptyFolderDetector.findEmptyFolders();
      
      if (errors.length === 0) {
        spinner.succeed(`Successfully deleted ${deletedCount} server actions`);
      } else {
        spinner.warn(`Deleted ${deletedCount} files, but ${errors.length} failed`);
        console.log(chalk.yellow('\nErrors:'));
        errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
      }

      // Handle empty folders
      if (emptyFolders.length > 0) {
        console.log(chalk.yellow(`\n📁 Found ${emptyFolders.length} empty folders:`));
        emptyFolders.slice(0, 5).forEach((folder, index) => {
          console.log(`${chalk.gray(String(index + 1).padStart(2))}. ${chalk.yellow('📁')} ${folder.relativePath}`);
        });
        
        if (emptyFolders.length > 5) {
          console.log(chalk.gray(`    ... and ${emptyFolders.length - 5} more folders`));
        }

        const { deleteEmptyFolders } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'deleteEmptyFolders',
            message: `Delete these ${emptyFolders.length} empty folders?`,
            default: true
          }
        ]);

        if (deleteEmptyFolders) {
          const folderSpinner = ora('Deleting empty folders...').start();
          const folderResults = await emptyFolderDetector.deleteEmptyFolders(emptyFolders.map(f => f.path));
          
          if (folderResults.errors.length === 0) {
            folderSpinner.succeed(`Deleted ${folderResults.deleted.length} empty folders`);
          } else {
            folderSpinner.warn(`Deleted ${folderResults.deleted.length} folders, ${folderResults.errors.length} failed`);
          }
        }
      }

      console.log(chalk.blue('\n💡 Tip: Use "git status" to see what was deleted'));
      console.log(chalk.blue('💡 If you need to restore, use "git checkout HEAD -- <filepath>"'));

      // Update results to remove deleted actions
      this.results.actions = this.results.actions.filter(action => 
        !this.selectedForDeletion.has(action.urlPath)
      );
      
      // Update summary counts
      this.results.summary.totalActions = this.results.actions.length;
      this.results.summary.likelyUnused = this.results.actions.filter(a => a.confidence === 'safe-to-delete').length;
      this.results.summary.used = this.results.actions.filter(a => a.confidence === 'review-needed').length;

      // Clear selection
      this.selectedForDeletion.clear();

      await this.waitForEnter();

    } catch (error) {
      spinner.fail('Deletion failed');
      console.error(chalk.red(error.message));
      await this.waitForEnter();
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
      case 'safe-to-delete': return chalk.red;
      case 'review-needed': return chalk.green;
      default: return chalk.gray;
    }
  }

  truncate(str, length) {
    return str.length > length ? str.substring(0, length - 3) + '...' : str;
  }

  async scanDeadRoutes() {
    console.clear();
    console.log(chalk.magenta.bold('\n🛣️ Dead Routes Scanner\n'));
    console.log(chalk.gray('Scanning routes.json for routes that reference missing files...\n'));

    try {
      const routesScanner = new RoutesScanner(this.options.projectRoot || process.cwd());
      const routesIgnoreList = new RoutesIgnoreList(this.options.projectRoot || process.cwd());
      await routesIgnoreList.loadIgnoreList();
      
      const results = await routesScanner.scan();
      
      if (results.deadRoutes.length === 0) {
        console.clear();
        console.log(chalk.green('\n🎉 No dead routes found! All routes reference existing files.\n'));
        await this.waitForEnter();
        return;
      }

      // Manage dead routes with same UX as server actions
      await this.manageDeadRoutes(results, routesScanner, routesIgnoreList);

    } catch (error) {
      console.log(chalk.red(`❌ Error scanning routes: ${error.message}`));
      await this.waitForEnter();
    }
  }

  async manageDeadRoutes(scanResults, routesScanner, routesIgnoreList) {
    const routesKeyboardNav = new RoutesKeyboardNavigation(this, scanResults, routesIgnoreList);
    
    while (true) {
      const result = await routesKeyboardNav.start();
      
      if (result === 'back') {
        break;
      } else if (result === 'delete') {
        const selectedRoutes = Array.from(routesKeyboardNav.getSelectedForDeletion());
        const success = await this.executeRouteDelete(selectedRoutes, routesScanner);
        if (success) {
          routesKeyboardNav.selectedForDeletion.clear();
          // Rescan to update results
          const newResults = await routesScanner.scan();
          if (newResults.deadRoutes.length === 0) {
            console.log(chalk.green('\n🎉 No more dead routes! All remaining routes reference existing files.\n'));
            await this.waitForEnter();
            return;
          }
          routesKeyboardNav.scanResults = newResults;
        }
      } else if (result === 'view_ignored') {
        await this.viewIgnoredRoutes(routesIgnoreList);
      }
    }
  }

  async executeRouteDelete(routePaths, routesScanner) {
    console.clear();
    console.log(chalk.red.bold(`\n🚨 ROUTE DELETION CONFIRMATION\n`));
    console.log(chalk.red.bold(`You're about to delete ${routePaths.length} routes from routes.json:`));
    console.log(chalk.blue.bold(`\n⚠️ IMPORTANT: Make sure you have committed your changes to git for backup!\n`));
    
    // Show routes to delete
    routePaths.slice(0, 10).forEach((routePath, index) => {
      console.log(`${chalk.gray(String(index + 1).padStart(2))}. ${chalk.red('❌')} ${routePath}`);
    });
    
    if (routePaths.length > 10) {
      console.log(chalk.gray(`    ... and ${routePaths.length - 10} more routes`));
    }
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red.bold('This cannot be undone. Are you ABSOLUTELY SURE?'),
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.green('\n✅ Deletion cancelled\n'));
      await this.waitForEnter();
      return false;
    }

    try {
      await routesScanner.deleteRoutes(routePaths);
      console.log(chalk.blue('\n💡 Tip: Use "git diff" to see what was changed'));
      console.log(chalk.blue('💡 If you need to restore, use "git checkout HEAD -- app/config/routes.json"'));
      await this.waitForEnter();
      return true;
    } catch (error) {
      console.log(chalk.red(`❌ Error deleting routes: ${error.message}`));
      await this.waitForEnter();
      return false;
    }
  }

  async viewIgnoredRoutes(routesIgnoreList) {
    const ignoredRoutes = routesIgnoreList.getIgnoredRoutes();
    
    if (ignoredRoutes.length === 0) {
      console.log(chalk.green('\n🎉 No routes are being ignored!\n'));
      await this.waitForEnter();
      return;
    }

    const choices = ignoredRoutes.map(routePath => ({
      name: `${chalk.gray('🙈')} ${routePath}`,
      value: routePath
    }));

    choices.push(
      new inquirer.Separator(),
      {
        name: chalk.cyan('↩️  Back to routes management'),
        value: '__BACK__'
      }
    );

    const { selected } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: 'Ignored routes (select to unignore):',
        choices,
        pageSize: 15
      }
    ]);

    if (selected.includes('__BACK__') || selected.length === 0) {
      return;
    }

    // Remove from ignore list
    const spinner = ora('Removing from ignore list...').start();
    
    try {
      for (const routePath of selected) {
        await routesIgnoreList.removeFromIgnore(routePath);
      }
      spinner.succeed(`Removed ${selected.length} routes from ignore list`);
      await this.waitForEnter();
    } catch (error) {
      spinner.fail('Failed to update ignore list');
      console.error(chalk.red(error.message));
      await this.waitForEnter();
    }
  }
}

module.exports = InteractiveMode;