const fs = require('fs-extra');
const path = require('path');

function urlToRelativePath(urlPath) {
  if (urlPath.startsWith('/api/')) return 'app' + urlPath + '.json';
  if (urlPath.startsWith('lib/')) return 'app/' + urlPath + '.json';
  return urlPath + '.json';
}

async function performDeletion({ targetRepo, cleared }) {
  const deleted = [];
  for (const item of cleared) {
    const rel = urlToRelativePath(item.path);
    const full = path.join(targetRepo, rel);
    if (await fs.pathExists(full)) {
      await fs.remove(full);
      deleted.push(rel);
    }
  }

  const candidatesPath = path.join(targetRepo, 'deletion-candidates.json');
  const candidates = await fs.readJson(candidatesPath);
  const clearedPaths = new Set(cleared.map(c => c.path));
  candidates.items = candidates.items.filter(i => !clearedPaths.has(i.path));
  await fs.writeJson(candidatesPath, candidates, { spaces: 2 });

  return { deleted };
}

module.exports = { performDeletion, urlToRelativePath };
