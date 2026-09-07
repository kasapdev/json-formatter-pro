/* =====================================================================
   JSON Formatter Pro — convert.js
   Hand-rolled, zero-dependency JSON <-> YAML and JSON <-> CSV converters.

   ---------------------------------------------------------------------
   YAML subset supported:
     - Block mappings (`key: value`, nested by indentation)
     - Block sequences (`- value`, nested by indentation, including
       `- key: value` inline-mapping list items)
     - Flow collections: `[1, 2, 3]` and `{a: 1, b: 2}` (may nest)
     - Scalars: plain, single-quoted ('it''s'), double-quoted (JSON-
       compatible escapes), integers, floats, true/false, null/~
     - `#` comments (outside quotes) and blank lines

   YAML NOT supported (documented in README): anchors/aliases (&,*),
   tags (!!foo), block scalars (| and >), multi-document streams,
   flow-sequence items that are themselves inline dash sequences
   ("- - 1"), and tab-based indentation (YAML itself disallows tabs
   for indentation).
   ---------------------------------------------------------------------
   CSV: JSON -> CSV requires a flat array of objects (each element a
   JSON object, not itself an array). The column set is the union of
   every object's own keys, in first-seen order. A value that is itself
   an object/array is stored as its compact JSON.stringify() text in
   the cell (documented). CSV -> JSON always produces an array of
   objects; every cell is read back as a plain string, UNLESS it is
   valid strict JSON (a quoted string, number, true/false/null, or a
   JSON object/array), which is unwrapped — restoring what JSON -> CSV
   wrote, including the JSON.stringify() text used for nested cells.
   ===================================================================== */
