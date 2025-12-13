// Configuration variables for plant taxonomy list project
const path = require('path');

// Get the base directory (where config.js lives, which is the project root)
const BASE_DIR = __dirname;

const config = {
  // Input paths
  vaultPath: '../wikihew',
  dataFile: 'plant-data.json',
  markdownFile: 'plant taxonomy list.md',
  
  // Output paths
  atlasDataPath: '../atlas/_data/plant-data.json',
  wikiMarkdownPath: '../wikihew/plant taxonomy list.md',
  
  // Script files
  dataScript: 'generate-data.js',
  markdownScript: 'generate-markdown.js'
};

// Resolve all relative paths to absolute paths
Object.keys(config).forEach(key => {
  config[key] = path.resolve(BASE_DIR, config[key]);
});

module.exports = config;