# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.1] - 2026-09-06

### Fixed

- Fixed a bug where changing the **Indent** or **Sort keys** option while viewing minified output would silently switch the view back to pretty-printed JSON. Settings changes now re-apply whichever mode (Beautify or Minify) last produced the current output, in `js/app.js`.
- Fixed double-encoded UTF-8 text ("mojibake") in `index.html` that rendered as garbled characters (e.g. `â€"`, `Â·`, `âŒ˜`) instead of the intended em dashes, ellipsis, middle dot, and the `⌘` symbol. Affected the page `<title>`, meta description, the input placeholder, the stats-bar placeholders, the footer, and the keyboard-shortcuts modal.
