# Setup Instructions

## GitHub Repository
✅ **Repository created**: https://github.com/kars-h/wappler-cleanup-tool
✅ **Code pushed**: Initial commit completed

## Publishing to npm

### Manual Publishing
```bash
cd /path/to/wappler-cleanup-tool
./publish.sh
```

### OR Step by Step
```bash
cd /path/to/wappler-cleanup-tool
npm install
npm publish --access public
```

## Testing Installation

### Global Install
```bash
npm install -g wappler-cleanup-tool
wappler-cleanup --help
```

### Test on example-app
```bash
cd /path/to/example-app
wappler-cleanup
```

### npx Usage
```bash
cd /path/to/example-app
npx wappler-cleanup-tool
```

## Post-Publication Checklist

- [ ] Test global installation
- [ ] Test npx usage
- [ ] Verify it works on example-app
- [ ] Update example-app team on new tool location
- [ ] Add GitHub repo to Wappler community resources

## Repository Links

- **GitHub**: https://github.com/kars-h/wappler-cleanup-tool
- **npm**: https://www.npmjs.com/package/wappler-cleanup-tool (after publishing)

## Development Workflow

For future updates:
1. Make changes in `/path/to/wappler-cleanup-tool/`
2. Test on example-app project
3. Bump version: `npm version patch` (or minor/major)
4. Commit changes: `git add . && git commit -m "feat: your changes"`
5. Push to GitHub: `git push`
6. Publish to npm: `./publish.sh`