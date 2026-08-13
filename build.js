#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const config = require('./config');
const { Logger } = require('./utils');

Logger.info('Building plant taxonomy list...');

try {
  // Generate data
  Logger.info('Generating data...');
  execSync(`node "${config.dataScript}"`, { stdio: 'inherit' });
  
  // Generate markdown
  Logger.info('Generating markdown...');
  execSync(`node "${config.markdownScript}"`, { stdio: 'inherit' });
  
  // Copy files to destinations
  Logger.info('Copying data file to potato...');
  execSync(`cp "${config.dataFile}" "${config.potatoDataPath}"`, { stdio: 'inherit' });
  
  Logger.info('Copying markdown file to wiki...');
  execSync(`cp "${config.markdownFile}" "${config.wikiMarkdownPath}"`, { stdio: 'inherit' });
  
  Logger.success('Build completed successfully!');
} catch (error) {
  Logger.error(`Build failed: ${error.message}`);
  process.exit(1);
}