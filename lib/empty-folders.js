const fs = require('fs-extra');
const path = require('path');
const glob = require('fast-glob');

class EmptyFolderDetector {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }

  async findEmptyFolders() {
    const emptyFolders = [];
    
    // Focus on app/api and app/lib directories where server actions are
    const searchDirs = [
      path.join(this.projectRoot, 'app/api'),
      path.join(this.projectRoot, 'app/lib')
    ];

    for (const searchDir of searchDirs) {
      if (await fs.pathExists(searchDir)) {
        const empty = await this.findEmptyFoldersInDirectory(searchDir);
        emptyFolders.push(...empty);
      }
    }

    return emptyFolders.map(folder => ({
      path: folder,
      relativePath: path.relative(this.projectRoot, folder)
    }));
  }

  async findEmptyFoldersInDirectory(dir) {
    const emptyFolders = [];
    
    try {
      const items = await fs.readdir(dir);
      
      if (items.length === 0) {
        // Directory is empty
        emptyFolders.push(dir);
      } else {
        // Check subdirectories
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = await fs.stat(fullPath);
          
          if (stat.isDirectory()) {
            const subEmpty = await this.findEmptyFoldersInDirectory(fullPath);
            emptyFolders.push(...subEmpty);
          }
        }
        
        // After checking subdirectories, check if this directory is now empty
        // (only contains empty subdirectories)
        const remainingItems = await fs.readdir(dir);
        const hasFiles = await this.hasNonEmptyContent(dir, remainingItems);
        
        if (!hasFiles) {
          emptyFolders.push(dir);
        }
      }
    } catch (error) {
      // Skip directories we can't access
    }
    
    return emptyFolders;
  }

  async hasNonEmptyContent(dir, items) {
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = await fs.stat(fullPath);
      
      if (stat.isFile()) {
        return true; // Has files
      } else if (stat.isDirectory()) {
        const subItems = await fs.readdir(fullPath);
        if (await this.hasNonEmptyContent(fullPath, subItems)) {
          return true; // Has non-empty subdirectory
        }
      }
    }
    return false; // Only empty directories or no content
  }

  async deleteEmptyFolders(folderPaths) {
    const results = {
      deleted: [],
      errors: []
    };

    // Sort by depth (deepest first) to avoid parent/child conflicts
    const sortedPaths = folderPaths.sort((a, b) => {
      const depthA = a.split(path.sep).length;
      const depthB = b.split(path.sep).length;
      return depthB - depthA;
    });

    for (const folderPath of sortedPaths) {
      try {
        // Double-check it's still empty before deleting
        const isEmpty = await this.isDirectoryEmpty(folderPath);
        if (isEmpty) {
          await fs.remove(folderPath);
          results.deleted.push(folderPath);
        }
      } catch (error) {
        results.errors.push({
          path: folderPath,
          error: error.message
        });
      }
    }

    return results;
  }

  async isDirectoryEmpty(dir) {
    try {
      const items = await fs.readdir(dir);
      if (items.length === 0) {
        return true;
      }
      
      // Check if all items are empty directories
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = await fs.stat(fullPath);
        
        if (stat.isFile()) {
          return false;
        } else if (stat.isDirectory()) {
          if (!(await this.isDirectoryEmpty(fullPath))) {
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = EmptyFolderDetector;