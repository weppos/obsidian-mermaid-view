# Mermaid View for Obsidian

An Obsidian plugin that treats [Mermaid](https://mermaid.js.org/) files as first-class citizens.

Mermaid View is a type of [view](https://help.obsidian.md/bases/views) you can use to view Mermaid files and render them as interactive diagrams, similar to how Canvas work.

## Features

- **Native file support** - Open `.mermaid` and `.mmd` files directly in Obsidian, just like markdown or canvas files.
- **Three view modes** - Toggle between preview, split, and source modes:
  - **Preview**: Full-screen rendered diagram
  - **Split**: Side-by-side editor and live preview
  - **Source**: Full-screen code editor
- **Pan and zoom** - Navigate large diagrams with mouse wheel zoom and click-drag panning. Double-click to reset.
- **CodeMirror editor** - Full-featured editor with line numbers, syntax highlighting, undo/redo, and standard keyboard shortcuts.
- **Export diagrams** - Save diagrams as SVG or PNG files for use in other applications.
- **Embed in notes** - Include mermaid diagrams in other notes using standard embed syntax:
  ```
  ![[diagram.mermaid]]
  ```
- **Menu integration** - Right-click in the file explorer to create a new Mermaid file, or use the command palette.

### Feature Comparison

Mermaid diagrams can be rendered in three ways within Obsidian. This plugin enhances all of them:

| Rendering method | Export PNG/SVG | Pan/Zoom |
|------------------|:--------------:|:--------:|
| ` ```mermaid` ` code block | ✅ | ✅ |
| `![[file.mermaid]]` embed | ✅ | ✅ |
| Standalone `.mermaid` file | ✅ | ✅ |

### Preview Mode

View your diagrams full-screen with pan and zoom support.

![Preview mode](https://simonecarletti.com/uploads/obsidian-mermaid-view/preview-mode.png)

### Split Mode

Edit with a side-by-side code editor and live preview.

![Split mode](https://simonecarletti.com/uploads/obsidian-mermaid-view/split-mode.png)

### Pan and Zoom

Navigate large diagrams with mouse wheel zoom and click-drag panning. Double-click to reset the view.

![Zoom](https://simonecarletti.com/uploads/obsidian-mermaid-view/zoom.png)

### Embed in Notes

Include diagrams in your notes using standard Obsidian embed syntax. The autocomplete suggests mermaid files just like any other note.

![Linking autocomplete](https://simonecarletti.com/uploads/obsidian-mermaid-view/linking-autocomplete.png)

The diagram renders inline within your note.

![Embedded diagram](https://simonecarletti.com/uploads/obsidian-mermaid-view/embed.png)

### Example Diagram

```
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do something]
    B -->|No| D[Do something else]
    C --> E[End]
    D --> E
```

More information on [Mermaid View features and usage](https://simonecarletti.com/projects/obsidian-mermaid-view/).

## Usage

1. Create a new `.mermaid` (or `.mmd`) file or use the "New mermaid" context menu option
2. Write your Mermaid diagram syntax
3. Toggle between modes using the view action button or the command palette

## Installation

Install Mermaid View from the [official Obsidian Community plugins listing](https://community.obsidian.md/plugins/mermaid-view), or use one of the manual methods below.

### From Release

1. Go to the [Releases page](https://github.com/weppos/obsidian-mermaid-view/releases)
2. Download `mermaid-view.zip` from the desired version
3. Unpack the archive
4. Copy the `mermaid-view` folder into your vault's `.obsidian/plugins/` folder (resulting in `.obsidian/plugins/mermaid-view/`)
5. Enable the plugin in Settings > Community plugins

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for details.

## License

[MIT License](LICENSE)