(function () {
  'use strict';

  /* ================================================================
     Shared helpers
     ================================================================ */
  function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  /* ================================================================
     JSON -> YAML
     ================================================================ */
  function needsQuote(s) {
    if (s === '') return true;
    if (/^\s|\s$/.test(s)) return true;
    if (/[\n\t]/.test(s)) return true;
    if (/^(true|false|null|~|yes|no|on|off)$/i.test(s)) return true;
    if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return true; // numeric-looking
    if (/^[-?:,\[\]{}#&*!|>'"%@`]/.test(s)) return true; // leading indicator char
    if (/:(\s|$)/.test(s)) return true; // contains a mapping-like ": " or trailing ":"
    if (/\s#/.test(s)) return true; // looks like it contains a comment marker
    if (s.indexOf('\\') !== -1) return true;
    return false;
  }

  function scalarToYaml(v) {
    if (v === null || v === undefined) return 'null';
    var t = typeof v;
    if (t === 'boolean' || t === 'number') return String(v);
    return needsQuote(v) ? JSON.stringify(v) : v;
  }

  function pad(level) { return new Array(level * 2 + 1).join(' '); }

  function linesForMapping(obj, indentLevel) {
    var keys = Object.keys(obj);
    var lines = [];
    keys.forEach(function (k) {
      var v = obj[k];
      var keyStr = needsQuote(k) ? JSON.stringify(k) : k;
      if (isPlainObject(v)) {
        if (!Object.keys(v).length) { lines.push(pad(indentLevel) + keyStr + ': {}'); }
        else { lines.push(pad(indentLevel) + keyStr + ':'); lines = lines.concat(linesForMapping(v, indentLevel + 1)); }
      } else if (Array.isArray(v)) {
        if (!v.length) { lines.push(pad(indentLevel) + keyStr + ': []'); }
        else { lines.push(pad(indentLevel) + keyStr + ':'); lines = lines.concat(linesForSequence(v, indentLevel + 1)); }
      } else {
        lines.push(pad(indentLevel) + keyStr + ': ' + scalarToYaml(v));
      }
    });
    return lines;
  }

  function linesForSequence(arr, indentLevel) {
    var lines = [];
    arr.forEach(function (item) {
      if (isPlainObject(item)) {
        if (!Object.keys(item).length) { lines.push(pad(indentLevel) + '- {}'); return; }
        var subLines = linesForMapping(item, indentLevel + 1);
        var firstIndent = pad(indentLevel + 1);
        var first = subLines[0].indexOf(firstIndent) === 0 ? subLines[0].slice(firstIndent.length) : subLines[0];
        lines.push(pad(indentLevel) + '- ' + first);
        for (var i = 1; i < subLines.length; i++) lines.push(subLines[i]);
      } else if (Array.isArray(item)) {
        if (!item.length) { lines.push(pad(indentLevel) + '- []'); return; }
        lines.push(pad(indentLevel) + '-');
        lines = lines.concat(linesForSequence(item, indentLevel + 1));
      } else {
        lines.push(pad(indentLevel) + '- ' + scalarToYaml(item));
      }
    });
    return lines;
  }

  function jsonToYaml(value) {
    if (isPlainObject(value)) {
      if (!Object.keys(value).length) return '{}\n';
      return linesForMapping(value, 0).join('\n') + '\n';
    }
    if (Array.isArray(value)) {
      if (!value.length) return '[]\n';
      return linesForSequence(value, 0).join('\n') + '\n';
    }
    return scalarToYaml(value) + '\n';
  }

  /* ================================================================
     YAML -> JSON
     ================================================================ */
  function stripComment(line) {
    var inSingle = false, inDouble = false;
    for (var i = 0; i < line.length; i++) {
      var c = line.charAt(i);
      if (c === "'" && !inDouble) { inSingle = !inSingle; }
      else if (c === '"' && !inSingle) {
        if (!(inDouble && line.charAt(i - 1) === '\\')) inDouble = !inDouble;
      } else if (c === '#' && !inSingle && !inDouble) {
        if (i === 0 || /\s/.test(line.charAt(i - 1))) return line.slice(0, i);
      }
    }
    return line;
  }

  function splitTopLevel(s) {
    var parts = [], depth = 0, inSingle = false, inDouble = false, start = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '"' && !inSingle) { if (!(inDouble && s.charAt(i - 1) === '\\')) inDouble = !inDouble; }
      else if (!inSingle && !inDouble) {
        if (c === '[' || c === '{') depth++;
        else if (c === ']' || c === '}') depth--;
        else if (c === ',' && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
      }
    }
    var last = s.slice(start);
    if (last.trim() !== '' || parts.length) parts.push(last);
    return parts;
  }

  /* First unquoted top-level ":" followed by whitespace-or-end splits a
     mapping line into { key, rest }. Returns null if the line isn't a
     mapping entry. */
  function splitKeyValue(text) {
    var inSingle = false, inDouble = false;
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '"' && !inSingle) { if (!(inDouble && text.charAt(i - 1) === '\\')) inDouble = !inDouble; }
      else if (c === ':' && !inSingle && !inDouble) {
        var after = text.slice(i + 1);
        if (after === '' || /^\s/.test(after)) return { key: text.slice(0, i).trim(), rest: after.trim() };
      }
    }
    return null;
  }

  function parseSingleQuoted(s) {
    if (s.length < 2 || s.charAt(0) !== "'" || s.charAt(s.length - 1) !== "'") {
      throw new Error("Unterminated single-quoted scalar: " + s);
    }
    return s.slice(1, -1).replace(/''/g, "'");
  }

  function parseDoubleQuoted(s) {
    try { return JSON.parse(s); }
    catch (e) { throw new Error('Malformed double-quoted scalar: ' + s); }
  }

  function unquoteKey(key) {
    if (key.charAt(0) === "'") return parseSingleQuoted(key);
    if (key.charAt(0) === '"') return parseDoubleQuoted(key);
    return key;
  }

  function parseFlowScalarOrCollection(s) {
    s = s.trim();
    if (s.charAt(0) === '[') return parseFlowSequence(s);
    if (s.charAt(0) === '{') return parseFlowMapping(s);
    return parseScalar(s);
  }

  function parseFlowSequence(s) {
    s = s.trim();
    if (s.charAt(0) !== '[' || s.charAt(s.length - 1) !== ']') throw new Error('Malformed flow sequence: ' + s);
    var inner = s.slice(1, -1).trim();
    if (inner === '') return [];
    return splitTopLevel(inner).map(function (p) { return parseFlowScalarOrCollection(p.trim()); });
  }

  function parseFlowMapping(s) {
    s = s.trim();
    if (s.charAt(0) !== '{' || s.charAt(s.length - 1) !== '}') throw new Error('Malformed flow mapping: ' + s);
    var inner = s.slice(1, -1).trim();
    var obj = {};
    if (inner === '') return obj;
    splitTopLevel(inner).forEach(function (p) {
      var kv = splitKeyValue(p.trim());
      if (!kv) throw new Error('Malformed flow mapping entry: ' + p);
      obj[unquoteKey(kv.key)] = kv.rest === '' ? null : parseFlowScalarOrCollection(kv.rest);
    });
    return obj;
  }

  function parseScalar(s) {
    s = s.trim();
    if (s === '') return null;
    var c0 = s.charAt(0);
    if (c0 === '"') return parseDoubleQuoted(s);
    if (c0 === "'") return parseSingleQuoted(s);
    if (c0 === '[') return parseFlowSequence(s);
    if (c0 === '{') return parseFlowMapping(s);
    if (/^(null|~|Null|NULL)$/.test(s)) return null;
    if (/^(true|True|TRUE)$/.test(s)) return true;
    if (/^(false|False|FALSE)$/.test(s)) return false;
    if (/^[-+]?\d+$/.test(s)) return parseInt(s, 10);
    if (/^[-+]?(\d+\.\d*|\.\d+|\d+)([eE][-+]?\d+)?$/.test(s) && /[.eE]/.test(s)) return parseFloat(s);
    return s; // plain unquoted string, taken verbatim
  }

  function isSeqItem(text) { return text === '-' || (text.charAt(0) === '-' && text.charAt(1) === ' '); }

  function parseBlock(lines, i) {
    var indent = lines[i].indent;
    if (isSeqItem(lines[i].text)) return parseSequence(lines, i, indent);
    if (splitKeyValue(lines[i].text)) return parseMapping(lines, i, indent);
    return { value: parseScalar(lines[i].text), next: i + 1 };
  }

  function parseSequence(lines, i, indent) {
    var arr = [];
    while (i < lines.length && lines[i].indent === indent && isSeqItem(lines[i].text)) {
      var text = lines[i].text;
      var rest = text === '-' ? '' : text.slice(2).trim();
      if (rest === '') {
        if (i + 1 < lines.length && lines[i + 1].indent > indent) {
          var sub = parseBlock(lines, i + 1);
          arr.push(sub.value);
          i = sub.next;
        } else {
          arr.push(null);
          i++;
        }
      } else {
        var kv = splitKeyValue(rest);
        if (kv) {
          var synthIndent = indent + 2;
          var mapLines = [{ indent: synthIndent, text: rest }];
          var k = i + 1;
          while (k < lines.length && lines[k].indent >= synthIndent) { mapLines.push(lines[k]); k++; }
          var subMap = parseMapping(mapLines, 0, synthIndent);
          arr.push(subMap.value);
          i = k;
        } else {
          arr.push(parseScalar(rest));
          i++;
        }
      }
    }
    return { value: arr, next: i };
  }

  function parseMapping(lines, i, indent) {
    var obj = {};
    while (i < lines.length && lines[i].indent === indent) {
      var kv = splitKeyValue(lines[i].text);
      if (!kv) break;
      var key = unquoteKey(kv.key);
      if (kv.rest === '') {
        if (i + 1 < lines.length && lines[i + 1].indent > indent) {
          var sub = parseBlock(lines, i + 1);
          obj[key] = sub.value;
          i = sub.next;
        } else {
          obj[key] = null;
          i++;
        }
      } else {
        obj[key] = parseScalar(kv.rest);
        i++;
      }
    }
    return { value: obj, next: i };
  }

  function yamlToJson(text) {
    var raw = String(text == null ? '' : text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    var lines = [];
    for (var ln = 0; ln < raw.length; ln++) {
      var line = raw[ln];
      var trimmedFull = line.trim();
      if (trimmedFull === '' || trimmedFull === '---' || trimmedFull === '...') continue;
      var stripped = stripComment(line);
      if (stripped.trim() === '') continue;
      var indent = /^[ ]*/.exec(stripped)[0].length;
      var content = stripped.slice(indent).replace(/[ \t]+$/, '');
      if (content === '') continue;
      lines.push({ indent: indent, text: content, lineNo: ln + 1 });
    }
    if (!lines.length) return null;
    if (lines[0].indent !== 0) throw new Error('Line ' + lines[0].lineNo + ': document must not be indented at the top level');
    var result = parseBlock(lines, 0);
    return result.value;
  }

  /* ================================================================
     JSON -> CSV / CSV -> JSON
     ================================================================ */
  function cellToText(v) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return JSON.stringify(v);
    return JSON.stringify(v); // nested object/array -> compact JSON text
  }

  function csvEscape(s) {
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function jsonToCsv(value) {
    if (!Array.isArray(value)) throw new Error('JSON -> CSV requires a top-level array of objects.');
    if (!value.length) return '';
    var columns = [];
    var seen = Object.create(null);
    value.forEach(function (row, i) {
      if (!isPlainObject(row)) throw new Error('JSON -> CSV requires every array element to be an object (element ' + i + ' is not).');
      Object.keys(row).forEach(function (k) { if (!seen[k]) { seen[k] = true; columns.push(k); } });
    });
    var lines = [columns.map(csvEscape).join(',')];
    value.forEach(function (row) {
      lines.push(columns.map(function (col) {
        return csvEscape(cellToText(Object.prototype.hasOwnProperty.call(row, col) ? row[col] : ''));
      }).join(','));
    });
    return lines.join('\r\n') + '\r\n';
  }

  /* RFC-4180-ish CSV row tokenizer: splits `text` into rows of string
     cells, honoring quoted fields (with "" as an escaped quote) and
     both \n and \r\n line endings. */
  function parseCsvRows(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    var n = text.length;
    while (i < n) {
      var c = text.charAt(i);
      if (inQuotes) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++;
    }
    // trailing field/row (file may or may not end with a newline)
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function cellFromText(s) {
    if (s === '') return '';
    var t = s.trim();
    // Only unwrap when the ENTIRE trimmed cell is strict JSON — this
    // restores what jsonToCsv() wrote (numbers, booleans, null, quoted
    // strings, and nested object/array JSON text). Anything else is
    // kept as a plain string, including things that merely start with
    // a brace/bracket but aren't valid JSON.
    if (/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(t) || t === 'true' || t === 'false' || t === 'null' ||
        (t.charAt(0) === '"' && t.charAt(t.length - 1) === '"') ||
        (t.charAt(0) === '{' && t.charAt(t.length - 1) === '}') ||
        (t.charAt(0) === '[' && t.charAt(t.length - 1) === ']')) {
      try { return JSON.parse(t); } catch (e) { /* fall through to plain string */ }
    }
    return s;
  }

  function csvToJson(text) {
    var rows = parseCsvRows(String(text == null ? '' : text));
    // Drop a single fully-blank trailing row caused by a final newline.
    while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
    if (!rows.length) return [];
    var header = rows[0];
    var out = [];
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      var obj = {};
      for (var c = 0; c < header.length; c++) {
        obj[header[c]] = cellFromText(row[c] === undefined ? '' : row[c]);
      }
      out.push(obj);
    }
    return out;
  }

  window.Convert = {
    jsonToYaml: jsonToYaml,
    yamlToJson: yamlToJson,
    jsonToCsv: jsonToCsv,
    csvToJson: csvToJson
  };

  /* ------------------------------- UI -------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    var WUS = window.WUS;
    var panel = document.getElementById('convertPanel');
    var toggleBtn = document.getElementById('btnConvertToggle');
    var closeBtn = document.getElementById('convertClose');
    var direction = document.getElementById('convertDirection');
    var useInputBtn = document.getElementById('btnConvertUseInput');
    var runBtn = document.getElementById('btnConvertRun');
    var source = document.getElementById('convertSource');
    var output = document.getElementById('convertOutput');
    var summary = document.getElementById('convertSummary');
    var copyBtn = document.getElementById('btnConvertCopy');
    var downloadBtn = document.getElementById('btnConvertDownload');
    if (!panel || !toggleBtn) return;

    function ok(msg) { summary.className = 'diff-summary is-same'; summary.textContent = msg; }
    function fail(msg) { summary.className = 'diff-summary is-error'; summary.textContent = msg; }

    function run() {
      var dir = direction.value;
      var src = source.value;
      try {
        var result;
        if (dir === 'json2yaml') result = window.Convert.jsonToYaml(JSON.parse(src));
        else if (dir === 'yaml2json') result = JSON.stringify(window.Convert.yamlToJson(src), null, 2);
        else if (dir === 'json2csv') result = window.Convert.jsonToCsv(JSON.parse(src));
        else result = JSON.stringify(window.Convert.csvToJson(src), null, 2);
        output.value = result;
        ok('Converted ' + source.value.split('\n').length + '-line source → ' + result.split('\n').length + ' lines.');
      } catch (e) {
        output.value = '';
        fail('Conversion failed: ' + e.message);
      }
    }

    function useInput() {
      if (!window.JFP) return;
      source.value = window.JFP.getRaw();
      var dir = direction.value;
      if (dir === 'yaml2json') direction.value = 'json2yaml';
      else if (dir === 'csv2json') direction.value = 'json2csv';
    }

    function openPanel() { panel.hidden = false; toggleBtn.setAttribute('aria-expanded', 'true'); source.focus(); }
    function closePanel() { panel.hidden = true; toggleBtn.setAttribute('aria-expanded', 'false'); }

    toggleBtn.addEventListener('click', function () { if (panel.hidden) openPanel(); else closePanel(); });
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    runBtn.addEventListener('click', run);
    useInputBtn.addEventListener('click', useInput);
    source.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    });
    copyBtn.addEventListener('click', function () {
      if (!output.value) { if (WUS) WUS.toast('Nothing to copy yet', 'error'); return; }
      if (WUS) WUS.copy(output.value, 'Result copied to clipboard');
    });
    downloadBtn.addEventListener('click', function () {
      if (!output.value) { if (WUS) WUS.toast('Nothing to download yet', 'error'); return; }
      var dir = direction.value;
      var ext = dir === 'json2yaml' ? 'yaml' : dir === 'json2csv' ? 'csv' : 'json';
      var mime = ext === 'yaml' ? 'text/yaml;charset=utf-8' : ext === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8';
      var name = 'converted-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.' + ext;
      if (WUS) { WUS.download(name, output.value, mime); WUS.toast('Downloaded ' + name); }
    });
  });
})();
