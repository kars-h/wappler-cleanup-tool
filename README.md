# Wappler Project Cleanup Tool

Interactive CLI tool to identify and safely cleanup unused resources in your Wappler projects.

## Features

- 🔍 **Smart Detection**: Finds server actions in `/app/api/` and `/app/lib/`
- 🎯 **Multi-Pattern Scanning**: Detects references in HTML, EJS, JSON, and JavaScript files
- 🔗 **Queue-Aware**: Identifies Bull queue `api_file` references (critical for background jobs)
- 📁 **Empty Folder Cleanup**: Detects and removes empty directories
- 🎮 **Interactive by Default**: User-friendly interface for safe cleanup
- 📊 **Confidence Levels**: Safe-to-delete vs review-needed scoring
- 💾 **Backup System**: Automatic backup before deletion
- 📈 **Detailed Reports**: Export results to JSON or HTML

## Installation

### Global Installation (Recommended)
```bash
npm install -g wappler-cleanup-tool
```

### One-time Usage (No Installation)
```bash
npx wappler-cleanup-tool
```

## Usage

### Interactive Mode (Default)
```bash
cd /path/to/your/wappler/project
wappler-cleanup
```

### Non-Interactive Mode
```bash
# Just show results
wappler-cleanup --non-interactive

# Export to JSON
wappler-cleanup --non-interactive --output results.json

# Specify project directory
wappler-cleanup --project-root /path/to/wappler/project
```

## How It Works

### 1. Discovery Phase
- Scans `/app/api/**/*.json` and `/app/lib/**/*.json`
- Only includes files with `exec` or `steps` (actual server actions)
- Detects empty folders that can be safely removed

### 2. Reference Detection
The tool looks for these patterns:

**HTML/EJS Files:**
- `url="/api/v1/courses/create"`
- `action="/api/v1/security/login"`

**JSON Files (Critical for Queues):**
- `"api_file": "/app/api/v1/queues/integrations/mailerlite/sync/..."`
- `"exec": "lib/security/check"`
- `"module": "core"`

**JavaScript Files:**
- `fetch('/api/v1/courses')`
- `url: '/api/v1/users'`

### 3. Confidence Scoring
- **Safe to Delete**: No references found - likely safe to delete
- **Review Needed**: References found - manual review required

### 4. Interactive Features
- 📋 View all actions with status indicators
- 🔍 Detailed view with references and file content
- ☑️ Multi-select actions for deletion
- 🗂️ Empty folder detection and cleanup
- 🚨 Confirmation prompts with backup options
- 💾 Export results for team review

## Safety Features

- **Dry Run Default**: Shows what would be deleted without actually deleting
- **Backup System**: Creates timestamped backups before deletion
- **Confidence Levels**: Clear indicators of deletion safety
- **Interactive Confirmation**: Multiple confirmation steps for deletion
- **Detailed Logging**: See exactly what references were found

## Example Output

```
📊 Scan Results Summary

✅ Used actions: 180
⚠️  Review needed: 45  
🗑️ Safe to delete: 20
📁 Empty folders: 5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total actions: 245
```

## What Would You Like to Do?
- 🗑️ View safe to delete items (25)
- 📋 View all actions (245)  
- ☑️ Select items for deletion (0 selected)
- 💾 Export results to JSON
- 👋 Exit

## Common Use Cases

1. **Initial Cleanup**: Run after project development to remove test/debug actions
2. **Pre-Deployment**: Clean unused actions before production deployment  
3. **Code Review**: Export results for team review of potentially unused code
4. **Maintenance**: Regular cleanup to keep codebase lean
5. **Folder Management**: Remove empty directories after file cleanup

## Edge Cases Handled

- **Queue Jobs**: Detects `api_file` references in Bull queue definitions
- **Dynamic References**: Identifies computed API paths in JavaScript
- **Library Actions**: Finds `lib/` references in exec statements
- **Webhook Actions**: Scans webhook handlers for API calls
- **Schedule Jobs**: Checks cron job definitions
- **Nested Empty Folders**: Recursively finds and handles empty directory trees

## Configuration

Create an `ignore-list.json` file in your project root to exclude specific paths:

```json
{
  "ignored": [
    "/api/dev-test",
    "/api/template-*",
    "lib/shared/utilities"
  ]
}
```

## Warning

Always review results carefully before deletion. The tool is designed to be safe, but:
- Some actions might be referenced dynamically in ways not detectable by static analysis
- Environment-specific actions might be needed in production but not development
- Create backups and test thoroughly after cleanup

## Contributing

Issues and pull requests welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT - see [LICENSE](LICENSE) file for details.