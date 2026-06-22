/* =====================================================================
   JSON Formatter Pro — app.js
   Beautify / minify / validate / inspect JSON with syntax highlighting.
   Classic script (no modules). Depends on window.WUS (core.js).
   ===================================================================== */
(function () {
  'use strict';

  var WUS = window.WUS;
  var STORE_KEY = 'jsonfmt.state';

  /* ----------------------------- DOM refs ---------------------------- */
  var input        = document.getElementById('input');
  var outputCode   = document.getElementById('outputCode');
  var emptyState   = document.getElementById('emptyState');
  var indentSelect = document.getElementById('indentSelect');
  var sortKeysEl   = document.getElementById('sortKeys');

  var statusBadge  = document.getElementById('statusBadge');
  var statusText   = document.getElementById('statusText');

  var inputStats   = document.getElementById('inputStats');
  var outputStats  = document.getElementById('outputStats');

  var errorPanel   = document.getElementById('errorPanel');
  var errorMsg     = document.getElementById('errorMsg');
  var errorLoc     = document.getElementById('errorLoc');
  var errorContext = document.getElementById('errorContext');

  var statsBar  = document.getElementById('statsBar');
  var statSize  = document.getElementById('statSize');
  var statKeys  = document.getElementById('statKeys');
  var statValues= document.getElementById('statValues');
  var statDepth = document.getElementById('statDepth');
  var statType  = document.getElementById('statType');

  var fileInput = document.getElementById('fileInput');

  /* The most recently produced output string (for copy / download). */
  var lastOutput = '';

  /* =================================================================
     INDENT helpers
     ================================================================= */
  function currentIndent() {
    var v = indentSelect.value;
    if (v === 'tab') return '\t';
    return Number(v) || 2;
  }

  /* =================================================================
     KEY SORTING — recursively sort object keys (arrays keep order)
     ================================================================= */
  function sortKeysDeep(value) {
    if (Array.isArray(value)) {
      return value.map(sortKeysDeep);
    }
    if (value && typeof value === 'object') {
      var out = {};
      Object.keys(value).sort().forEach(function (k) {
        out[k] = sortKeysDeep(value[k]);
      });
      return out;
    }
    return value;
  }

  /* =================================================================
     ERROR LOCATION — derive line:column from a SyntaxError
     ================================================================= */
  function locationFromError(err, text) {
    var pos = -1;

    // V8 / Chromium: "... at position 42 (line 3 column 5)"
    var mLine = /line (\d+) column (\d+)/i.exec(err.message);
    if (mLine) {
      return { line: Number(mLine[1]), column: Number(mLine[2]), pos: parsePos(err.message) };
    }

    pos = parsePos(err.message);

    if (pos < 0) {
      // Firefox: "JSON.parse: ... at line 3 column 5 of the JSON data"
      var mFF = /at line (\d+) column (\d+)/i.exec(err.message);
      if (mFF) return { line: Number(mFF[1]), column: Number(mFF[2]), pos: -1 };
      return null;
    }

    // Scan up to pos to compute line/column (1-based).
    var line = 1, col = 1;
    var limit = Math.min(pos, text.length);
    for (var i = 0; i < limit; i++) {
      if (text.charCodeAt(i) === 10) { line++; col = 1; } // \n
      else { col++; }
    }
    return { line: line, column: col, pos: pos };
  }

  function parsePos(message) {
    var m = /position (\d+)/i.exec(message);
    return m ? Number(m[1]) : -1;
  }

  /* Clean up the raw SyntaxError text for display. */
  function cleanMessage(message) {
    return String(message).replace(/^JSON\.parse:\s*/, '').replace(/^Unexpected/, 'Unexpected');
  }

  /* Build a small code-frame around the failing line. */
  function buildContext(text, loc) {
    if (!loc || !loc.line) return '';
    var lines = text.split('\n');
    var idx = loc.line - 1;
    if (idx < 0 || idx >= lines.length) return '';

    var frag = [];
    var start = Math.max(0, idx - 1);
    var end = Math.min(lines.length - 1, idx + 1);
    var gutter = String(end + 1).length;

    for (var i = start; i <= end; i++) {
      var num = String(i + 1).padStart(gutter, ' ');
      var raw = lines[i].length > 120 ? lines[i].slice(0, 120) + '…' : lines[i];
      var isErr = i === idx;
      var prefix = (isErr ? '▸ ' : '  ') + num + ' │ ';
      frag.push(
        '<span class="' + (isErr ? 'err-line' : 'muted') + '">' +
        WUS.escapeHtml(prefix + raw) + '</span>'
      );
      if (isErr && loc.column) {
        var caretPad = ' '.repeat(prefix.length + Math.max(0, loc.column - 1));
        frag.push('<span class="caret">' + WUS.escapeHtml(caretPad) + '^</span>');
      }
    }
    return frag.join('\n');
  }

  /* =================================================================
     STATS — keys, values, max depth, root type
     ================================================================= */
  function computeStats(value) {
    var keys = 0, values = 0, maxDepth = 0;

    function walk(v, depth) {
      if (depth > maxDepth) maxDepth = depth;
      if (Array.isArray(v)) {
        v.forEach(function (item) { walk(item, depth + 1); });
      } else if (v && typeof v === 'object') {
        Object.keys(v).forEach(function (k) {
          keys++;
          walk(v[k], depth + 1);
        });
      } else {
        values++; // primitive leaf
      }
    }
    walk(value, 0);

    var type;
    if (Array.isArray(value)) type = 'array';
    else if (value === null) type = 'null';
    else type = typeof value; // object / string / number / boolean

    return { keys: keys, values: values, maxDepth: maxDepth, type: type };
  }

  function humanBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function byteLength(str) {
    // Accurate UTF-8 byte length, available offline.
    try { return new Blob([str]).size; }
    catch (e) { return new TextEncoder().encode(str).length; }
  }

  /* =================================================================
     SYNTAX HIGHLIGHTING
     Tokenize a *valid* formatted JSON string into classed spans.
     All text is escaped before insertion (no raw innerHTML of values).
     ================================================================= */
  function highlight(jsonText) {
    // Token regex covers: strings (with key detection via trailing colon),
    // numbers, booleans, null, and structural punctuation.
    var re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\b(null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}\[\],:])/g;

    var out = '';
    var lastIndex = 0;
    var m;

    while ((m = re.exec(jsonText)) !== null) {
      // Emit any plain text (whitespace) between tokens, escaped.
      if (m.index > lastIndex) {
        out += WUS.escapeHtml(jsonText.slice(lastIndex, m.index));
      }
      lastIndex = re.lastIndex;

      if (m[1] !== undefined) {
        // String — key if followed by a colon.
        var isKey = m[2] !== undefined;
        out += '<span class="' + (isKey ? 'tok-key' : 'tok-string') + '">' +
               WUS.escapeHtml(m[1]) + '</span>';
        if (isKey) out += '<span class="tok-punct">' + WUS.escapeHtml(m[2]) + '</span>';
      } else if (m[3] !== undefined) {
        out += '<span class="tok-boolean">' + m[3] + '</span>';
      } else if (m[4] !== undefined) {
        out += '<span class="tok-null">' + m[4] + '</span>';
      } else if (m[5] !== undefined) {
        out += '<span class="tok-number">' + WUS.escapeHtml(m[5]) + '</span>';
      } else if (m[6] !== undefined) {
        var cls = (m[6] === '{' || m[6] === '}' || m[6] === '[' || m[6] === ']') ? 'tok-brace' : 'tok-punct';
        out += '<span class="' + cls + '">' + WUS.escapeHtml(m[6]) + '</span>';
      }
    }
    // Tail.
    if (lastIndex < jsonText.length) {
      out += WUS.escapeHtml(jsonText.slice(lastIndex));
    }
    return out;
  }

  /* =================================================================
     STATUS / UI helpers
     ================================================================= */
  function setStatus(state, text) {
    statusBadge.classList.remove('is-valid', 'is-error');
    if (state === 'valid') statusBadge.classList.add('is-valid');
    else if (state === 'error') statusBadge.classList.add('is-error');
    statusText.textContent = text;
  }

  function showError(err, text) {
    var loc = locationFromError(err, text);
    errorMsg.textContent = cleanMessage(err.message);

    if (loc && loc.line) {
      errorLoc.hidden = false;
      errorLoc.textContent = 'Line ' + loc.line + ', Col ' + loc.column;
      var ctx = buildContext(text, loc);
      if (ctx) { errorContext.hidden = false; errorContext.innerHTML = ctx; }
      else { errorContext.hidden = true; }
    } else {
      errorLoc.hidden = true;
      errorContext.hidden = true;
    }

    errorPanel.hidden = false;
    statsBar.hidden = true;
    setStatus('error', 'Invalid');
  }

  function clearError() {
    errorPanel.hidden = true;
  }

  function renderOutput(jsonText, parsedValue) {
    lastOutput = jsonText;
    outputCode.innerHTML = highlight(jsonText);
    emptyState.classList.add('is-hidden');

    // Output meta + stats.
    var bytes = byteLength(jsonText);
    outputStats.textContent = jsonText.split('\n').length + ' lines · ' + humanBytes(bytes);

    var s = computeStats(parsedValue);
    statSize.textContent  = humanBytes(bytes);
    statKeys.textContent  = s.keys.toLocaleString();
    statValues.textContent= s.values.toLocaleString();
    statDepth.textContent = s.maxDepth;
    statType.textContent  = s.type;
    statsBar.hidden = false;
  }

  function clearOutput() {
    lastOutput = '';
    outputCode.textContent = '';
    emptyState.classList.remove('is-hidden');
    outputStats.textContent = '';
    statsBar.hidden = true;
  }

  function updateInputMeta() {
    var len = input.value.length;
    inputStats.textContent = len.toLocaleString() + (len === 1 ? ' char' : ' chars');
  }

  /* =================================================================
     CORE ACTIONS
     ================================================================= */
  function parseInput() {
    // Returns parsed value or throws (caller handles).
    return JSON.parse(input.value);
  }

  function beautify() {
    var text = input.value.trim();
    if (!text) { WUS.toast('Nothing to format — input is empty', 'error'); return; }
    try {
      var value = parseInput();
      if (sortKeysEl.checked) value = sortKeysDeep(value);
      var pretty = JSON.stringify(value, null, currentIndent());
      clearError();
      renderOutput(pretty, value);
      setStatus('valid', 'Valid JSON');
    } catch (err) {
      showError(err, input.value);
      WUS.toast('Invalid JSON — see error panel', 'error');
    }
    persist();
  }

  function minify() {
    var text = input.value.trim();
    if (!text) { WUS.toast('Nothing to minify — input is empty', 'error'); return; }
    try {
      var value = parseInput();
      if (sortKeysEl.checked) value = sortKeysDeep(value);
      var min = JSON.stringify(value);
      clearError();
      renderOutput(min, value);
      setStatus('valid', 'Minified');
    } catch (err) {
      showError(err, input.value);
      WUS.toast('Invalid JSON — see error panel', 'error');
    }
    persist();
  }

  function validate() {
    var text = input.value.trim();
    if (!text) { WUS.toast('Nothing to validate — input is empty', 'error'); return; }
    try {
      var value = parseInput();
      clearError();
      setStatus('valid', 'Valid JSON');
      // Refresh stats without altering existing output formatting.
      var s = computeStats(value);
      statSize.textContent  = humanBytes(byteLength(input.value));
      statKeys.textContent  = s.keys.toLocaleString();
      statValues.textContent= s.values.toLocaleString();
      statDepth.textContent = s.maxDepth;
      statType.textContent  = s.type;
      statsBar.hidden = false;
      WUS.toast('Valid JSON ✓');
    } catch (err) {
      showError(err, input.value);
      WUS.toast('Invalid JSON — see error panel', 'error');
    }
    persist();
  }

  function copyOutput() {
    if (!lastOutput) { WUS.toast('No output to copy yet', 'error'); return; }
    WUS.copy(lastOutput, 'Output copied to clipboard');
  }

  function downloadOutput() {
    var content = lastOutput;
    if (!content) {
      // Fall back to formatting current input on the fly.
      var text = input.value.trim();
      if (!text) { WUS.toast('Nothing to download', 'error'); return; }
      try {
        var value = parseInput();
        if (sortKeysEl.checked) value = sortKeysDeep(value);
        content = JSON.stringify(value, null, currentIndent());
        renderOutput(content, value);
        clearError();
        setStatus('valid', 'Valid JSON');
      } catch (err) {
        showError(err, input.value);
        WUS.toast('Cannot download invalid JSON', 'error');
        return;
      }
    }
    var name = 'data-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
    WUS.download(name, content, 'application/json;charset=utf-8');
    WUS.toast('Downloaded ' + name);
  }

  function clearAll() {
    input.value = '';
    clearOutput();
    clearError();
    setStatus('', 'Ready');
    updateInputMeta();
    WUS.store.remove(STORE_KEY);
    input.focus();
  }

  /* -------------------------- File upload --------------------------- */
  function triggerUpload() { fileInput.click(); }

  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    WUS.readFile(file).then(function (content) {
      input.value = content;
      updateInputMeta();
      WUS.toast('Loaded ' + file.name);
      beautify(); // auto-format on load
    }).catch(function () {
      WUS.toast('Could not read file', 'error');
    });
    fileInput.value = ''; // allow re-uploading the same file
  });

  /* ----------------------------- Sample ----------------------------- */
  var SAMPLE = {
    id: 'usr_8f2a91c4',
    name: 'Ada Lovelace',
    active: true,
    roles: ['admin', 'engineer'],
    profile: {
      title: 'Lead Systems Architect',
      joined: '2021-03-14T09:30:00Z',
      contact: { email: 'ada@analytical.engine', phone: null },
      preferences: { theme: 'dark', notifications: { email: true, sms: false }, density: 'comfortable' }
    },
    projects: [
      { name: 'Analytical Engine', status: 'archived', commits: 1843, tags: ['compute', 'historic'] },
      { name: 'Bernoulli Runner', status: 'active', commits: 92, budget: 14500.5, public: false }
    ],
    metrics: { uptime: 99.982, requests: 1284930, errorRate: 0.0007 },
    notes: 'Supports nested objects, arrays, numbers, booleans & null.'
  };

  function loadSample() {
    input.value = JSON.stringify(SAMPLE, null, 2);
    updateInputMeta();
    beautify();
    WUS.toast('Sample loaded');
  }

  /* =================================================================
     PERSISTENCE — debounced save of input + settings, restore on load
     ================================================================= */
  function persist() {
    WUS.store.set(STORE_KEY, {
      input: input.value,
      indent: indentSelect.value,
      sortKeys: sortKeysEl.checked
    });
  }
  var persistDebounced = WUS.debounce(persist, 400);

  function restore() {
    var saved = WUS.store.get(STORE_KEY, null);
    if (!saved) return;
    if (typeof saved.input === 'string') input.value = saved.input;
    if (saved.indent) indentSelect.value = saved.indent;
    sortKeysEl.checked = !!saved.sortKeys;
    updateInputMeta();
    // Try to render previously valid input silently.
    if (input.value.trim()) {
      try {
        var value = JSON.parse(input.value);
        if (sortKeysEl.checked) value = sortKeysDeep(value);
        renderOutput(JSON.stringify(value, null, currentIndent()), value);
        setStatus('valid', 'Valid JSON');
      } catch (e) { /* leave output empty; user can act */ }
    }
  }

  /* =================================================================
     SHORTCUTS HELP MODAL
     ================================================================= */
  var helpBackdrop = document.getElementById('helpBackdrop');
  var helpClose    = document.getElementById('helpClose');
  var shortcutRows = document.getElementById('shortcutRows');

  var SHORTCUTS = [
    { keys: ['mod', 'B'], desc: 'Beautify JSON' },
    { keys: ['mod', 'M'], desc: 'Minify JSON' },
    { keys: ['mod', 'S'], desc: 'Download as .json' },
    { keys: ['mod', '⏎'], desc: 'Beautify (Enter)' },
    { keys: ['?'], desc: 'Show this help' },
    { keys: ['Esc'], desc: 'Close dialog' }
  ];

  function buildShortcutTable() {
    var html = '';
    SHORTCUTS.forEach(function (s) {
      var kbds = s.keys.map(function (k) { return '<kbd>' + WUS.escapeHtml(k) + '</kbd>'; }).join('');
      html += '<tr><td>' + WUS.escapeHtml(s.desc) + '</td><td>' + kbds + '</td></tr>';
    });
    shortcutRows.innerHTML = html;
  }

  function openHelp() { helpBackdrop.hidden = false; helpClose.focus(); }
  function closeHelp() { helpBackdrop.hidden = true; }

  helpClose.addEventListener('click', closeHelp);
  helpBackdrop.addEventListener('click', function (e) {
    if (e.target === helpBackdrop) closeHelp();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !helpBackdrop.hidden) closeHelp();
  });

  // Header shortcut-help button(s).
  var helpBtns = document.querySelectorAll('[data-shortcut-help]');
  for (var i = 0; i < helpBtns.length; i++) helpBtns[i].addEventListener('click', openHelp);

  /* =================================================================
     WIRING
     ================================================================= */
  document.getElementById('btnBeautify').addEventListener('click', beautify);
  document.getElementById('btnMinify').addEventListener('click', minify);
  document.getElementById('btnValidate').addEventListener('click', validate);
  document.getElementById('btnCopy').addEventListener('click', copyOutput);
  document.getElementById('btnDownload').addEventListener('click', downloadOutput);
  document.getElementById('btnUpload').addEventListener('click', triggerUpload);
  document.getElementById('btnSample').addEventListener('click', loadSample);
  document.getElementById('btnClear').addEventListener('click', clearAll);
  document.getElementById('btnSampleEmpty').addEventListener('click', loadSample);

  input.addEventListener('input', function () {
    updateInputMeta();
    persistDebounced();
  });

  // Re-format live when settings change (only if there is valid output).
  indentSelect.addEventListener('change', function () {
    persist();
    if (lastOutput && input.value.trim()) beautify();
  });
  sortKeysEl.addEventListener('change', function () {
    persist();
    if (lastOutput && input.value.trim()) beautify();
  });

  // Ctrl/Cmd+Enter inside the textarea = beautify.
  input.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      beautify();
    }
  });

  /* Global keyboard shortcuts via WUS. */
  WUS.registerShortcut('mod+b', function () { beautify(); }, 'Beautify JSON');
  WUS.registerShortcut('mod+m', function () { minify(); }, 'Minify JSON');
  WUS.registerShortcut('mod+s', function () { downloadOutput(); }, 'Download .json');
  WUS.registerShortcut('?', function () { openHelp(); }, 'Show shortcuts');

  /* =================================================================
     INIT
     ================================================================= */
  buildShortcutTable();
  updateInputMeta();
  restore();
})();
