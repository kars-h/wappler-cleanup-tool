# Setup Instructions

## GitHub Repository
✅ **Repository created**: https://github.com/kars-h/wappler-cleanup-tool
✅ **Code pushed**: Initial commit completed

## Publishing to npm

### Manual Publishing
```bash
cd /Users/kars/Wappler-projects/wappler-cleanup-tool
./publish.sh
```

### OR Step by Step
```bash
cd /Users/kars/Wappler-projects/wappler-cleanup-tool
npm install
npm publish --access public
```

## Testing Installation

### Global Install
```bash
npm install -g wappler-cleanup-tool
wappler-cleanup --help
```

### Test on kennis-shop
```bash
cd /Users/kars/Wappler-projects/kennis-shop
wappler-cleanup
```

### npx Usage
```bash
cd /Users/kars/Wappler-projects/kennis-shop
npx wappler-cleanup-tool
```

## Post-Publication Checklist

- [ ] Test global installation
- [ ] Test npx usage
- [ ] Verify it works on kennis-shop
- [ ] Update kennis-shop team on new tool location
- [ ] Add GitHub repo to Wappler community resources

## Repository Links

- **GitHub**: https://github.com/kars-h/wappler-cleanup-tool
- **npm**: https://www.npmjs.com/package/wappler-cleanup-tool (after publishing)

## Development Workflow

For future updates:
1. Make changes in `/Users/kars/Wappler-projects/wappler-cleanup-tool/`
2. Test on kennis-shop project
3. Bump version: `npm version patch` (or minor/major)
4. Commit changes: `git add . && git commit -m "feat: your changes"`
5. Push to GitHub: `git push`
6. Publish to npm: `./publish.sh`