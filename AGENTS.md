# Agent Instructions

Instructions for AI coding agents when working on this project.

## Architecture

The plugin uses Obsidian's `TextFileView` class and extension registration system:

1. **Custom view type** (`mermaid-view`) registered via `registerView()`
2. **File extensions** (`.mermaid`, `.mmd`) registered via `registerExtensions()`
3. **TextFileView subclass** with three modes:
   - **Preview mode** (default): Renders Mermaid diagram fullscreen using `MarkdownRenderer.render()`
   - **Split mode**: Source editor and preview side-by-side
   - **Source mode**: CodeMirror editor for editing the Mermaid source

## Design Decisions

1. **Use MarkdownRenderer**: Leverages Obsidian's built-in Mermaid support rather than bundling mermaid.js separately. Keeps the plugin lightweight and consistent with Obsidian's rendering.
2. **TextFileView base**: Provides file handling with `getViewData()`/`setViewData()` and automatic save via `requestSave()`.
3. **CodeMirror for source editing**: Uses CodeMirror 6 (`@codemirror/view`/`state`/`commands`) for syntax-aware editing, history, and keymaps. The editor syncs changes via an update listener and calls `requestSave()`.
4. **Preview by default**: Files open in preview mode showing the rendered diagram. Users can switch to source mode to edit.
5. **Configurable extensions**: Both `.mermaid` and `.mmd` supported by default, configurable in settings.

## API Notes

### MarkdownRenderer.render()

Used to render mermaid content by wrapping it in a code block:

```typescript
const mermaidMarkdown = "```mermaid\n" + content + "\n```";
await MarkdownRenderer.render(this.app, mermaidMarkdown, wrapper, this.file?.path ?? "", this);
```

### View registration

```typescript
this.registerView(VIEW_TYPE_MERMAID, (leaf) => new MermaidView(leaf, this));
this.registerExtensions(this.settings.extensions, VIEW_TYPE_MERMAID);
```
