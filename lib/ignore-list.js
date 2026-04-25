const fs = require('fs-extra');
const path = require('path');

const FILE_NAME = '.wappler-cleanup-ignore.json';

class IgnoreList {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.ignoreFilePath = path.join(projectRoot, FILE_NAME);
    this.ignoreList = new Set();
    this.loadIgnoreList();
  }

  async loadIgnoreList() {
    try {
      if (await fs.pathExists(this.ignoreFilePath)) {
        const data = await fs.readJson(this.ignoreFilePath);
        this.ignoreList = new Set(data.ignored || []);
      }
    } catch (error) {
      console.warn('Warning: Could not load ignore list, starting fresh');
      this.ignoreList = new Set();
    }
  }

  async saveIgnoreList() {
    try {
      const data = {
        ignored: Array.from(this.ignoreList),
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      };
      await fs.writeJson(this.ignoreFilePath, data, { spaces: 2 });
    } catch (error) {
      console.error('Warning: Could not save ignore list:', error.message);
    }
  }

  isIgnored(urlPath) {
    return this.ignoreList.has(urlPath);
  }

  async addToIgnore(urlPath) {
    this.ignoreList.add(urlPath);
    await this.saveIgnoreList();
  }

  async removeFromIgnore(urlPath) {
    this.ignoreList.delete(urlPath);
    await this.saveIgnoreList();
  }

  getIgnoredActions() {
    return Array.from(this.ignoreList);
  }

  getIgnoreFilePath() {
    return this.ignoreFilePath;
  }
}

module.exports = IgnoreList;
