#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = path.resolve(__dirname, 'plant-data.json');
const OUTPUT_FILE = path.resolve(__dirname, '../../../Projects/github/atlas/public/plants.html');

// Generate HTML list from JSON tree
function generateHTML(taxonomy, level = 0) {
  let html = '';
  const indent = '  '.repeat(level);

  for (let i = 0; i < taxonomy.length; i++) {
    const node = taxonomy[i];
    const hasChildren = node.children.length > 0 || node.otherFiles.length > 0;

    // Determine if next sibling is at same level (for closing ul tags)
    const isLastInLevel = i === taxonomy.length - 1;

    // Generate content for this node
    let content = '';
    if (node.file) {
      // Node has a file - create link or plain text
      const displayName = node.name;
      let aliasText = '';
      if (node.file.aliases && node.file.aliases.length > 0) {
        aliasText = ` <span class="aliases">(${node.file.aliases.join(', ')})</span>`;
      }

      if (node.file.wikipedia) {
        content = `<a href="${node.file.wikipedia}" target="_blank">${displayName}</a>${aliasText}`;
      } else {
        content = displayName + aliasText;
      }
    } else {
      // Node has no file - muted text
      content = `<span class="muted">${node.name}</span>`;
    }

    // Create list item
    if (hasChildren) {
      html += `${indent}<li class="has-children" onclick="toggleNode(this)">${content}</li>\n`;
    } else {
      html += `${indent}<li>${content}</li>\n`;
    }

    // Add other files at this level
    if (node.otherFiles.length > 0) {
      html += `${indent}<ul>\n`;
      for (const file of node.otherFiles) {
        let fileContent = '';
        let aliasText = '';
        if (file.aliases && file.aliases.length > 0) {
          aliasText = ` <span class="aliases">(${file.aliases.join(', ')})</span>`;
        }

        if (file.wikipedia) {
          fileContent = `<a href="${file.wikipedia}" target="_blank">${file.fileName}</a>${aliasText}`;
        } else {
          fileContent = file.fileName + aliasText;
        }

        html += `${indent}  <li>${fileContent}</li>\n`;
      }
      html += `${indent}</ul>\n`;
    }

    // Add children
    if (node.children.length > 0) {
      html += `${indent}<ul>\n`;
      html += generateHTML(node.children, level + 1);
      html += `${indent}</ul>\n`;
    }
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
    <ul>
${bodyContent}    </ul>
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
    console.log('Please run generate-plant-data.js first.');
    process.exit(1);
  }

  // Check if output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    console.error(`Error: Output directory not found: ${outputDir}`);
    console.log('Please create the directory first or update OUTPUT_FILE path.');
    process.exit(1);
  }

  // Read JSON data
  console.log('Reading plant data...');
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

  // Generate HTML
  console.log('Generating HTML...');
  const bodyContent = generateHTML(data.taxonomy);
  const htmlDocument = generateHTMLDocument(bodyContent);

  // Write to file
  fs.writeFileSync(OUTPUT_FILE, htmlDocument);

  console.log(`\nSuccessfully generated: ${OUTPUT_FILE}`);
  console.log(`Total plants catalogued: ${data.totalPlants}`);
}

// Run the script
try {
  main();
} catch (error) {
  console.error('Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
