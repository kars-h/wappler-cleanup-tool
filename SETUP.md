# Setup Instructions

## Local development

```bash
git clone <this-repo>
cd wappler-cleanup-tool
npm install
node bin/cli.js --help
```

## Publishing to npm (maintainers only)

```bash
./publish.sh
```

Or manually:

```bash
npm install
npm publish --access public
```

## Testing the install

```bash
npm install -g wappler-cleanup-tool
wappler-cleanup --help
```

```bash
cd /path/to/your/wappler/project
wappler-cleanup
```

Or run without installing:

```bash
cd /path/to/your/wappler/project
npx wappler-cleanup-tool
```

## Release workflow

1. Make changes on a feature branch.
2. `npm test` — verify all unit tests pass.
3. `npm version patch` (or `minor` / `major`).
4. `git push --follow-tags`.
5. `./publish.sh`.
