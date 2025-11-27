#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = path.resolve(__dirname, 'plant-data.json');
const OUTPUT_FILE = path.resolve(__dirname, '../../Wikihew/plant taxonomy tree.md');

// Generate markdown from JSON tree
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
  console.log('Starting markdown generation...');
  console.log(`Input file: ${INPUT_FILE}`);
  console.log(`Output file: ${OUTPUT_FILE}`);
  console.log('');

  // Check if input file exists
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Error: Input file not found: ${INPUT_FILE}`);
    console.log('Please run generate-plant-data.js first.');
    process.exit(1);
  }

  // Read JSON data
  console.log('Reading plant data...');
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

  // Generate markdown
  console.log('Generating markdown...');
  const today = new Date().toISOString().split('T')[0];
  const frontmatter = `---
created: ${today}
modified: ${today}
tags:
  - lists
---
`;

  const markdown = frontmatter + generateMarkdown(data.taxonomy);

  // Write to file
  fs.writeFileSync(OUTPUT_FILE, markdown);
  console.log(`\nSuccessfully generated: ${OUTPUT_FILE}`);
  console.log(`Total plants catalogued: ${data.totalPlants}`);
}

// Run the script
try {
  main();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
