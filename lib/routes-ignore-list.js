const fs = require('fs-extra');
const path = require('path');

class RoutesIgnoreList {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.toolDir = path.join(projectRoot, 'tools', 'cleanup-server-actions', 'lib');
    this.ignoreFilePath = path.join(this.toolDir, 'ignored-routes.json');
    this.ignoredRoutes = [];
  }

  async loadIgnoreList() {
    try {
      if (await fs.pathExists(this.ignoreFilePath)) {
        this.ignoredRoutes = await fs.readJson(this.ignoreFilePath);
      }
    } catch (error) {
      console.warn('Could not load routes ignore list, starting fresh');
      this.ignoredRoutes = [];
    }
  }

  async saveIgnoreList() {
    try {
      await fs.ensureDir(this.toolDir);
      await fs.writeJson(this.ignoreFilePath, this.ignoredRoutes, { spaces: 2 });
    } catch (error) {
      throw new Error(`Failed to save routes ignore list: ${error.message}`);
    }
  }

  async addToIgnore(routePath) {
    if (!this.ignoredRoutes.includes(routePath)) {
      this.ignoredRoutes.push(routePath);
      await this.saveIgnoreList();
    }
  }

  async removeFromIgnore(routePath) {
    const index = this.ignoredRoutes.indexOf(routePath);
    if (index > -1) {
      this.ignoredRoutes.splice(index, 1);
      await this.saveIgnoreList();
    }
  }

  isIgnored(routePath) {
    return this.ignoredRoutes.includes(routePath);
  }

  getIgnoredRoutes() {
    return [...this.ignoredRoutes];
  }

  getIgnoreFilePath() {
    return this.ignoreFilePath;
  }
}

module.exports = RoutesIgnoreList;