const readline = require('readline');
const keypress = require('keypress');
const chalk = require('chalk');

class KeyboardNavigation {
  constructor(interactiveMode) {
    this.interactive = interactiveMode;
    this.currentIndex = 0;
    this.actions = [];
    this.pageSize = 15; // Show 15 items at a time
    this.topIndex = 0; // Top visible item
    this.rl = null;
    this.renderTimeout = null; // For debouncing renders
  }

  async start() {
    // Setup keypress listening
    keypress(process.stdin);
    
    // Enable raw mode for immediate key capture
    process.stdin.setRawMode(true);
    process.stdin.resume();
    
    // Setup keypress handler
    process.stdin.on('keypress', this.handleKeypress.bind(this));

    while (true) {
      this.actions = this.interactive.buildUnifiedActionListSimple();
      
      if (this.actions.length === 0) {
        console.log(chalk.yellow('\nNo actions to show with current filter.\n'));
        return 'back';
      }

      // Ensure current index is valid
      if (this.currentIndex >= this.actions.length) {
        this.currentIndex = this.actions.length - 1;
      }
      if (this.currentIndex < 0) {
        this.currentIndex = 0;
      }

      this.render();
      
      const result = await this.waitForAction();
      if (result !== 'continue') {
        this.cleanup();
        return result;
      }
    }
  }

