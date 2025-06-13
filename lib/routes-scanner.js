const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

class RoutesScanner {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.routes = [];
    this.deadRoutes = [];
    this.routesFilePath = path.join(projectRoot, 'app/config/routes.json');
  }

  async scan() {
    const spinner = ora('Scanning routes.json for dead routes...').start();
    
    try {
      // Read routes.json
      const routesPath = path.join(this.projectRoot, 'app/config/routes.json');
      if (!await fs.pathExists(routesPath)) {
        spinner.fail('routes.json not found');
        return { routes: [], deadRoutes: [] };
      }

      const routesConfig = await fs.readJson(routesPath);
      this.routes = routesConfig.routes || [];
      
      spinner.text = `Found ${this.routes.length} routes. Checking for dead references...`;
      
      // Check each route
      for (const route of this.routes) {
        await this.checkRoute(route);
      }
      
      spinner.succeed(`Routes scan complete! Found ${this.deadRoutes.length} dead routes out of ${this.routes.length} total.`);
      
      return {
        totalRoutes: this.routes.length,
        deadRoutes: this.deadRoutes,
        validRoutes: this.routes.length - this.deadRoutes.length
      };
      
    } catch (error) {
      spinner.fail('Routes scan failed');
      throw error;
    }
  }

  async checkRoute(route) {
    const issues = [];
    
    // Check if route has a page reference
    if (route.page) {
      const pagePath = path.join(this.projectRoot, 'views', `${route.page}.ejs`);
      if (!await fs.pathExists(pagePath)) {
        issues.push({
          type: 'missing_page',
          message: `Page file not found: views/${route.page}.ejs`,
          expectedPath: `views/${route.page}.ejs`
        });
      }
    }
    
    // Check if route has an exec reference (server action)
    if (route.exec) {
      const execPath = path.join(this.projectRoot, 'app', `${route.exec}.json`);
      if (!await fs.pathExists(execPath)) {
        issues.push({
          type: 'missing_exec',
          message: `Server action not found: app${route.exec}.json`,
          expectedPath: `app${route.exec}.json`
        });
      }
    }
    
    // Check if route has a layout reference
    if (route.layout) {
      const layoutPath = path.join(this.projectRoot, 'views/layouts', `${route.layout}.ejs`);
      if (!await fs.pathExists(layoutPath)) {
        issues.push({
          type: 'missing_layout',
          message: `Layout file not found: views/layouts/${route.layout}.ejs`,
          expectedPath: `views/layouts/${route.layout}.ejs`
        });
      }
    }
    
    // If any issues found, mark as dead route
    if (issues.length > 0) {
      this.deadRoutes.push({
        route: route,
        path: route.path,
        issues: issues
      });
    }
  }

  async deleteRoutes(routePaths) {
    const spinner = ora('Deleting routes from routes.json...').start();
    
    try {
      // Read current routes.json
      const routesConfig = await fs.readJson(this.routesFilePath);
      
      // Filter out the routes to delete
      const routesToDelete = new Set(routePaths);
      routesConfig.routes = routesConfig.routes.filter(route => !routesToDelete.has(route.path));
      
      // Write back to routes.json
      await fs.writeJson(this.routesFilePath, routesConfig, { spaces: 2 });
      
      spinner.succeed(`Successfully deleted ${routePaths.length} routes from routes.json`);
      return { success: true, deletedCount: routePaths.length };
      
    } catch (error) {
      spinner.fail('Failed to delete routes');
      throw error;
    }
  }

  formatResults() {
    if (this.deadRoutes.length === 0) {
      return chalk.green('\n🎉 No dead routes found! All routes reference existing files.\n');
    }

    let output = chalk.red.bold(`\n🚨 Found ${this.deadRoutes.length} dead routes:\n\n`);
    
    this.deadRoutes.forEach((deadRoute, index) => {
      output += chalk.gray(`${String(index + 1).padStart(2)}. `) + chalk.cyan(`${deadRoute.path}\n`);
      
      deadRoute.issues.forEach(issue => {
        const icon = issue.type === 'missing_page' ? '📄' : 
                    issue.type === 'missing_exec' ? '⚙️' : '🎨';
        output += chalk.gray(`    ${icon} ${issue.message}\n`);
      });
      
      output += '\n';
    });
    
    return output;
  }
}

module.exports = RoutesScanner;