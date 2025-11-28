#!/usr/bin/env node

const path = require('path');
const {
  Logger,
  validateDirectory,
  formatDateTime,
  safeWriteFile,
  findMarkdownFiles,
  fileMatchesTaxonomy,
  capitalize
} = require('./utils');

// Configuration
const CONFIG = {
  VAULT_PATH: path.resolve(__dirname, '../wikihew'),
  OUTPUT_FILE: path.resolve(__dirname, 'plant-data.json'),
  TAG_PREFIX: 'life/eukaryota/plantae',
  FRONTMATTER_REGEX: /^---\s*\n([\s\S]*?)\n---/,
  TAGS_REGEX: /tags:\s*\n((?:  - .+\n)+)/,
  WIKIPEDIA_REGEX: /wikipedia:\s*(.+)/,
  ALIASES_REGEX: /aliases:\s*\n((?:  - .+(?:\n|$))+)/,
  TAG_LINE_REGEX: /  - (.+)/g,
  PROGRESS_INTERVAL: 500
};

// Consolidated frontmatter parser
function parseFrontmatter(content) {
  const match = content.match(CONFIG.FRONTMATTER_REGEX);
  if (!match) return null;

  const frontmatter = match[1];
  const result = {
    tags: [],
    wikipedia: null,
    aliases: []
  };

  // Parse tags
  const tagsMatch = frontmatter.match(CONFIG.TAGS_REGEX);
  if (tagsMatch) {
    const tagLines = tagsMatch[1].match(CONFIG.TAG_LINE_REGEX);
    if (tagLines) {
      result.tags = tagLines.map(line => 
        line.replace(/^  - /, '').trim()
      );
    }
  }

  // Extract Wikipedia link
  const wikipediaMatch = frontmatter.match(CONFIG.WIKIPEDIA_REGEX);
  if (wikipediaMatch) {
    result.wikipedia = wikipediaMatch[1].trim();
  }

  // Extract aliases
  const aliasesMatch = frontmatter.match(CONFIG.ALIASES_REGEX);
  if (aliasesMatch) {
    const aliasLines = aliasesMatch[1].match(CONFIG.TAG_LINE_REGEX);
    if (aliasLines) {
      result.aliases = aliasLines.map(line => 
        line.replace(/^  - /, '').trim()
      );
    }
  }

  return result;
}

// Process vault in single pass
function processVault() {
  Logger.info('Scanning vault for plant files...');
  const allFiles = findMarkdownFiles(CONFIG.VAULT_PATH);
  const plantFiles = [];
  let processedCount = 0;
  
  for (const filePath of allFiles) {
    try {
      const content = require('fs').readFileSync(filePath, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      
      if (!frontmatter) continue;
      
      // Find plant taxonomy tags
      const plantTags = frontmatter.tags.filter(tag =>
        tag.startsWith(CONFIG.TAG_PREFIX)
      );
      
      if (plantTags.length > 0) {
        const fileName = path.basename(filePath, '.md');
        
        plantFiles.push({
          fileName,
          tags: plantTags,
          wikipedia: frontmatter.wikipedia,
          aliases: frontmatter.aliases
        });
      }
      
      processedCount++;
      if (processedCount % CONFIG.PROGRESS_INTERVAL === 0) {
        Logger.info(`Processed ${processedCount}/${allFiles.length} files`);
      }
      
    } catch (error) {
      Logger.error(`Error processing file ${filePath}: ${error.message}`);
    }
  }
  
  Logger.info(`Found ${plantFiles.length} plant files out of ${allFiles.length} total files`);
  return plantFiles;
}

// Build hierarchical tree structure
function buildTaxonomyTree(plantFiles) {
  Logger.info('Building taxonomy tree...');
  const tree = {};
  
  for (const file of plantFiles) {
    for (const tag of file.tags) {
      const parts = tag.split('/');
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

// Helper functions for tree processing
function findMatchingFile(files, nodeName) {
  return files.find(f => fileMatchesTaxonomy(f.fileName, nodeName));
}

function findBinomialMatch(files, parentName, childName) {
  const binomialPattern = `${parentName} ${childName}`;
  return files.find(f => fileMatchesTaxonomy(f.fileName, binomialPattern));
}

function filterOtherFiles(files, nodeName, childKeys) {
  return files.filter(f => {
    if (fileMatchesTaxonomy(f.fileName, nodeName)) return false;
    
    if (childKeys.some(childKey => fileMatchesTaxonomy(f.fileName, childKey))) return false;
    
    if (childKeys.some(childKey => {
      const binomialPattern = `${nodeName} ${childKey}`;
      return fileMatchesTaxonomy(f.fileName, binomialPattern);
    })) return false;
    
    return true;
  });
}

// Convert tree to simplified JSON structure
function treeToJSON(tree, parentFiles = []) {
  const result = [];
  const sortedKeys = Object.keys(tree).sort();
  
  for (const key of sortedKeys) {
    const node = tree[key];
    const childKeys = Object.keys(node.children).sort();
    
    // Find matching file for this node
    const matchingFile = findMatchingFile(node.files, node.name) || 
                        findMatchingFile(parentFiles, node.name);
    
    // Process children with binomial name matching
    const children = [];
    for (const childKey of childKeys) {
      const childNode = node.children[childKey];
      const allFiles = [...node.files, ...parentFiles];
      const binomialMatch = findBinomialMatch(allFiles, node.name, childKey);
      
      if (binomialMatch) {
        const otherFiles = childNode.files
          .filter(f => !fileMatchesTaxonomy(f.fileName, childKey))
          .sort((a, b) => a.fileName.localeCompare(b.fileName));
        
        children.push({
          name: binomialMatch.fileName,
          file: binomialMatch,
          otherFiles,
          children: Object.keys(childNode.children).length > 0
            ? treeToJSON(childNode.children, childNode.files)
            : []
        });
      } else {
        children.push(...treeToJSON({ [childKey]: childNode }, node.files));
      }
    }
    
    // Filter other files
    const otherFiles = filterOtherFiles(node.files, node.name, childKeys)
      .sort((a, b) => a.fileName.localeCompare(b.fileName));
    
    result.push({
      name: capitalize(node.name),
      file: matchingFile || null,
      otherFiles,
      children
    });
  }
  
  return result;
}

// Main execution
function main() {
  try {
    Logger.info('Starting plant data generation...');
    Logger.info(`Output file: ${CONFIG.OUTPUT_FILE}`);
    
    // Validate configuration
    validateDirectory(CONFIG.VAULT_PATH, 'Vault path');
    
    // Process vault
    const plantFiles = processVault();
    
    if (plantFiles.length === 0) {
      Logger.warn('No plant files found!');
      return;
    }
    
    // Build tree
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
    Logger.info('Converting to JSON...');
    const jsonData = {
      generated: formatDateTime(),
      totalPlants: plantFiles.length,
      taxonomy: treeToJSON(startTree, parentFiles)
    };
    
    // Write to file
    safeWriteFile(CONFIG.OUTPUT_FILE, JSON.stringify(jsonData, null, 2), 'Plant data JSON');
    Logger.info(`Total plants catalogued: ${plantFiles.length}`);
    
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
  parseFrontmatter,
  buildTaxonomyTree,
  treeToJSON,
  CONFIG
};
