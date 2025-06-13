# Quick Release Guide

## Simple Publishing

1. **Get NPM token** (one-time): https://www.npmjs.com/settings/tokens
2. **Add to GitHub secrets**: Settings → Secrets → `NPM_TOKEN`
3. **Create release**: https://github.com/kars-h/wappler-cleanup-tool/releases → "Create new release"
4. **GitHub Actions** will auto-publish to npm

## Manual (if needed)
```bash
npm login
npm publish --access public
```