#!/usr/bin/env node

const path = require('path');
const config = require('./config');
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
  VAULT_PATH: config.vaultPath,
  OUTPUT_FILE: config.dataFile,
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

// Normalized prefix comparison: does `fileName` name a taxon strictly below the
// `taxonomyName` (e.g. "Apium graveolens var. dulce" vs "apium graveolens")?
function fileNameStartsWithTaxonomy(fileName, taxonomyName) {
  const norm = s => s.toLowerCase().replace(/[\s-]/g, '').replace(/[×x]/g, '');
  const fn = norm(fileName);
  const tx = norm(taxonomyName);
  return fn.startsWith(tx) && fn.length > tx.length;
}

// Detect a species-epithet child that has no species note but does have taxa
// below it (varieties/subspecies) — e.g. "graveolens" under "apium" with the
// note "Apium graveolens var. dulce". Lets the generator render a clean
// "Apium graveolens" species node instead of a bare "Graveolens" node.
function isSpeciesEpithet(parentName, childKey, childNode) {
  const prefix = `${parentName} ${childKey}`;
  return (childNode.files || []).some(f => fileNameStartsWithTaxonomy(f.fileName, prefix));
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

// Build a file attributes object — drops fileName (redundant with node.name),
// omits aliases when empty to keep the JSON lean
function fileToAttrs(f) {
  const attrs = {};
  if (f.wikipedia) attrs.wikipedia = f.wikipedia;
  if (f.aliases && f.aliases.length) attrs.aliases = f.aliases;
  return attrs;
}

// Convert a file entry to a leaf child node (species without taxonomy sub-levels)
function fileToLeafNode(f) {
  return { name: f.fileName, file: fileToAttrs(f) };
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

    // Build taxonomy children with binomial name matching
    const taxonomyChildren = [];
    for (const childKey of childKeys) {
      const childNode = node.children[childKey];
      const allFiles = [...node.files, ...parentFiles];
      const binomialMatch = findBinomialMatch(allFiles, node.name, childKey);

      if (binomialMatch) {
        // Binomial species node: leftover files become its leaf children
        const leafChildren = childNode.files
          .filter(f => !fileMatchesTaxonomy(f.fileName, childKey))
          .sort((a, b) => a.fileName.localeCompare(b.fileName))
          .map(fileToLeafNode);

        const deepChildren = Object.keys(childNode.children).length > 0
          ? treeToJSON(childNode.children, childNode.files)
          : [];

        const allChildren = [...leafChildren, ...deepChildren];
        const entry = {
          name: binomialMatch.fileName,
          file: fileToAttrs(binomialMatch),
        };
        if (allChildren.length) entry.children = allChildren;
        taxonomyChildren.push(entry);
      } else if (isSpeciesEpithet(node.name, childKey, childNode)) {
        // No species note, but a taxon below the species exists (e.g. a variety
        // named "Apium graveolens var. dulce"). Render a proper "Apium graveolens"
        // species node so the variety nests under it.
        const leafChildren = childNode.files
          .filter(f => !fileMatchesTaxonomy(f.fileName, childKey))
          .sort((a, b) => a.fileName.localeCompare(b.fileName))
          .map(fileToLeafNode);
        const deepChildren = Object.keys(childNode.children).length > 0
          ? treeToJSON(childNode.children, childNode.files)
          : [];
        const allChildren = [...leafChildren, ...deepChildren];
        const entry = { name: `${capitalize(node.name)} ${childKey}`, file: null };
        if (allChildren.length) entry.children = allChildren;
        taxonomyChildren.push(entry);
      } else {
        taxonomyChildren.push(...treeToJSON({ [childKey]: childNode }, node.files));
      }
    }

    // Leaf species listed before taxonomy children
    const leafChildren = filterOtherFiles(node.files, node.name, childKeys)
      .sort((a, b) => a.fileName.localeCompare(b.fileName))
      .map(fileToLeafNode);

    const allChildren = [...leafChildren, ...taxonomyChildren];

    const entry = {
      name: capitalize(node.name),
      file: matchingFile ? fileToAttrs(matchingFile) : null,
    };
    if (allChildren.length) entry.children = allChildren;

    result.push(entry);
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
    safeWriteFile(CONFIG.OUTPUT_FILE, JSON.stringify(jsonData), 'Plant data JSON');
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
