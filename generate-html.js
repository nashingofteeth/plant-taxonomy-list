#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const VAULT_PATH = path.resolve(__dirname, '../../Wikihew');
const INPUT_FILE = path.resolve(__dirname, '../../Wikihew/plant taxonomy tree.md');
const OUTPUT_FILE = path.resolve(__dirname, '../../../Projects/github/atlas/public/plants.html');

// Cache for Wikipedia links and aliases
const wikipediaCache = new Map();
const aliasCache = new Map();

// Parse frontmatter to extract Wikipedia link and aliases
function getFileMetadata(filePath) {
  if (!fs.existsSync(filePath)) {
    return { wikipedia: null, aliases: [] };
  }

  if (wikipediaCache.has(filePath)) {
    return {
      wikipedia: wikipediaCache.get(filePath),
      aliases: aliasCache.get(filePath) || []
    };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      wikipediaCache.set(filePath, null);
      aliasCache.set(filePath, []);
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

    wikipediaCache.set(filePath, wikipedia);
    aliasCache.set(filePath, aliases);
    return { wikipedia, aliases };
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    wikipediaCache.set(filePath, null);
    aliasCache.set(filePath, []);
    return { wikipedia: null, aliases: [] };
  }
}

// Parse a line and convert wikilinks to HTML
function parseLineToHTML(line) {
  // Extract indentation (tabs)
  const indentMatch = line.match(/^(\t*)/);
  const indentLevel = indentMatch ? indentMatch[1].length : 0;

  // Remove indentation and bullet point
  let content = line.replace(/^\t*- /, '');

  // Check if it's a wikilink
  const wikilinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/;
  const match = content.match(wikilinkRegex);

  if (match) {
    const fileName = match[1];
    const displayName = match[2] || fileName;
    const filePath = path.join(VAULT_PATH, `${fileName}.md`);
    const { wikipedia, aliases } = getFileMetadata(filePath);

    // Build content with name and aliases (aliases outside link, smaller)
    let aliasText = '';
    if (aliases.length > 0) {
      aliasText = ` <span class="aliases">(${aliases.join(', ')})</span>`;
    }

    if (wikipedia) {
      // Create HTML link to Wikipedia (only link the name, not aliases)
      content = `<a href="${wikipedia}" target="_blank">${displayName}</a>${aliasText}`;
    } else {
      // Plain text if no Wikipedia link
      content = displayName + aliasText;
    }
  } else {
    // Non-wikilink content should be muted (items without notes)
    content = `<span class="muted">${content}</span>`;
  }

  return {
    indentLevel,
    content
  };
}

// Convert markdown to HTML
function convertMarkdownToHTML(markdownPath) {
  console.log('Reading markdown file...');
  const markdown = fs.readFileSync(markdownPath, 'utf-8');

  // Skip frontmatter
  const lines = markdown.split('\n');
  let inFrontmatter = false;
  let contentLines = [];

  for (const line of lines) {
    if (line.trim() === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true;
        continue;
      } else {
        inFrontmatter = false;
        continue;
      }
    }

    if (!inFrontmatter && line.trim()) {
      contentLines.push(line);
    }
  }

  console.log(`Processing ${contentLines.length} lines...`);

  // Parse lines with indent information
  const parsedLines = contentLines.map((line, index) => {
    const { indentLevel, content } = parseLineToHTML(line);
    // Check if next line is more indented (has children)
    const nextLine = contentLines[index + 1];
    let hasChildren = false;
    if (nextLine) {
      const nextIndentMatch = nextLine.match(/^(\t*)/);
      const nextIndent = nextIndentMatch ? nextIndentMatch[1].length : 0;
      hasChildren = nextIndent > indentLevel;
    }
    return { indentLevel, content, hasChildren };
  });

  // Convert lines to HTML with collapsible support
  let html = '';
  let currentIndent = -1;
  const openLists = [];

  for (const { indentLevel, content, hasChildren } of parsedLines) {
    // Close lists if we've decreased indent
    while (currentIndent >= indentLevel && openLists.length > 0) {
      html += '</ul>\n';
      openLists.pop();
      currentIndent--;
    }

    // Open new lists if we've increased indent
    while (currentIndent < indentLevel) {
      html += '<ul>\n';
      openLists.push(true);
      currentIndent++;
    }

    if (hasChildren) {
      html += `<li class="has-children" onclick="toggleNode(this)">${content}</li>\n`;
    } else {
      html += `<li>${content}</li>\n`;
    }
  }

  // Close all remaining lists
  while (openLists.length > 0) {
    html += '</ul>\n';
    openLists.pop();
  }

  return html;
}

