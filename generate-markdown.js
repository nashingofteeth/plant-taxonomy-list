#!/usr/bin/env node

const path = require('path');
const {
  Logger,
  validateFile,
  formatDate,
  safeReadFile,
  safeWriteFile
} = require('./utils');

// Configuration
const INPUT_FILE = path.resolve(__dirname, 'plant-data.json');
const OUTPUT_FILE = path.resolve(__dirname, 'plant taxonomy tree.md');

// Generate markdown from JSON tree (original implementation)
function generateMarkdown(taxonomy, level = 0) {
  let markdown = '';
  const indent = '\t'.repeat(level);

  for (const node of taxonomy) {
    // Show the taxonomy level name or file
    if (node.file) {
      markdown += `${indent}- [[${node.file.fileName}]]\n`;
    } else {
      markdown += `${indent}- ${node.name}\n`;
    }

    // Show other files at this level
    for (const file of node.otherFiles) {
      markdown += `${indent}\t- [[${file.fileName}]]\n`;
    }

    // Recursively process children
    if (node.children.length > 0) {
      markdown += generateMarkdown(node.children, level + 1);
    }
  }

  return markdown;
}

// Main execution
function main() {
  try {
    Logger.info('Starting markdown generation...');
    Logger.info(`Input file: ${INPUT_FILE}`);
    Logger.info(`Output file: ${OUTPUT_FILE}`);

    // Check if input file exists
    validateFile(INPUT_FILE, 'Input file');

    // Read JSON data
    Logger.info('Reading plant data...');
    const data = JSON.parse(safeReadFile(INPUT_FILE, 'Plant data JSON'));

    // Generate markdown
    Logger.info('Generating markdown...');
    const generatedDate = new Date(data.generated);
    const today = generatedDate.toISOString().split('T')[0];

    // Format date for daily note wikilink (YYYY-MM-DD)
    const dailyNoteLink = today;

    const frontmatter = `---
created: ${today}
modified: ${today}
tags:
  - lists
---

Last updated: [[${dailyNoteLink}]]

`;

    const markdown = frontmatter + generateMarkdown(data.taxonomy);

    // Write to file
    safeWriteFile(OUTPUT_FILE, markdown, 'Markdown taxonomy tree');
    Logger.info(`Total plants catalogued: ${data.totalPlants}`);

  } catch (error) {
    Logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  generateMarkdown
};