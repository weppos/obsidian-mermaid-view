# Mermaid View for Obsidian

An Obsidian plugin that treats [Mermaid](https://mermaid.js.org/) files as first-class citizens.

Mermaid View is a type of [view](https://help.obsidian.md/bases/views) you can use to view Mermaid files and render them as interactive diagrams, similar to how Canvas work.

## Features

- **Native file support** - Open `.mermaid` and `.mmd` files directly in Obsidian, just like markdown or canvas files

- **Three view modes** - Toggle between preview, split, and source modes:
  - **Preview**: Full-screen rendered diagram
  - **Split**: Side-by-side editor and live preview
  - **Source**: Full-screen code editor

- **Pan and zoom** - Navigate large diagrams with mouse wheel zoom and click-drag panning. Double-click to reset.

- **CodeMirror editor** - Full-featured editor with line numbers, syntax highlighting, undo/redo, and standard keyboard shortcuts

- **Embed in notes** - Include mermaid diagrams in other notes using standard embed syntax:

  ```
  ![[diagram.mermaid]]
  ```

- **Context menu integration** - Right-click in the file explorer to create a new mermaid file

## Usage

1. Create a new `.mermaid` (or `.mmd`) file or use the "New mermaid" context menu option
2. Write your Mermaid diagram syntax
3. Toggle between modes using the view action button or the command palette

Example diagram:

```
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do something]
    B -->|No| D[Do something else]
    C --> E[End]
    D --> E
```

## Installation

### From Obsidian Community Plugins

1. Open Settings > Community plugins
2. Search for "Mermaid View"
3. Click Install, then Enable

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Create a folder `.obsidian/plugins/mermaid-view/` in your vault
3. Copy the downloaded files into the folder
4. Enable the plugin in Settings > Community plugins

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for details.

## License

[MIT License](LICENSE.txt)