// Generate complete HTML document
function generateHTMLDocument(bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>plants - matthew nash</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Courier New', Courier, monospace;
            line-height: 1.4;
            color: #2d3a2d;
            background-color: HoneyDew;
            padding: 2rem;
        }

        h1 {
            font-size: 1.2rem;
            font-weight: bold;
            margin-bottom: 1.5rem;
            color: #2d3a2d;
        }

        ul {
            list-style: none;
            margin-left: 0;
            padding-left: 2ch;
            border-left: 1px solid #d0e8d0;
        }

        /* Remove border from root level */
        body > ul {
            border-left: none;
            padding-left: 0;
        }

        li {
            margin: 0.2rem 0;
            position: relative;
            padding-left: 2ch;
        }

        li::before {
            content: "•";
            position: absolute;
            left: -4px;
            color: #5a8a5a;
        }

        li.has-children {
            cursor: pointer;
        }

        li.has-children::before {
            content: "▼";
            color: #5a8a5a;
        }

        li.has-children:hover::before {
            color: #00c400;
        }

        li.has-children.collapsed::before {
            content: "▶";
        }

        a {
            color: #2d3a2d;
            text-decoration: underline;
        }

        a:hover {
            color: #00c400;
        }

        .muted {
            color: #80a080;
        }

        .aliases {
            font-size: 0.8em;
        }

        ul.collapsed {
            display: none;
        }

        @media (max-width: 768px) {
            body {
                padding: 1rem;
                font-size: 0.9em;
            }

            ul {
                padding-left: 1.5ch;
            }

            li {
                padding-left: 1.5ch;
                margin: 0.5rem 0;
            }

            li::before {
                left: -3px;
            }
        }
    </style>
    <script>
        function toggleNode(li) {
            // Get the parent ul element to understand the nesting level
            const parentUl = li.parentElement;
            const liIndex = Array.from(parentUl.children).indexOf(li);

            // Find all UL elements that are children of this node
            // They will be siblings that come after this li until we hit another li at the same level
            const childUls = [];
            let currentElement = li.nextElementSibling;

            while (currentElement) {
                if (currentElement.tagName === 'LI') {
                    // Found another LI at the same level, stop
                    break;
                }
                if (currentElement.tagName === 'UL') {
                    childUls.push(currentElement);
                }
                currentElement = currentElement.nextElementSibling;
            }

            if (childUls.length > 0) {
                const isCollapsed = li.classList.contains('collapsed');
                if (isCollapsed) {
                    childUls.forEach(ul => ul.classList.remove('collapsed'));
                    li.classList.remove('collapsed');
                } else {
                    childUls.forEach(ul => ul.classList.add('collapsed'));
                    li.classList.add('collapsed');
                }
            }
        }
    </script>
</head>
<body>
    <h1>Taxonomical List of Discovered Plants</h1>
    ${bodyContent}
</body>
</html>`;
}

// Main execution
function main() {
  console.log('Starting HTML generation...');
  console.log(`Input file: ${INPUT_FILE}`);
  console.log(`Output file: ${OUTPUT_FILE}`);
  console.log('');

  // Check if input file exists
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Error: Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  // Check if output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    console.error(`Error: Output directory not found: ${outputDir}`);
    console.log('Please create the directory first or update OUTPUT_FILE path.');
    process.exit(1);
  }

  // Convert markdown to HTML
  const bodyContent = convertMarkdownToHTML(INPUT_FILE);

  // Generate complete HTML document
  const htmlDocument = generateHTMLDocument(bodyContent);

  // Write to file
  fs.writeFileSync(OUTPUT_FILE, htmlDocument);

  console.log(`\nSuccessfully generated: ${OUTPUT_FILE}`);
  console.log(`Total Wikipedia links found: ${Array.from(wikipediaCache.values()).filter(v => v !== null).length}`);
  console.log(`Total items without Wikipedia links: ${Array.from(wikipediaCache.values()).filter(v => v === null).length}`);
}

// Run the script
try {
  main();
} catch (error) {
  console.error('Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
