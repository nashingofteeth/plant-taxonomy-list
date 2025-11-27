#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const VAULT_PATH = path.resolve(__dirname, '../../Wikihew');
const OUTPUT_FILE = path.resolve(__dirname, 'plant-data.json');
const TAG_PREFIX = 'life/eukaryota/plantae';

// Parse frontmatter from markdown file
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) return null;

  const frontmatter = match[1];
  const tags = [];

  // Parse tags
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

// Parse frontmatter to extract metadata
function getFileMetadata(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { wikipedia: null, aliases: [] };
    }

    const frontmatter = match[1];

    // Extract Wikipedia link
    let wikipedia = null;
    const wikipediaMatch = frontmatter.match(/wikipedia:\s*(.+)/);
    if (wikipediaMatch) {
      wikipedia = wikipediaMatch[1].trim();
    }

    // Extract aliases
    let aliases = [];
    const aliasesMatch = frontmatter.match(/aliases:\s*\n((?:  - .+(?:\n|$))+)/);
    if (aliasesMatch) {
      const aliasLines = aliasesMatch[1].match(/  - (.+)/g);
      if (aliasLines) {
        aliases = aliasLines.map(line => line.replace(/^  - /, '').trim());
      }
    }

    return { wikipedia, aliases };
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return { wikipedia: null, aliases: [] };
  }
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
      const { wikipedia, aliases } = getFileMetadata(filePath);

      plantFiles.push({
        fileName,
        tags: plantTags,
        wikipedia,
        aliases
      });
    }
  }

  console.log(`Found ${plantFiles.length} plant files`);
  return plantFiles;
}

// Check if a filename matches the taxonomy level name
function fileMatchesTaxonomy(fileName, taxonomyName) {
  const normalizeForComparison = (str) => str.toLowerCase().replace(/[\s-]/g, '');
  return normalizeForComparison(fileName) === normalizeForComparison(taxonomyName);
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
            files: []
          };
        }

        // If this is the last part of the tag, add the file here
        if (i === parts.length - 1) {
          current[part].files.push({
            fileName: file.fileName,
            wikipedia: file.wikipedia,
            aliases: file.aliases
          });
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

// Convert tree to simplified JSON structure
function treeToJSON(tree, parentFiles = []) {
  const result = [];

  const sortedKeys = Object.keys(tree).sort();

  for (const key of sortedKeys) {
    const node = tree[key];

    // Check if any file at this level or parent level matches the taxonomy name
    const matchingFileAtThisLevel = node.files.find(f => fileMatchesTaxonomy(f.fileName, node.name));
    const matchingFileAtParentLevel = parentFiles.find(f => fileMatchesTaxonomy(f.fileName, node.name));
    const matchingFile = matchingFileAtThisLevel || matchingFileAtParentLevel;

    // Process children and check for binomial name matches
    const children = [];
    const childKeys = Object.keys(node.children).sort();

    // For each child, check if any file matches "parent child" (binomial name)
    for (const childKey of childKeys) {
      const childNode = node.children[childKey];

      // Look for a file in current level or parent level that matches "nodeName childKey"
      const binomialPattern = `${node.name} ${childKey}`;
      const matchingBinomialFile = [...node.files, ...parentFiles].find(f =>
        fileMatchesTaxonomy(f.fileName, binomialPattern)
      );

      if (matchingBinomialFile) {
        // This child should use the full binomial name from the species file
        const childItem = {
          name: matchingBinomialFile.fileName, // Use full binomial name instead of just epithet
          file: matchingBinomialFile,
          otherFiles: childNode.files
            .filter(f => !fileMatchesTaxonomy(f.fileName, childKey))
            .sort((a, b) => a.fileName.localeCompare(b.fileName)),
          children: Object.keys(childNode.children).length > 0
            ? treeToJSON(childNode.children, childNode.files)
            : []
        };
        children.push(childItem);
      } else {
        // Normal child processing
        children.push(...treeToJSON({ [childKey]: childNode }, node.files));
      }
    }

    // Get other files (not matching taxonomy name and not matching child nodes)
    const otherFiles = node.files.filter(f => {
      if (fileMatchesTaxonomy(f.fileName, node.name)) return false;

      // Check if file matches any child node name
      if (childKeys.some(childKey => fileMatchesTaxonomy(f.fileName, childKey))) return false;

      // Check if file matches any binomial pattern (nodeName childKey)
      if (childKeys.some(childKey => {
        const binomialPattern = `${node.name} ${childKey}`;
        return fileMatchesTaxonomy(f.fileName, binomialPattern);
      })) return false;

      return true;
    });

    const item = {
      name: capitalize(node.name),
      file: matchingFile || null,
      otherFiles: otherFiles.sort((a, b) => a.fileName.localeCompare(b.fileName)),
      children: children
    };

    result.push(item);
  }

  return result;
}

// Main execution
function main() {
  console.log('Starting plant data generation...');
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

  // Skip "life", "eukaryota", "plantae" levels and go directly to children
  let startTree = tree;
  let parentFiles = [];
  if (startTree.life && startTree.life.children.eukaryota) {
    startTree = startTree.life.children.eukaryota.children;
    if (startTree.plantae && startTree.plantae.children) {
      parentFiles = startTree.plantae.files;
      startTree = startTree.plantae.children;
    }
  }

  // Convert to JSON
  console.log('Converting to JSON...');
  const jsonData = {
    generated: new Date().toISOString(),
    totalPlants: plantFiles.length,
    taxonomy: treeToJSON(startTree, parentFiles)
  };

  // Write to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(jsonData, null, 2));
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