  debouncedRender() {
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }
    this.renderTimeout = setTimeout(() => {
      this.render();
    }, 10); // Reduced to 10ms for more responsive scrolling
  }

  immediateRender() {
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }
    this.render();
  }

  render() {
    console.clear();
    console.log(this.interactive.formatSummary());
    
    // Calculate pagination
    this.updatePagination();
    
    // Get visible slice of actions
    const visibleActions = this.actions.slice(this.topIndex, this.topIndex + this.pageSize);
    
    console.log(chalk.blue.bold(`\n📋 Server Actions (${this.currentIndex + 1}/${this.actions.length})`));
    console.log(chalk.gray('━'.repeat(80)));
    
    visibleActions.forEach((action, index) => {
      const actualIndex = this.topIndex + index;
      const isSelected = actualIndex === this.currentIndex;
      this.renderActionLine(action, actualIndex, isSelected);
    });
    
    // Show pagination info
    if (this.actions.length > this.pageSize) {
      const totalPages = Math.ceil(this.actions.length / this.pageSize);
      const currentPage = Math.floor(this.currentIndex / this.pageSize) + 1;
      console.log(chalk.gray(`\nPage ${currentPage}/${totalPages} | Total: ${this.actions.length} actions`));
    }

    // Show summary counts
    const markedCount = this.actions.filter(a => this.interactive.selectedForDeletion.has(a.urlPath)).length;
    const totalIgnoredCount = this.interactive.ignoreList.getIgnoredActions().length;
    const availableCount = this.actions.length - markedCount;
    
    console.log(chalk.gray(`${chalk.red('❌')} ${markedCount} marked | ${chalk.blue('📋')} ${availableCount} available | ${chalk.gray('🙈')} ${totalIgnoredCount} ignored (separate)`));

    // Show controls
    console.log(chalk.blue('\n💡 Controls:'));
    console.log(chalk.gray(`${chalk.blue('↑↓')} navigate | ${chalk.blue('PgUp/PgDn')} jump 10 | ${chalk.blue('Home/End')} first/last`));
    console.log(chalk.gray(`${chalk.yellow('←')} ignore | ${chalk.red('→')} mark for deletion | ${chalk.gray('SPACE')} reset | ${chalk.green('ENTER')} execute deletion`));
    console.log(chalk.gray(`${chalk.cyan('F')} filter | ${chalk.gray('I')} view ignored | ${chalk.gray('Q')} quit`));
  }

  updatePagination() {
    // Ensure current index is visible
    if (this.currentIndex < this.topIndex) {
      this.topIndex = this.currentIndex;
    } else if (this.currentIndex >= this.topIndex + this.pageSize) {
      this.topIndex = this.currentIndex - this.pageSize + 1;
    }
    
    // Ensure we don't scroll past the end
    if (this.topIndex + this.pageSize > this.actions.length) {
      this.topIndex = Math.max(0, this.actions.length - this.pageSize);
    }
  }

  renderActionLine(action, index, isSelected) {
    const isMarked = this.interactive.selectedForDeletion.has(action.urlPath);
    const isIgnored = this.interactive.ignoreList.isIgnored(action.urlPath);
    const confidenceColor = this.interactive.getConfidenceColor(action.confidence);
    
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
    
    const line = `${icon} ${action.urlPath} (${confidenceColor(action.confidence)} confidence, ${action.referenceCount} refs)`;
    
    if (isSelected) {
      console.log(chalk.bgWhite.black(`► ${line}`));
    } else {
      console.log(color(`  ${line}`));
    }
  }

  async waitForAction() {
    return new Promise((resolve) => {
      this.actionResolver = resolve;
    });
  }

  async handleKeypress(str, key) {
    if (!key) return;

    switch (key.name) {
      case 'up':
        this.currentIndex = Math.max(0, this.currentIndex - 1);
        this.immediateRender(); // More responsive for single key presses
        break;
        
      case 'down':
        this.currentIndex = Math.min(this.actions.length - 1, this.currentIndex + 1);
        this.immediateRender(); // More responsive for single key presses
        break;
        
      case 'pageup':
        this.currentIndex = Math.max(0, this.currentIndex - 10);
        this.immediateRender();
        break;
        
      case 'pagedown':
        this.currentIndex = Math.min(this.actions.length - 1, this.currentIndex + 10);
        this.immediateRender();
        break;
        
      case 'home':
        this.currentIndex = 0;
        this.immediateRender();
        break;
        
      case 'end':
        this.currentIndex = this.actions.length - 1;
        this.immediateRender();
        break;
        
      case 'left':
        await this.handleLeftArrow();
        break;
        
      case 'right':
        await this.handleRightArrow();
        break;
        
      case 'space':
        await this.handleSpaceReset();
        break;
        
      case 'return':
      case 'enter':
        if (this.interactive.selectedForDeletion.size > 0) {
          this.actionResolver('delete');
        }
        break;
        
      case 'f':
        this.actionResolver('filter');
        break;
        
      case 'i':
        this.actionResolver('view_ignored');
        break;
        
      case 'q':
        this.actionResolver('back');
        break;
        
      case 'c':
        if (key.ctrl) {
          this.actionResolver('back');
        }
        break;
    }
  }

  async handleLeftArrow() {
    const action = this.actions[this.currentIndex];
    if (!action) return;

    if (!this.interactive.ignoreList.isIgnored(action.urlPath)) {
      await this.interactive.ignoreList.addToIgnore(action.urlPath);
      this.interactive.selectedForDeletion.delete(action.urlPath);
      
      // Show brief feedback
      process.stdout.write(chalk.yellow(`\n🙈 Ignored: ${action.urlPath}`));
      setTimeout(() => {
        this.render();
      }, 500);
    }
  }

  async handleRightArrow() {
    const action = this.actions[this.currentIndex];
    if (!action) return;

    if (!this.interactive.selectedForDeletion.has(action.urlPath)) {
      this.interactive.selectedForDeletion.add(action.urlPath);
      await this.interactive.ignoreList.removeFromIgnore(action.urlPath);
      
      // Show brief feedback
      process.stdout.write(chalk.red(`\n❌ Marked for deletion: ${action.urlPath}`));
      setTimeout(() => {
        this.render();
      }, 500);
    }
  }

  async handleSpaceReset() {
    const action = this.actions[this.currentIndex];
    if (!action) return;

    const wasMarked = this.interactive.selectedForDeletion.has(action.urlPath);
    const wasIgnored = this.interactive.ignoreList.isIgnored(action.urlPath);
    
    if (wasMarked || wasIgnored) {
      this.interactive.selectedForDeletion.delete(action.urlPath);
      await this.interactive.ignoreList.removeFromIgnore(action.urlPath);
      
      // Show brief feedback
      process.stdout.write(chalk.blue(`\n📋 Reset to neutral: ${action.urlPath}`));
      setTimeout(() => {
        this.render();
      }, 500);
    }
  }

  cleanup() {
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    process.stdin.removeAllListeners('keypress');
  }
}

module.exports = KeyboardNavigation;