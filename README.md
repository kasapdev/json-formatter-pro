# JSON Formatter Pro

[![CI](https://github.com/kasapdev/json-formatter-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/kasapdev/json-formatter-pro/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) ![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-F7DF1E?logo=javascript&logoColor=black)

Beautify, minify, validate and inspect JSON with syntax highlighting, a collapsible tree view, JSONPath search, structural diffing, YAML/CSV conversion, and JSON Schema validation — fast, private, and fully offline.

> A premium, zero-dependency JSON workbench. Paste JSON, get instant pretty-printing with token-aware highlighting, pinpoint syntax errors down to the exact line and column, explore huge documents in a lazy collapsible tree, query them with JSONPath, diff two documents structurally, convert to/from YAML and CSV, and validate against a JSON Schema — all in your browser, with nothing ever leaving your machine.

## Overview

JSON Formatter Pro is part of the **Web Utility Suite**. It runs entirely in the browser with no build step, no frameworks, and no network calls — open `index.html` from disk and it works. The two-pane layout pairs a raw input editor with a highlighted, read-only output view (switchable to a collapsible tree). Invalid JSON surfaces a clear error panel with a code-frame and a `Line, Col` marker, while valid JSON earns a green status badge and a stats bar describing its shape. Every hand-rolled parser/evaluator in this app (JSONPath, YAML, the diff engine, the schema validator) is plain vanilla JavaScript — no libraries, ever.

## Features

- **Two-pane editor** — raw input on the left, syntax-highlighted output on the right; stacks vertically on mobile.
- **Beautify** with selectable indentation: 2 spaces, 4 spaces, or tabs.
- **Minify** to the most compact valid representation.
- **Validation** with precise error reporting: human-readable message plus `Line, Col` derived from the parser position, and a code-frame pointing at the failure with a caret.
- **Syntax highlighting** — tokenized keys, strings, numbers, booleans, null, braces and punctuation, themed via the shared design tokens. All values are HTML-escaped before rendering.
- **Find in output** — a search box above the output pane highlights every case-insensitive match live, with a match counter and <kbd>Enter</kbd> / <kbd>Shift+Enter</kbd> to jump between hits.
- **JSONPath search** — a second search box evaluates a hand-rolled JSONPath *subset* against the parsed document and highlights/scrolls to every match (in either the Text or Tree view), with a `current / total` counter and <kbd>Enter</kbd> / <kbd>Shift+Enter</kbd> (or the ‹ › buttons) to step through them. Supported syntax:
  - `$` — root
  - `.name` — child member access
  - `['name']` / `["name"]` — child member access for keys that aren't valid identifiers
  - `[n]` — array index (negative indices count from the end, e.g. `[-1]`)
  - `[*]` — wildcard: every array element, or every value of an object
  - `..name` — recursive descent: every value at any depth (including the current node) whose own key is `name`

  Not supported: filter expressions (`[?(...)]`), slices (`[0:2]`), unions (`[0,2]`), script expressions, or `@`.
- **Tree view** — an interactive collapsible tree, toggled alongside the Text view. Expand/collapse objects and arrays, see a type/length hint on every container (`Object · 3 keys`, `Array · 12 items`), and click any leaf value to copy it. Nothing is built until it's expanded, and containers with many children render in chunks behind a "Show more" control, so even a multi-megabyte document with thousands of array elements stays responsive instead of freezing the page.
- **Compare (diff mode)** — paste a second document alongside the first and get a real *structural* diff (not a text diff): every added, removed, or changed value, listed with its JSON Pointer path and a color-coded badge. Object key order is completely ignored — two objects with the same keys in a different order are never flagged as changed — while array order is treated as significant, since arrays are ordered.
- **Convert (JSON ⇄ YAML ⇄ CSV)** — hand-written, zero-dependency converters:
  - **JSON → YAML / YAML → JSON** — supports nested block mappings and sequences (including `- key: value` list items), flow collections (`[1, 2, 3]`, `{a: 1, b: 2}`), plain/single-/double-quoted scalars, `#` comments, and `true`/`false`/`null`/`~`/numbers. **Not supported:** anchors & aliases (`&`, `*`), tags (`!!foo`), block scalars (`|`, `>`), multi-document streams, and tab-based indentation (YAML itself disallows tabs).
  - **JSON → CSV** — requires a top-level array of objects; the column set is the union of every object's own keys in first-seen order. A cell whose value is itself an object/array stores its compact `JSON.stringify()` text (documented so it round-trips cleanly).
  - **CSV → JSON** — full RFC-4180-style quoting (quoted fields, `""` as an escaped quote, embedded commas/newlines). A cell is parsed back as JSON when it's strict JSON text (a quoted string, number, `true`/`false`/`null`, or a JSON object/array) — restoring exactly what JSON → CSV wrote — otherwise it's kept as a plain string.
- **Schema validation** — paste a JSON Schema and validate the current document against it. Every violation is listed with the exact JSON Pointer path to the offending value (e.g. `/user/age: expected number, got string`), not just "invalid". Supported keywords (a Draft-7-ish subset): `type` (string or array of types), `required`, `properties`, `items`, `minLength`, `maxLength`, `minimum`, `maximum`, `enum`, `pattern`. Not supported: `$ref`, `additionalProperties`, `oneOf`/`anyOf`/`allOf`/`not`, tuple-style `items` arrays, `format`, `exclusiveMinimum`/`Maximum`, `multipleOf`, `uniqueItems`, `dependencies` — full JSON Schema is a large spec, and this hand-rolled subset covers the keywords people reach for most.
- **Sort keys** toggle — recursively sorts object keys alphabetically (arrays keep their order).
- **Stats bar** — byte size, key count, value count, max nesting depth, and root type.
- **Copy**, **Download `.json`**, and **Upload `.json`** (auto-formats on load).
- **Load sample** — a realistic, deeply nested document to explore the tool.
- **Auto-persist** — your last input and settings are saved to `localStorage` and restored on return.
- **Dark & light themes**, fully responsive down to 360px, accessible, and keyboard-driven.

## Installation

No dependencies, no build step.

```bash
git clone https://github.com/your-org/web-utility-suite.git
cd web-utility-suite/json-formatter
```

Then simply open `index.html` in any modern browser (double-click it, or `file://` it). That's it.

## Usage

1. Paste or type JSON into the **Input** pane — or click **Sample** to load an example, or **Upload** a `.json` file.
2. Click **Beautify** (or press <kbd>Ctrl/⌘</kbd>+<kbd>B</kbd>) to pretty-print, or **Minify** (<kbd>Ctrl/⌘</kbd>+<kbd>M</kbd>) to compact.
3. Choose your **Indent** (2 spaces / 4 spaces / tabs) and optionally flip **Sort keys** — output re-formats instantly.
4. If the JSON is invalid, read the error panel: it shows the message, the exact **Line, Col**, and a code-frame caret.
5. **Copy** the result or **Download** it as a `.json` file. The stats bar summarizes size, keys, values, depth, and root type.
6. Use the **Find in output** box to locate a key or value in a large document — matches are highlighted live; press <kbd>Enter</kbd> (or <kbd>Shift+Enter</kbd>) to cycle through them.
7. Use the **JSONPath** box (below Find in output) to query the document structurally, e.g. `$.user.address.city`, `$.items[*].price`, or `$..id` — matches are highlighted and you can step through them with <kbd>Enter</kbd> / the ‹ › buttons, in either the Text or Tree view.
8. Switch to the **Tree** view (next to **Text** in the second toolbar row) to explore the document as a collapsible tree — click any triangle to expand/collapse, or click a leaf value to copy it.
9. Click **Compare** to structurally diff two JSON documents side by side, **Convert** to translate between JSON, YAML and CSV, or **Schema** to validate the current document against a pasted JSON Schema.

## Keyboard Shortcuts

| Action               | Shortcut                       |
| -------------------- | ------------------------------ |
| Beautify JSON        | <kbd>Ctrl/⌘</kbd> + <kbd>B</kbd> |
| Minify JSON          | <kbd>Ctrl/⌘</kbd> + <kbd>M</kbd> |
| Download as `.json`  | <kbd>Ctrl/⌘</kbd> + <kbd>S</kbd> |
| Beautify (in editor) | <kbd>Ctrl/⌘</kbd> + <kbd>Enter</kbd> |
| Next / prev match (Find, JSONPath) | <kbd>Enter</kbd> / <kbd>Shift+Enter</kbd> |
| Run Compare / Convert / Validate (their panels) | <kbd>Ctrl/⌘</kbd> + <kbd>Enter</kbd> |
| Show shortcuts help  | <kbd>?</kbd>                    |
| Close dialog         | <kbd>Esc</kbd>                  |

## Screenshots

> _Screenshots coming soon._

![screenshot](docs/screenshot-1.png)
![screenshot](docs/screenshot-2.png)

## Roadmap

All originally-planned features have shipped: JSONPath search, the tree-view inspector, structural diff, JSON ⇄ YAML/CSV conversion, and JSON Schema validation are all implemented and documented above. No open roadmap items right now — future ideas will be tracked as GitHub issues.

## License

MIT Licensed. Part of the [Web Utility Suite](../index.html).

---

## Part of the kasapdev Tools Suite

One of 45+ zero-dependency vanilla JS tools, all free and open source — [see the full list](https://github.com/kasapdev/kasapdev).
