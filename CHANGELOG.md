# Changelog

This project uses [Semantic Versioning 2.0.0](http://semver.org/), the format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## Unreleased

### Added

- Show the tooltip of a `click` directive when the pointer stays over the node (#72).

### Fixed

- Open the links of `click` directives in diagram types that Obsidian leaves inert, such as gantt (#58).
- Keep a click on a link a click: a pointer movement now has to pass a small threshold before it counts as a pan.

## 0.6.1 - 2026-05-16

### Added

- Generate GitHub artifact attestations (SLSA build provenance) for `main.js`, `styles.css`, and the release zip during the release workflow.

## 0.6.0 - 2026-05-16

### Changed

- Unify toolbar layout across standalone view and embedded diagrams for a consistent experience: zoom and export controls are now grouped separately, matching the Obsidian Canvas toolbar style.
- Update PNG scale labels in settings (e.g. "Standard (1x)") to follow Obsidian's sentence-case UI guidelines.

### Fixed

- Fix embedded diagram toolbar overlapping Obsidian's copy code button on mermaid code blocks.
- Schedule timer and animation callbacks on the window that owns each diagram, fixing embedded diagram behavior in Obsidian pop-out windows and satisfying the Obsidian plugin linter.

## 0.5.0 - 2026-02-05

### Added

- Add export (SVG/PNG) and pan/zoom support to embedded Mermaid diagrams, both in markdown `` ```mermaid `` code blocks and `![[file]]` embeds (#18).

## 0.4.0 - 2026-02-02

### Added

- Add export capability to save diagrams as SVG or PNG files (#17).
- Add zoom indicator showing current zoom percentage when zoomed or panned.
- Add zoom in/out buttons to the view action bar for precise zoom control.

## 0.3.2 - 2026-01-29

### Changed

- Update development dependencies.

## 0.3.1 - 2026-01-29

### Added

- Add touch gesture support for pan and zoom (pinch-to-zoom and single-finger pan for mobile/tablet).

## 0.3.0 - 2026-01-17

### Added

- Add "Create new Mermaid file" command to command palette. This is particularly useful in Mobile mode where the "New Mermaid file" context menu is not very visible.

### Fixed

- Fix Obsidian Publishing review issues.

## 0.2.0 - 2026-01-17

### Fixed

- Fix plugin ID in manifest (use `mermaid-view` instead of `obsidian-mermaid-view`).

## 0.1.0

Initial version.
