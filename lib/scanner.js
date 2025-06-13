const fs = require('fs-extra');
const path = require('path');
const glob = require('fast-glob');
const chalk = require('chalk');
const ora = require('ora');
const EmptyFolderDetector = require('./empty-folders');

class Scanner {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.serverActions = new Map();
    this.references = new Map();
  }

  async scan() {
    const spinner = ora('Discovering server actions...').start();
    
    try {
      // Step 1: Find all server action files
      await this.discoverServerActions();
      spinner.text = `Found ${this.serverActions.size} server actions. Scanning for references...`;
      
      // Step 2: Find all references to these actions
      await this.findReferences();
      spinner.succeed(`Scan complete! Found ${this.serverActions.size} actions with ${this.references.size} reference patterns.`);
      
      // Step 3: Find pre-existing empty folders
      spinner.text = 'Scanning for pre-existing empty folders...';
      const emptyFolderDetector = new EmptyFolderDetector(this.projectRoot);
      const emptyFolders = await emptyFolderDetector.findEmptyFolders();
      
      // Step 4: Analyze and categorize
      const results = this.analyzeResults();
      results.emptyFolders = emptyFolders;
      
      return results;
      
    } catch (error) {
      spinner.fail('Scan failed');
      throw error;
    }
  }

  async discoverServerActions() {
    const apiPattern = path.join(this.projectRoot, 'app/api/**/*.json');
    const libPattern = path.join(this.projectRoot, 'app/lib/**/*.json');
    
    const files = await glob([apiPattern, libPattern]);
    
    for (const file of files) {
      const relativePath = path.relative(this.projectRoot, file);
      const urlPath = this.filePathToUrl(relativePath);
      
      // Skip if it's clearly not a server action (no exec/steps)
      try {
        const content = await fs.readJson(file);
        if (content.exec || content.steps) {
          this.serverActions.set(urlPath, {
            filePath: file,
            relativePath,
            urlPath,
            content,
            references: []
          });
        }
      } catch (error) {
        // Skip malformed JSON files
        console.warn(chalk.yellow(`Warning: Could not parse ${relativePath}`));
      }
    }
  }

  filePathToUrl(filePath) {
    // Convert app/api/v1/courses/create.json -> /api/v1/courses/create
    if (filePath.startsWith('app/api/')) {
      return '/' + filePath.replace('app/', '').replace('.json', '');
    }
    // Convert app/lib/security/check.json -> lib/security/check  
    if (filePath.startsWith('app/lib/')) {
      return filePath.replace('app/', '').replace('.json', '');
    }
    return filePath.replace('.json', '');
  }

  async findReferences() {
    // Scan different file types for references
    await this.scanHtmlFiles();
    await this.scanJsonFiles();
    await this.scanJavaScriptFiles();
  }

  async scanHtmlFiles() {
    const pattern = path.join(this.projectRoot, '{views,public}/**/*.{html,ejs}');
    const files = await glob(pattern);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      
      // Look for url="/api/..." patterns
      const urlMatches = content.match(/url=["']([^"']+)["']/g);
      if (urlMatches) {
        for (const match of urlMatches) {
          const url = match.match(/url=["']([^"']+)["']/)[1];
          this.addReference(url, file, 'html-url');
        }
      }

      // Look for action="/api/..." patterns  
      const actionMatches = content.match(/action=["']([^"']+)["']/g);
      if (actionMatches) {
        for (const match of actionMatches) {
          const url = match.match(/action=["']([^"']+)["']/)[1];
          this.addReference(url, file, 'html-action');
        }
      }

      // Look for API URLs in href attributes and other URL patterns
      const hrefMatches = content.match(/href=["']([^"']+)["']/g);
      if (hrefMatches) {
        for (const match of hrefMatches) {
          const url = match.match(/href=["']([^"']+)["']/)[1];
          if (url.includes('/api/')) {
            this.scanForApiUrlPatterns(url, file);
          }
        }
      }

      // Scan entire content for API URL patterns (for magic links in emails, etc.)
      this.scanForApiUrlPatterns(content, file);
    }
  }

  async scanJsonFiles() {
    // Scan all JSON files for exec/include references and api_file patterns
    const pattern = path.join(this.projectRoot, 'app/**/*.json');
    const files = await glob(pattern);

    for (const file of files) {
      try {
        const content = await fs.readJson(file);
        
        // Look for Bull queue api_file references
        this.findInObject(content, 'api_file', (value) => {
          this.addReference(value, file, 'queue-api-file');
        });

        // Look for exec references
        this.findInObject(content, 'exec', (value) => {
          if (typeof value === 'string') {
            this.addReference(value, file, 'exec-string');
          }
        });

        // Look for module references in steps
        this.findInObject(content, 'module', (value) => {
          if (typeof value === 'string') {
            this.addReference(value, file, 'exec-module');
          }
        });

        // Look for URL patterns in value strings (magic links, direct API calls)
        this.findInObject(content, 'value', (value) => {
          if (typeof value === 'string') {
            this.scanForApiUrlPatterns(value, file);
          }
        });

        // Also check other string fields that might contain URLs
        this.findInObject(content, 'url', (value) => {
          if (typeof value === 'string') {
            this.scanForApiUrlPatterns(value, file);
          }
        });

        this.findInObject(content, 'link', (value) => {
          if (typeof value === 'string') {
            this.scanForApiUrlPatterns(value, file);
          }
        });

      } catch (error) {
        // Skip malformed JSON
      }
    }
  }

  scanForApiUrlPatterns(str, sourceFile) {
    // Look for patterns like '/api/v1/security/magic-login' in URL strings
    // This catches magic links and other direct API endpoint references
    
    // Pattern 1: Direct API paths in strings
    const apiMatches = str.match(/\/api\/[^'"?\s&]+/g);
    if (apiMatches) {
      for (const match of apiMatches) {
        // Clean up any query parameters or fragments
        const cleanPath = match.split('?')[0].split('#')[0];
        this.addReference(cleanPath, sourceFile, 'url-string');
      }
    }

    // Pattern 2: Template string patterns with variables
    // Example: '/api/v1/security/magic-login?token='+variable
    const templateApiMatches = str.match(/['"`][^'"]*\/api\/[^'"?\s&]+[^'"]*['"`]/g);
    if (templateApiMatches) {
      for (const match of templateApiMatches) {
        // Extract just the API path part
        const apiMatch = match.match(/\/api\/[^'"?\s&]+/);
        if (apiMatch) {
          const cleanPath = apiMatch[0].split('?')[0].split('#')[0];
          this.addReference(cleanPath, sourceFile, 'template-url');
        }
      }
    }
  }

  async scanJavaScriptFiles() {
    const pattern = path.join(this.projectRoot, '{public,views,extensions}/**/*.js');
    const files = await glob(pattern);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      
      // Look for fetch('/api/...') patterns
      const fetchMatches = content.match(/fetch\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g);
      if (fetchMatches) {
        for (const match of fetchMatches) {
          const url = match.match(/fetch\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/)[1];
          if (url.startsWith('/api/')) {
            this.addReference(url, file, 'js-fetch');
          }
        }
      }

      // Look for other AJAX patterns
      const ajaxMatches = content.match(/url\s*:\s*['"`]([^'"`]+)['"`]/g);
      if (ajaxMatches) {
        for (const match of ajaxMatches) {
          const url = match.match(/url\s*:\s*['"`]([^'"`]+)['"`]/)[1];
          if (url.startsWith('/api/')) {
            this.addReference(url, file, 'js-ajax');
          }
        }
      }
    }
  }

  findInObject(obj, key, callback) {
    if (typeof obj !== 'object' || obj === null) return;
    
    if (Array.isArray(obj)) {
      for (const item of obj) {
        this.findInObject(item, key, callback);
      }
    } else {
      for (const [k, v] of Object.entries(obj)) {
        if (k === key) {
          callback(v);
        } else {
          this.findInObject(v, key, callback);
        }
      }
    }
  }

  addReference(referencedPath, sourceFile, type) {
    // Normalize the referenced path
    let normalizedPath = referencedPath;
    
    // Convert different path formats to match our server action keys
    if (referencedPath.startsWith('/api/')) {
      normalizedPath = referencedPath;
    } else if (referencedPath.startsWith('/app/api/')) {
      // Bull queue pattern: /app/api/v1/queues/... -> /api/v1/queues/...
      normalizedPath = referencedPath.replace('/app/api/', '/api/');
    } else if (!referencedPath.startsWith('/') && !referencedPath.startsWith('lib/')) {
      // Handle relative lib references
      normalizedPath = 'lib/' + referencedPath;
    }
    
    // Remove .json extension to match server action keys
    if (normalizedPath.endsWith('.json')) {
      normalizedPath = normalizedPath.replace('.json', '');
    }

    if (this.serverActions.has(normalizedPath)) {
      this.serverActions.get(normalizedPath).references.push({
        sourceFile: path.relative(this.projectRoot, sourceFile),
        type,
        originalReference: referencedPath
      });
    }

    // Also store in references map for lookup
    if (!this.references.has(normalizedPath)) {
      this.references.set(normalizedPath, []);
    }
    this.references.get(normalizedPath).push({
      sourceFile: path.relative(this.projectRoot, sourceFile),
      type,
      originalReference: referencedPath
    });
  }

  analyzeResults() {
    const results = {
      summary: {
        totalActions: this.serverActions.size,
        used: 0,
        possiblyUnused: 0,
        likelyUnused: 0
      },
      actions: []
    };

    for (const [urlPath, action] of this.serverActions) {
      const referenceCount = action.references.length;
      let confidence, status;

      // Simplified confidence system: only "safe to delete" vs "review needed"
      if (referenceCount === 0) {
        confidence = 'safe-to-delete';
        status = 'unused';
        results.summary.likelyUnused++;
      } else {
        confidence = 'review-needed';
        status = 'used';
        results.summary.used++;
      }

      results.actions.push({
        urlPath,
        filePath: action.relativePath,
        status,
        confidence,
        referenceCount,
        references: action.references,
        content: action.content
      });
    }

    // Sort by confidence (safe to delete first)
    results.actions.sort((a, b) => {
      const confidenceOrder = { 'safe-to-delete': 0, 'review-needed': 1 };
      return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    });

    return results;
  }
}

module.exports = Scanner;