# JSON Formatter Pro

Beautify, minify, validate and inspect JSON with syntax highlighting — fast, private, and fully offline.

> A premium, zero-dependency JSON workbench. Paste JSON, get instant pretty-printing with token-aware highlighting, pinpoint syntax errors down to the exact line and column, and read live structural stats — all in your browser, with nothing ever leaving your machine.

## Overview

JSON Formatter Pro is part of the **Web Utility Suite**. It runs entirely in the browser with no build step, no frameworks, and no network calls — open `index.html` from disk and it works. The two-pane layout pairs a raw input editor with a highlighted, read-only output view. Invalid JSON surfaces a clear error panel with a code-frame and a `Line, Col` marker, while valid JSON earns a green status badge and a stats bar describing its shape.

## Features

- **Two-pane editor** — raw input on the left, syntax-highlighted output on the right; stacks vertically on mobile.
- **Beautify** with selectable indentation: 2 spaces, 4 spaces, or tabs.
- **Minify** to the most compact valid representation.
- **Validation** with precise error reporting: human-readable message plus `Line, Col` derived from the parser position, and a code-frame pointing at the failure with a caret.
- **Syntax highlighting** — tokenized keys, strings, numbers, booleans, null, braces and punctuation, themed via the shared design tokens. All values are HTML-escaped before rendering.
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

## Keyboard Shortcuts

| Action               | Shortcut                       |
| -------------------- | ------------------------------ |
| Beautify JSON        | <kbd>Ctrl/⌘</kbd> + <kbd>B</kbd> |
| Minify JSON          | <kbd>Ctrl/⌘</kbd> + <kbd>M</kbd> |
| Download as `.json`  | <kbd>Ctrl/⌘</kbd> + <kbd>S</kbd> |
| Beautify (in editor) | <kbd>Ctrl/⌘</kbd> + <kbd>Enter</kbd> |
| Show shortcuts help  | <kbd>?</kbd>                    |
| Close dialog         | <kbd>Esc</kbd>                  |

## Screenshots

> _Screenshots coming soon._

![screenshot](docs/screenshot-1.png)
![screenshot](docs/screenshot-2.png)

## Roadmap

- [ ] JSONPath / key search and filtering within large documents
- [ ] Collapsible tree-view inspector alongside the text output
- [ ] Diff mode to compare two JSON documents side by side
- [ ] JSON ⇄ YAML / CSV conversion
- [ ] Schema validation against a user-supplied JSON Schema

## License

MIT Licensed. Part of the [Web Utility Suite](../index.html).
