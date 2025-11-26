#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const VAULT_PATH = path.resolve(__dirname, '../../Wikihew');
const OUTPUT_FILE = path.resolve(__dirname, '../../Wikihew/plant taxonomy tree.md');
const TAG_PREFIX = 'life/eukaryota/plantae';

// Parse frontmatter from markdown file
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) return null;

  const frontmatter = match[1];
  const tags = [];

  // Parse tags (handle both array and single line formats)
  const tagsMatch = frontmatter.match(/tags:\s*\n((?:  - .+\n)+)/);
  if (tagsMatch) {
    const tagLines = tagsMatch[1].match(/  - (.+)/g);
    if (tagLines) {
      tagLines.forEach(line => {
        const tag = line.replace(/^  - /, '').trim();
        tags.push(tag);
      });
    }
  }

  return { tags };
}

// Recursively find all markdown files
function findMarkdownFiles(dir) {
  let results = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results = results.concat(findMarkdownFiles(fullPath));
    } else if (item.endsWith('.md')) {
      results.push(fullPath);
    }
  }

  return results;
}

// Extract plant taxonomy data from files
function extractPlantData() {
  console.log('Scanning vault for plant files...');
  const allFiles = findMarkdownFiles(VAULT_PATH);
  const plantFiles = [];

  for (const filePath of allFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const frontmatter = parseFrontmatter(content);

    if (!frontmatter) continue;

    // Find plant taxonomy tags
    const plantTags = frontmatter.tags.filter(tag =>
      tag.startsWith(TAG_PREFIX)
    );

    if (plantTags.length > 0) {
      const fileName = path.basename(filePath, '.md');
      plantFiles.push({
        fileName,
        filePath,
        tags: plantTags
      });
    }
  }

  console.log(`Found ${plantFiles.length} plant files`);
  return plantFiles;
}

// Build hierarchical tree structure
function buildTaxonomyTree(plantFiles) {
  const tree = {};

  for (const file of plantFiles) {
    for (const tag of file.tags) {
      // Split tag into hierarchy parts
      const parts = tag.split('/');

      // Navigate/create tree structure
      let current = tree;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        if (!current[part]) {
          current[part] = {
            name: part,
            children: {},
            files: []  // Changed: store multiple files at each level
          };
        }

        // If this is the last part of the tag, add the file here
        if (i === parts.length - 1) {
          current[part].files.push(file.fileName);
        }

        current = current[part].children;
      }
    }
  }

  return tree;
}

// Capitalize first letter of a string
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Check if a filename matches the taxonomy level name
function fileMatchesTaxonomy(fileName, taxonomyName) {
  // Normalize both for comparison (lowercase, remove spaces/hyphens)
  const normalizeForComparison = (str) => str.toLowerCase().replace(/[\s-]/g, '');
  return normalizeForComparison(fileName) === normalizeForComparison(taxonomyName);
}

// Check if any child node name matches one of the file names
function hasMatchingChildNode(node) {
  for (const childKey of Object.keys(node.children)) {
    for (const fileName of node.files) {
      if (fileMatchesTaxonomy(fileName, childKey)) {
        return true;
      }
    }
  }
  return false;
}

// Generate markdown list from tree
function generateMarkdown(tree, level = 0, parentFiles = []) {
  let markdown = '';
  const indent = '\t'.repeat(level);

  // Sort keys alphabetically for consistent output
  const sortedKeys = Object.keys(tree).sort();

  for (const key of sortedKeys) {
    const node = tree[key];
    const displayName = capitalize(node.name);

    // Check if any file at THIS level matches the taxonomy name
    const matchingFileAtThisLevel = node.files.find(f => fileMatchesTaxonomy(f, node.name));

    // Check if any file at PARENT level matches this node's name
    const matchingFileAtParentLevel = parentFiles.find(f => fileMatchesTaxonomy(f, node.name));

    // Use whichever matching file we found
    const matchingFile = matchingFileAtThisLevel || matchingFileAtParentLevel;

    const otherFiles = node.files.filter(f => !fileMatchesTaxonomy(f, node.name));

    if (matchingFile) {
      // Show as wikilink if a matching file exists
      markdown += `${indent}- [[${matchingFile}]]\n`;

      // Show any other files tagged at this level (that don't match the taxonomy name)
      // BUT: skip files that match a child node name (they'll be shown as that child node)
      const filesToShow = otherFiles.filter(fileName => {
        return !Object.keys(node.children).some(childKey =>
          fileMatchesTaxonomy(fileName, childKey)
        );
      });

      if (filesToShow.length > 0) {
        const sortedFilesToShow = filesToShow.sort();
        for (const fileName of sortedFilesToShow) {
          markdown += `${indent}\t- [[${fileName}]]\n`;
        }
      }
    } else {
      // Show as plain text if no matching file
      markdown += `${indent}- ${displayName}\n`;

      // Show any files tagged at this level
      // BUT: skip files that match a child node name (they'll be shown as that child node)
      const filesToShow = node.files.filter(fileName => {
        return !Object.keys(node.children).some(childKey =>
          fileMatchesTaxonomy(fileName, childKey)
        );
      });

      if (filesToShow.length > 0) {
        const sortedFiles = filesToShow.sort();
        for (const fileName of sortedFiles) {
          markdown += `${indent}\t- [[${fileName}]]\n`;
        }
      }
    }

    // Recursively process children, passing down this node's files
    if (Object.keys(node.children).length > 0) {
      markdown += generateMarkdown(node.children, level + 1, node.files);
    }
  }

  return markdown;
}

// Main execution
function main() {
  console.log('Starting plant taxonomy tree generation...');
  console.log(`Vault path: ${VAULT_PATH}`);
  console.log(`Output file: ${OUTPUT_FILE}`);
  console.log('');

  // Extract plant data
  const plantFiles = extractPlantData();

  if (plantFiles.length === 0) {
    console.log('No plant files found!');
    return;
  }

  // Build tree
  console.log('Building taxonomy tree...');
  const tree = buildTaxonomyTree(plantFiles);

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

  // Skip "life", "eukaryota", "plantae" levels and go directly to children
  let startTree = tree;
  let parentFiles = [];
  if (startTree.life && startTree.life.children.eukaryota) {
    startTree = startTree.life.children.eukaryota.children;
    if (startTree.plantae && startTree.plantae.children) {
      parentFiles = startTree.plantae.files;  // Save plantae's files to pass as parent
      startTree = startTree.plantae.children;
    }
  }

  const markdown = frontmatter + generateMarkdown(startTree, 0, parentFiles);

  // Write to file
  fs.writeFileSync(OUTPUT_FILE, markdown);
  console.log(`\nSuccessfully generated: ${OUTPUT_FILE}`);
  console.log(`Total plants catalogued: ${plantFiles.length}`);
}

// Run the script
try {
  main();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
