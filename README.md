# Plant Taxonomy Tree Generator

A Node.js script that scans your Obsidian vault for plant taxonomy tags and generates a hierarchical markdown file showing all plants organized by their taxonomical classification.

## Features

- Automatically finds all files with `life/eukaryota/plantae` tags
- Builds a nested hierarchical tree based on taxonomy levels
- Creates wikilinks for files that exist
- Shows plain text for intermediate taxonomy levels without associated files
- Capitalizes all entries for consistent formatting
- Handles species names correctly (genus capitalized, species lowercase in tags)

## Usage

Run the script from this directory:

```bash
node generate-plant-taxonomy.js
```

Or make it executable and run directly:

```bash
chmod +x generate-plant-taxonomy.js
./generate-plant-taxonomy.js
```

## Output

The script generates `plant taxonomy tree.md` in your vault (`../../Wikihew`) with a nested bullet list showing:
- Each taxonomy level (Life, Eukaryota, Plantae, etc.) as plain text
- Files tagged at each level as wikilinks indented under their taxonomy level
- Both the scaffolding of the tag structure AND the actual plant files in a unified view

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

You can modify these constants at the top of the script:

- `VAULT_PATH`: Path to your Obsidian vault (default: `../../Wikihew`)
- `OUTPUT_FILE`: Where to save the generated markdown (default: `../../Wikihew/plant taxonomy tree.md`)
- `TAG_PREFIX`: The tag prefix to search for (default: `life/eukaryota/plantae`)

The output file includes frontmatter with:
- `created` and `modified` timestamps
- `tags: [lists]` for easy filtering

## How it Works

1. Recursively scans all markdown files in the vault
2. Parses YAML frontmatter to extract tags
3. Filters for tags starting with `life/eukaryota/plantae`
4. Builds a hierarchical tree structure from the tag paths
5. Associates each file with the deepest taxonomy level in its tag
6. Generates a nested markdown list showing:
   - Taxonomy levels as plain text headers
   - Files tagged at each level as indented wikilinks
7. Sorts everything alphabetically for easy navigation
