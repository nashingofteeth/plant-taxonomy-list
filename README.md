# Plant Taxonomy Tree Generator

A Node.js script that scans your Obsidian vault for plant taxonomy tags and generates a hierarchical markdown file showing all plants organized by their taxonomical classification.

## Features

- Automatically finds all files with `life/eukaryota/plantae` tags
- Builds a nested hierarchical tree based on taxonomy levels
- Creates wikilinks for files that exist
- Shows plain text for intermediate taxonomy levels without associated files
- Capitalizes all entries for consistent formatting
- Handles species names correctly (genus capitalized, species lowercase in tags)
- Generates JSON data file with Wikipedia links for use in other projects

## Usage

### NPM Scripts (Recommended)

```bash
# Generate plant data JSON file
npm run data

# Generate markdown taxonomy tree
npm run markdown

# Full build: generate data, markdown, copy files to atlas and wikihew, and build atlas
npm run build
```

### Individual Scripts

You can also run the scripts directly:

#### Generate Plant Data

```bash
node generate-data.js
```

This script:
- Scans the vault for plant files with `life/eukaryota/plantae` tags
- Extracts Wikipedia links from each plant's note file
- Outputs to `plant-data.json`

#### Generate Markdown Taxonomy Tree

```bash
node generate-markdown.js
```

This script:
- Reads the plant data JSON file
- Builds a nested hierarchical tree structure
- Generates `plant taxonomy tree.md` with wikilinks

## Output

The scripts generate two files:

1. **plant-data.json**: JSON file containing all plant data with Wikipedia links
2. **plant taxonomy tree.md**: Markdown file with a nested bullet list showing:
   - Each taxonomy level (Life, Eukaryota, Plantae, etc.) as plain text
   - Files tagged at each level as wikilinks indented under their taxonomy level
   - Both the scaffolding of the tag structure AND the actual plant files in a unified view

When using `npm run build`, these files are automatically copied to:
- `plant-data.json` → `../atlas/_data/plant-data.json`
- `plant taxonomy tree.md` → `../wikihew/plant taxonomy tree.md`

Example structure:

```markdown
# Plant Taxonomy Tree

- Life
  - Eukaryota
    - Plantae
      - [[bryophyte]]
      - [[vascular plant]]
      - Tracheophytes
        - [[seed plant]]
        - Angiosperms
          - Eudicots
            - Rosids
              - Malvales
                - [[Malvaceae]]
                - Malvaceae
                  - [[Tilia]]
                  - Theobroma
                    - [[Theobroma cacao]]
```

In this structure:
- Genus files (like `Tilia`) are tagged at the family level and appear under their family
- Species files (like `Theobroma cacao`) are tagged at the genus level and appear under their genus
- Family overview files (like `Malvaceae`) are tagged at the order level and appear there

## Configuration

You can modify these constants at the top of each script:

### generate-data.js
- `VAULT_PATH`: Path to your Obsidian vault (default: `../../Wikihew`)
- `TAG_PREFIX`: The tag prefix to search for (default: `life/eukaryota/plantae`)
- `OUTPUT_FILE`: Where to save the JSON data (default: `plant-data.json`)

### generate-markdown.js
- `DATA_FILE`: Path to the plant data JSON (default: `plant-data.json`)
- `OUTPUT_FILE`: Where to save the generated markdown (default: `plant taxonomy tree.md`)

The markdown output file includes frontmatter with:
- `created` and `modified` timestamps
- `tags: [lists]` for easy filtering

## How it Works

### Data Generation (generate-data.js)
1. Recursively scans all markdown files in the vault
2. Parses YAML frontmatter to extract tags and Wikipedia links
3. Filters for tags starting with `life/eukaryota/plantae`
4. Builds a hierarchical tree structure from the tag paths
5. Associates each file with the deepest taxonomy level in its tag
6. Outputs structured JSON data with Wikipedia links

### Markdown Generation (generate-markdown.js)
1. Reads the plant data JSON file
2. Builds a nested hierarchical tree from the data
3. Generates a nested markdown list showing:
   - Taxonomy levels as plain text headers
   - Files tagged at each level as indented wikilinks
4. Sorts everything alphabetically for easy navigation
