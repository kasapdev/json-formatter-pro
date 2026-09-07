# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.0.0] - 2026-09-07

A major feature release — all five roadmap items are implemented, for real, in hand-rolled zero-dependency vanilla JS. See `README.md`'s Features section for full details and documented subsets.

### Added

- **JSONPath search** (`js/jsonpath.js`) — a hand-rolled JSONPath-subset evaluator (`$`, `.name`, `['name']`, `[n]`/`[-n]`, `[*]`, `..name`) with its own search box, match-count indicator, and <kbd>Enter</kbd>/<kbd>Shift+Enter</kbd> (or ‹ ›) next/prev navigation. Matches are highlighted and scrolled to in both the Text and Tree views.
- **Tree view** (`js/treeview.js`) — a new collapsible tree-view inspector alongside the existing Text output, toggled via a Text/Tree segmented control. Expand/collapse objects and arrays, see type/length hints, click a leaf to copy its value. Children are built lazily on first expand and rendered in chunks behind a "Show more" control, so multi-megabyte documents with thousands of elements stay responsive instead of freezing the page.
- **Compare (structural diff)** (`js/diff.js`) — a side-by-side two-document compare panel with a real structural diff engine (not a text diff): added/removed/changed values listed by JSON Pointer path, color-coded. Object key order is ignored; array order is significant.
- **Convert: JSON ⇄ YAML ⇄ CSV** (`js/convert.js`) — hand-written bidirectional converters. JSON ⇄ YAML supports nested block mappings/sequences, flow collections, quoted/unquoted scalars, and comments (documents the unsupported anchors/aliases/tags/block-scalars). JSON → CSV handles a flat array of objects with a documented nested-value strategy (compact JSON text per cell); CSV → JSON is a full RFC-4180-style parser that restores typed values written by JSON → CSV.
- **Schema validation** (`js/schema.js`) — paste a JSON Schema (Draft-7-ish subset: `type`, `required`, `properties`, `items`, `minLength`, `maxLength`, `minimum`, `maximum`, `enum`, `pattern`) and validate the current document against it, with every violation reported as a specific message plus its JSON Pointer path (e.g. `/user/age: expected number, got string`).
- **Find in output** — a search box above the output pane that highlights every case-insensitive match (in keys, strings, numbers, booleans and null) directly in the syntax-highlighted view, with a `current / total` counter and <kbd>Enter</kbd> / <kbd>Shift+Enter</kbd> to jump between matches.

## [1.0.1] - 2026-09-06

### Fixed

- Fixed a bug where changing the **Indent** or **Sort keys** option while viewing minified output would silently switch the view back to pretty-printed JSON. Settings changes now re-apply whichever mode (Beautify or Minify) last produced the current output, in `js/app.js`.
- Fixed double-encoded UTF-8 text ("mojibake") in `index.html` that rendered as garbled characters (e.g. `â€"`, `Â·`, `âŒ˜`) instead of the intended em dashes, ellipsis, middle dot, and the `⌘` symbol. Affected the page `<title>`, meta description, the input placeholder, the stats-bar placeholders, the footer, and the keyboard-shortcuts modal.
