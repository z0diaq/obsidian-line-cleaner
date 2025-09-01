# Lines Cleaner - Obsidian Plugin

A powerful Obsidian plugin that removes or cleans lines containing specific markers in file or selection with configurable backup options.

## Usecases

### Templated workflow

1. Create templates with comments explaining the content or purpose of sections.
    - Hint: Use embedded notes to add more complex content.
2. Create new note from template and fill the parts as usual.
3. Use this plugin to remove sections of the note along with the comments making note clean.

### Note postprocessing

1. Create a note with some draft content. Add comments to specify what needs to be done.
2. Update draft content as needed.
3. Use this plugin to remove the comments for finalized sections.

## Features

- **Range-Based Removal**: Remove content between start and end markers while preserving partial line content
- **Comment Cleaning**: Remove %% comments %% from lines containing specific markers
- **Link Cleaning**: Convert Markdown links to backticked text while preserving other formatting
- **Single Line Removal**: Remove entire lines containing specific markers
- **Empty Line Limiting**: Control maximum consecutive empty lines between content
- **Empty List Item Removal**: Remove empty list items like "- ", "- [ ]", "- [x]"
- **Multiple Access Methods**: Ribbon button, context menus, and command palette
- **Configurable Markers**: Customize all removal strings in settings
- **Automatic Backups**: Optional backup creation with timestamp (`filename_HHmmss.ext`)
- **Safe Operations**: Confirmation notices and error handling

## Usage

### Access Methods
1. **Ribbon Button**: Click the trash icon in the left sidebar to clean the current active file
2. **File Context Menu**: Right-click any file in the file explorer and select "Clean lines"
3. **Editor Context Menu**: Right-click in the editor and select "Clean lines"
4. **Command Palette**: Search for "Clean lines from current file"

### Settings
Access plugin settings via Settings → Community Plugins → Lines Cleaner:

**Feature Selection:**
Choose which cleaning features to enable. All features are enabled by default:
- **Enable Range Removal**: Remove content between start and end markers
- **Enable Comment Cleaning**: Remove specific %% comments %% containing markers  
- **Enable Link Cleaning**: Convert links to plain text in backticks
- **Enable Single Line Removal**: Remove entire lines containing markers
- **Enable Empty Line Limiting**: Control consecutive empty lines between content

**Range Removal:**
- **Range Start Marker**: Text marking the beginning of content to remove (default: `%% remove from here %%`)
- **Range End Marker**: Text marking the end of content to remove (default: `%% remove till here %%`)

**Comment Cleaning:**
- **Comment Cleaning Marker**: Only comments containing this marker will be removed (marker must be inside the comment) (default: `remove this comment`)

**Link Cleaning:**
- **Link Cleaning Marker**: Lines containing this string will have their links converted to backticked text (default: `%% clean me %%`)

**Single Line Removal:**
- **Single Line Removal Marker**: Lines containing this exact string will be completely removed (default: `%% remove line %%`)

**Empty Line Limiting:**
- **Keep at most X consecutive empty lines**: Control maximum consecutive empty lines (0-10). 0 = remove all empty lines, 1 = keep at most 1 empty line between content, etc. (default: 1)

**List Item Cleaning:**
- **Remove empty list items**: Remove lines containing only empty list items like "- ", "- [ ]", "- [x]", etc. (default: false)

**Backup Options:**
- **Create Backup**: Toggle automatic backup creation before modifications

### Examples

**Range Removal:**
```
some text %% remove from here %%
line to remove
another line to remove
%% remove till here %% remaining text
```
**Result:**
```
some text remaining text
```

**Comment Cleaning:**
```
This text %% this comment stays %% has comments %% remove this comment %%
Another line %% inline comment %% with %% another comment remove this comment %% text
```
**Result:**
```
This text %% this comment stays %% has comments
Another line %% inline comment %% with text
```

**Link Cleaning:**
```
Check [[My Note]] and [Google](https://google.com) %% clean me %%
```
**Result:**
```
Check `My Note` and `Google`
```

**Single Line Removal:**
```
This line stays
%% remove line %% This entire line is removed
This line also stays
```
**Result:**
```
This line stays
This line also stays
```

**Empty Line Limiting:**
```
First paragraph



Second paragraph


Third paragraph
```
**Result (with "Keep at most 1 consecutive empty line"):**
```
First paragraph

Second paragraph

Third paragraph
```

**Empty List Item Removal:**
```
Task list:
- First task
- 
- [ ]
- [x]
- Second task
- [ ] Third task
```
**Result (with "Remove empty list items" enabled):**
```
Task list:
- First task
- Second task
- [ ] Third task
```

## Installation

### From Obsidian Community Plugins (Recommended)
1. Open Obsidian Settings
2. Go to Community Plugins
3. Search for "Lines Cleaner"
4. Install and enable the plugin

### Manual Installation
1. Download the latest release files (`main.js`, `manifest.json`, `styles.css`)
2. Create folder `VaultFolder/.obsidian/plugins/line-cleaner/`
3. Copy the files to this folder
4. Reload Obsidian and enable the plugin

## Development

### Building
```bash
npm install
npm run build
```

### Development Mode
```bash
npm run dev
```

## License

MIT License - see LICENSE file for details.

## Support

If you find this plugin helpful, consider supporting its development!
