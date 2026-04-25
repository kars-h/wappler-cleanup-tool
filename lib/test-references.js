const fs = require('fs-extra');
const path = require('path');
const glob = require('fast-glob');

const TEST_GLOBS = [
  'test/**/*.{js,ts}',
  'tests/**/*.{js,ts}',
  '__tests__/**/*.{js,ts}',
  '**/*.test.{js,ts}',
  '**/*.spec.{js,ts}',
];

async function findTestReferences(projectRoot, urlPaths) {
  const referenced = new Set();
  if (!await fs.pathExists(projectRoot)) return referenced;

  const patterns = TEST_GLOBS.map(g => path.join(projectRoot, g));
  const files = await glob(patterns, { ignore: ['**/node_modules/**'] });
  if (files.length === 0) return referenced;

  const pathsToFind = new Set(urlPaths);

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    for (const p of pathsToFind) {
      if (referenced.has(p)) continue;
      if (content.includes(p)) referenced.add(p);
    }
  }
  return referenced;
}

module.exports = { findTestReferences };
