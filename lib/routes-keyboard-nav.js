const readline = require('readline');
const keypress = require('keypress');
const chalk = require('chalk');

class RoutesKeyboardNavigation {
  constructor(interactiveMode, scanResults, routesIgnoreList) {
    this.interactive = interactiveMode;
    this.scanResults = scanResults;
    this.routesIgnoreList = routesIgnoreList;
    this.selectedForDeletion = new Set();
    this.currentIndex = 0;
    this.routes = [];
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
      this.routes = this.buildUnifiedRouteList();
      
      if (this.routes.length === 0) {
        console.log(chalk.yellow('\nNo routes to show.\n'));
        return 'back';
      }

      // Ensure current index is valid
      if (this.currentIndex >= this.routes.length) {
        this.currentIndex = this.routes.length - 1;
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

  buildUnifiedRouteList() {
    // Group 1: Marked for deletion
    const markedRoutes = this.scanResults.deadRoutes.filter(route => 
      this.selectedForDeletion.has(route.path)
    );
    
    // Group 2: Available routes (excluding ignored)
    const availableRoutes = this.scanResults.deadRoutes.filter(route => 
      !this.routesIgnoreList.isIgnored(route.path) && !this.selectedForDeletion.has(route.path)
    );
    
    // Only include marked and available routes (ignored routes are handled separately)
    return [...markedRoutes, ...availableRoutes];
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
    console.log(chalk.magenta.bold('\n🛣️ Dead Routes Management\n'));
    
    // Calculate pagination
    this.updatePagination();
    
    // Get visible slice of routes
    const visibleRoutes = this.routes.slice(this.topIndex, this.topIndex + this.pageSize);
    
    console.log(chalk.blue.bold(`\n📋 Dead Routes (${this.currentIndex + 1}/${this.routes.length})`));
    console.log(chalk.gray('━'.repeat(80)));
    
    visibleRoutes.forEach((route, index) => {
      const actualIndex = this.topIndex + index;
      const isSelected = actualIndex === this.currentIndex;
      this.renderRouteLine(route, actualIndex, isSelected);
    });
    
    // Show pagination info
    if (this.routes.length > this.pageSize) {
      const totalPages = Math.ceil(this.routes.length / this.pageSize);
      const currentPage = Math.floor(this.currentIndex / this.pageSize) + 1;
      console.log(chalk.gray(`\nPage ${currentPage}/${totalPages} | Total: ${this.routes.length} routes`));
    }

    // Show summary counts
    const markedCount = this.routes.filter(r => this.selectedForDeletion.has(r.path)).length;
    const totalIgnoredCount = this.routesIgnoreList.getIgnoredRoutes().length;
    const availableCount = this.routes.length - markedCount;
    
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
    if (this.topIndex + this.pageSize > this.routes.length) {
      this.topIndex = Math.max(0, this.routes.length - this.pageSize);
    }
  }

  renderRouteLine(route, index, isSelected) {
    const isMarked = this.selectedForDeletion.has(route.path);
    const isIgnored = this.routesIgnoreList.isIgnored(route.path);
    
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
    
    const issueIcons = route.issues.map(issue => {
      return issue.type === 'missing_page' ? '📄' : 
             issue.type === 'missing_exec' ? '⚙️' : '🎨';
    }).join(' ');
    
    const line = `${icon} ${route.path} ${chalk.gray('(' + issueIcons + ')')}`;
    
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
        this.immediateRender();
        break;
        
      case 'down':
        this.currentIndex = Math.min(this.routes.length - 1, this.currentIndex + 1);
        this.immediateRender();
        break;
        
      case 'pageup':
        this.currentIndex = Math.max(0, this.currentIndex - 10);
        this.immediateRender();
        break;
        
      case 'pagedown':
        this.currentIndex = Math.min(this.routes.length - 1, this.currentIndex + 10);
        this.immediateRender();
        break;
        
      case 'home':
        this.currentIndex = 0;
        this.immediateRender();
        break;
        
      case 'end':
        this.currentIndex = this.routes.length - 1;
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
        if (this.selectedForDeletion.size > 0) {
          this.actionResolver('delete');
        }
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
    const route = this.routes[this.currentIndex];
    if (!route) return;

    if (!this.routesIgnoreList.isIgnored(route.path)) {
      await this.routesIgnoreList.addToIgnore(route.path);
      this.selectedForDeletion.delete(route.path);
      
      // Show brief feedback
      process.stdout.write(chalk.yellow(`\n🙈 Ignored: ${route.path}`));
      setTimeout(() => {
        this.render();
      }, 500);
    }
  }

  async handleRightArrow() {
    const route = this.routes[this.currentIndex];
    if (!route) return;

    if (!this.selectedForDeletion.has(route.path)) {
      this.selectedForDeletion.add(route.path);
      await this.routesIgnoreList.removeFromIgnore(route.path);
      
      // Show brief feedback
      process.stdout.write(chalk.red(`\n❌ Marked for deletion: ${route.path}`));
      setTimeout(() => {
        this.render();
      }, 500);
    }
  }

  async handleSpaceReset() {
    const route = this.routes[this.currentIndex];
    if (!route) return;

    const wasMarked = this.selectedForDeletion.has(route.path);
    const wasIgnored = this.routesIgnoreList.isIgnored(route.path);
    
    if (wasMarked || wasIgnored) {
      this.selectedForDeletion.delete(route.path);
      await this.routesIgnoreList.removeFromIgnore(route.path);
      
      // Show brief feedback
      process.stdout.write(chalk.blue(`\n📋 Reset to neutral: ${route.path}`));
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

  getSelectedForDeletion() {
    return this.selectedForDeletion;
  }
}

module.exports = RoutesKeyboardNavigation;