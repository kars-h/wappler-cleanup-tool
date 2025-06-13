# Contributing to Wappler Cleanup Tool

Thank you for your interest in contributing! This project aims to help the Wappler community maintain cleaner, more efficient projects.

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/wappler-cleanup-tool.git
   cd wappler-cleanup-tool
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Test locally**
   ```bash
   npm start -- --project-root /path/to/test/wappler/project
   ```

## Project Structure

```
wappler-cleanup-tool/
├── bin/cli.js          # Main CLI entry point
├── lib/
│   ├── scanner.js      # Core scanning logic
│   ├── interactive.js  # Interactive UI
│   ├── reporter.js     # Results formatting
│   └── empty-folders.js # Empty folder detection
├── package.json
└── README.md
```

## Making Changes

### Adding New Cleanup Features

1. **Scanner Logic**: Add detection logic to `lib/scanner.js`
2. **Interactive UI**: Update `lib/interactive.js` for new user options
3. **Tests**: Add test cases for new functionality
4. **Documentation**: Update README.md with new features

### Code Style

- Use consistent indentation (2 spaces)
- Add JSDoc comments for new functions
- Follow existing naming conventions
- Keep functions focused and single-purpose

### Testing

Currently manual testing. Automated tests welcomed!

```bash
# Test against a real Wappler project
npm start -- --project-root /path/to/wappler/project --non-interactive
```

## Pull Request Process

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/new-cleanup-feature
   ```
3. **Make your changes**
4. **Test thoroughly**
5. **Update documentation**
6. **Submit pull request**

### PR Guidelines

- Clear description of changes
- Include examples of new functionality
- Update README.md if adding features
- Test against multiple Wappler projects if possible

## Issues

### Reporting Bugs

Include:
- Wappler version
- Node.js version
- Tool version
- Steps to reproduce
- Expected vs actual behavior
- Sample project structure (no sensitive data)

### Feature Requests

Include:
- Use case description
- Proposed solution
- Examples of what should be detected/cleaned

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help newcomers learn
- Share knowledge freely

## Release Process

1. Update version in package.json
2. Update CHANGELOG.md
3. Create GitHub release
4. Publish to npm

## Questions?

- Open an issue for questions
- Check existing issues for common problems
- Discussion in GitHub Discussions

Thank you for contributing to make Wappler development more efficient!