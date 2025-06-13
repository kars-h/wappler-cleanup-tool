const chalk = require('chalk');
const fs = require('fs-extra');
const { table } = require('table');

class Reporter {
  constructor(results) {
    this.results = results;
  }

  printSummary() {
    const { summary } = this.results;
    
    console.log(`
${chalk.blue.bold('📊 Server Action Analysis Results')}

${chalk.green('✅ Used actions:')} ${summary.used}
${chalk.yellow('⚠️  Possibly unused:')} ${summary.possiblyUnused}
${chalk.red('🗑️  Likely unused:')} ${summary.likelyUnused}
${chalk.gray('━'.repeat(50))}
${chalk.bold('Total actions:')} ${summary.totalActions}

${chalk.bold('🎯 High confidence unused actions:')}
`);

    const highConfidenceUnused = this.results.actions.filter(
      action => action.confidence === 'high' && action.status === 'likely-unused'
    );

    if (highConfidenceUnused.length === 0) {
      console.log(chalk.green('  None found! 🎉'));
    } else {
      highConfidenceUnused.slice(0, 10).forEach(action => {
        console.log(`  ${chalk.red('🗑️')} ${action.filePath}`);
      });
      
      if (highConfidenceUnused.length > 10) {
        console.log(chalk.gray(`  ... and ${highConfidenceUnused.length - 10} more`));
      }
    }

    console.log('\n' + chalk.gray('💡 Use interactive mode for detailed analysis and deletion'));
  }

  async saveJson(filename) {
    await fs.writeJson(filename, this.results, { spaces: 2 });
  }

  async saveHtml(filename) {
    const html = this.generateHtmlReport();
    await fs.writeFile(filename, html);
  }

  generateHtmlReport() {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Server Action Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .used { color: #28a745; }
        .possibly-unused { color: #ffc107; }
        .likely-unused { color: #dc3545; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .high-confidence { background-color: #ffebee; }
        .medium-confidence { background-color: #fff3e0; }
        .low-confidence { background-color: #e8f5e8; }
    </style>
</head>
<body>
    <h1>🧹 Server Action Analysis Report</h1>
    
    <div class="summary">
        <h2>📊 Summary</h2>
        <p><span class="used">✅ Used actions:</span> ${this.results.summary.used}</p>
        <p><span class="possibly-unused">⚠️ Possibly unused:</span> ${this.results.summary.possiblyUnused}</p>
        <p><span class="likely-unused">🗑️ Likely unused:</span> ${this.results.summary.likelyUnused}</p>
        <p><strong>Total actions:</strong> ${this.results.summary.totalActions}</p>
    </div>

    <h2>📋 All Actions</h2>
    <table>
        <thead>
            <tr>
                <th>Status</th>
                <th>Confidence</th>
                <th>References</th>
                <th>URL Path</th>
                <th>File Path</th>
            </tr>
        </thead>
        <tbody>
            ${this.results.actions.map(action => `
                <tr class="${action.confidence}-confidence">
                    <td class="${action.status.replace('-', '-')}">${this.getStatusEmoji(action.status)} ${action.status}</td>
                    <td>${action.confidence}</td>
                    <td>${action.referenceCount}</td>
                    <td><code>${action.urlPath}</code></td>
                    <td><code>${action.filePath}</code></td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    <p><em>Generated on ${new Date().toLocaleString()}</em></p>
</body>
</html>
    `;
  }

  getStatusEmoji(status) {
    switch (status) {
      case 'used': return '✅';
      case 'possibly-unused': return '⚠️';
      case 'likely-unused': return '🗑️';
      default: return '❓';
    }
  }
}

module.exports = { Reporter };