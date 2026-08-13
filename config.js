// Configuration variables for plant taxonomy list project
const path = require('path');
const fs = require('fs');

// Get the base directory (where config.js lives, which is the project root)
const BASE_DIR = __dirname;

// Load .env file manually (no external dependency needed)
const envFile = path.join(BASE_DIR, '.env');
const env = {};
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf-8')
    .split('\n')
    .forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      env[key] = value;
    });
}

const DATA_FILE = 'plant-data.json';
const MARKDOWN_FILE = 'plant taxonomy list.md';

const config = {
  // Input paths
  vaultPath: env.VAULT_PATH,
  dataFile: DATA_FILE,
  markdownFile: MARKDOWN_FILE,

  // Output paths
  potatoDataPath: env.POTATO_DATA_PATH,
  wikiMarkdownPath: path.join(env.VAULT_PATH, MARKDOWN_FILE),

  // Script files
  dataScript: 'generate-data.js',
  markdownScript: 'generate-markdown.js'
};

// Resolve all relative paths to absolute paths
Object.keys(config).forEach(key => {
  if (typeof config[key] === 'string') {
    config[key] = path.resolve(BASE_DIR, config[key]);
  }
});

module.exports = config;
