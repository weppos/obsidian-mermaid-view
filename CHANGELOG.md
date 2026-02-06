# Changelog

This project uses [Semantic Versioning 2.0.0](http://semver.org/), the format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## Unreleased

### Fixed

- Fix embedded diagram toolbar overlapping Obsidian's copy code button on mermaid code blocks.

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
