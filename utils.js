#!/usr/bin/env node

/**
 * Shared utilities for plant taxonomy scripts
 * Provides common functionality for logging, file operations, validation, and templates
 */

const fs = require('fs');
const path = require('path');

/**
 * Logger utility with structured logging levels
 */
const Logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  error: (message) => console.error(`[ERROR] ${message}`),
  warn: (message) => console.warn(`[WARN] ${message}`),
  success: (message) => console.log(`[SUCCESS] ${message}`)
};

/**
 * Validate that a file exists and is not empty
 * @param {string} filePath - Path to the file
 * @param {string} description - Description for error messages
 * @returns {fs.Stats} File statistics
 */
function validateFile(filePath, description = 'File') {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${description} not found: ${filePath}`);
  }
  
  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    throw new Error(`${description} is empty: ${filePath}`);
  }
  
  return stats;
}

/**
 * Validate that a directory exists and is actually a directory
 * @param {string} dirPath - Path to the directory
 * @param {string} description - Description for error messages
 * @returns {fs.Stats} Directory statistics
 */
function validateDirectory(dirPath, description = 'Directory') {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`${description} does not exist: ${dirPath}`);
  }
  
  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) {
    throw new Error(`${description} is not a directory: ${dirPath}`);
  }
  
  return stats;
}

/**
 * Format date as YYYY-MM-DD string
 * @param {Date} date - Date to format (defaults to now)
 * @returns {string} Formatted date string
 */
function formatDate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

/**
 * Format date as full ISO string
 * @param {Date} date - Date to format (defaults to now)
 * @returns {string} ISO formatted date string
 */
function formatDateTime(date = new Date()) {
  return date.toISOString();
}

/**
 * Safely read a file with validation and error handling
 * @param {string} filePath - Path to the file
 * @param {string} description - Description for error messages
 * @returns {string} File content
 */
function safeReadFile(filePath, description = 'File') {
  try {
    validateFile(filePath, description);
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    Logger.error(`Failed to read ${description}: ${error.message}`);
    throw error;
  }
}

/**
 * Safely write a file with error handling
 * @param {string} filePath - Path to the file
 * @param {string} content - Content to write
 * @param {string} description - Description for error messages
 */
function safeWriteFile(filePath, content, description = 'File') {
  try {
    fs.writeFileSync(filePath, content);
    Logger.success(`Successfully wrote: ${filePath}`);
  } catch (error) {
    Logger.error(`Failed to write ${description}: ${error.message}`);
    throw error;
  }
}

/**
 * Create template by replacing variables in a string
 * @param {string} template - Template string with {variable} placeholders
 * @param {Object} variables - Object with variable values
 * @returns {string} Processed template
 */
function createTemplate(template, variables = {}) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{${key}}`, 'g'), value);
  }
  return result;
}

/**
 * Recursively find all markdown files in a directory
 * @param {string} dir - Directory to search
 * @returns {string[]} Array of file paths
 */
function findMarkdownFiles(dir) {
  let results = [];
  
  try {
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
  } catch (error) {
    Logger.warn(`Skipping directory ${dir}: ${error.message}`);
  }
  
  return results;
}

/**
 * Check if a filename matches the taxonomy level name (normalized comparison)
 * Handles hybrid notation (× and x) used in botanical nomenclature
 * @param {string} fileName - File name to compare
 * @param {string} taxonomyName - Taxonomy name to compare
 * @returns {boolean} Whether they match
 */
function fileMatchesTaxonomy(fileName, taxonomyName) {
  const normalizeForComparison = (str) => 
    str.toLowerCase()
       .replace(/[\s-]/g, '')      // Remove spaces and hyphens
       .replace(/[×x]/g, '');       // Remove hybrid indicators (× and x)
  return normalizeForComparison(fileName) === normalizeForComparison(taxonomyName);
}

/**
 * Capitalize first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Analyze taxonomy structure and return statistics
 * @param {Array} taxonomy - Taxonomy array
 * @param {number} depth - Current depth (for recursion)
 * @returns {Object} Statistics object
 */
function analyzeTaxonomy(taxonomy, depth = 0) {
  let maxDepth = depth;
  let totalNodes = taxonomy.length;
  let totalFiles = 0;
  let nodesWithFiles = 0;
  
  for (const node of taxonomy) {
    if (node.file) {
      totalFiles++;
      nodesWithFiles++;
    }
    
    totalFiles += node.otherFiles.length;
    
    if (node.children.length > 0) {
      const childStats = analyzeTaxonomy(node.children, depth + 1);
      maxDepth = Math.max(maxDepth, childStats.maxDepth);
      totalNodes += childStats.totalNodes;
      totalFiles += childStats.totalFiles;
      nodesWithFiles += childStats.nodesWithFiles;
    }
  }
  
  return { 
    maxDepth, 
    totalNodes, 
    totalFiles,
    nodesWithFiles
  };
}

/**
 * Extract all files from taxonomy tree for index generation
 * @param {Array} taxonomy - Taxonomy array
 * @returns {Array} Array of file objects
 */
function extractAllFiles(taxonomy) {
  const files = [];
  
  for (const node of taxonomy) {
    if (node.file) {
      files.push(node.file);
    }
    
    files.push(...node.otherFiles);
    
    if (node.children.length > 0) {
      files.push(...extractAllFiles(node.children));
    }
  }
  
  return files;
}

module.exports = {
  Logger,
  validateFile,
  validateDirectory,
  formatDate,
  formatDateTime,
  safeReadFile,
  safeWriteFile,
  createTemplate,
  findMarkdownFiles,
  fileMatchesTaxonomy,
  capitalize,
  analyzeTaxonomy,
  extractAllFiles
};