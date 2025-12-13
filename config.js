// Configuration variables for plant taxonomy list project
const config = {
  // Input paths
  vaultPath: '../wikihew',
  dataFile: 'plant-data.json',
  markdownFile: 'plant taxonomy list.md',
  
  // Output paths
  atlasDataPath: '../atlas/_data/plant-data.json',
  wikiMarkdownPath: '../wikihew/plant taxonomy list.md',
  atlasPath: '../atlas',
  
  // Script files
  dataScript: 'generate-data.js',
  markdownScript: 'generate-markdown.js',
  atlasBuildScript: 'build.js'
};

module.exports = config;