# Contributing

## Build Commands

```bash
npm install          # Install dependencies
npm run dev          # Development mode with watch
npm run build        # Production build
```

## Testing in Obsidian

1. Build the plugin: `npm run build`
2. Copy `main.js`, `manifest.json`, and `styles.css` to vault's `.obsidian/plugins/mermaid-view/` folder
3. Enable the plugin in Obsidian settings
4. Create a test file `test.mermaid` with content:

   ```
   graph TD
       A[Start] --> B[Process]
       B --> C[End]
   ```

5. Open the file - should render as a fullscreen Mermaid diagram
6. Toggle to source mode (via action button or command) - shows CodeMirror editor

## Questions?

Open an issue for questions, feature discussions, or bug reports.

Thank you for contributing! 🎉
