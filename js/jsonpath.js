/* =====================================================================
   JSON Formatter Pro — jsonpath.js
   A small, hand-rolled JSONPath *subset* evaluator. No external library.

   Supported syntax:
     $                  root
     .name              child member access (identifier: [A-Za-z_$][\w$]*)
     ['name'] / ["name"] child member access (quoted key, any characters)
     [n]                array index (supports negative indices, e.g. [-1])
     [*]                wildcard — every element of an array, or every
                         own-property value of an object
     ..name             recursive descent — every value (at any depth,
                         including the current node) whose own key is
                         `name`

   NOT supported (documented in README): filter expressions ([?(...)]),
   slices ([0:2]), unions ([0,2]), script expressions, `@`.

   Exposes window.JSONPathTool = { evaluate, accessorFor, formatIndex }
   ===================================================================== */
(function () {
  'use strict';

  var IDENT_TOKEN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

  /* Canonical accessor for a key: `.name` for a plain identifier, else a
     quoted bracket form. Shared with treeview.js / app.js so that DOM
     `data-path` attributes and evaluator output use the exact same
     string format and can be matched against each other. */
  function accessorFor(key) {
    key = String(key);
    if (IDENT_TOKEN.test(key)) return '.' + key;
    return "['" + key.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "']";
  }

  function formatIndex(i) { return '[' + i + ']'; }

  var TOKEN_RE = /\$|\.\.[A-Za-z_$][A-Za-z0-9_$]*|\.[A-Za-z_$][A-Za-z0-9_$]*|\[\*\]|\[-?\d+\]|\[(?:'[^']*'|"[^"]*")\]/g;

  function tokenize(expr) {
    var tokens = [];
    var idx = 0;
    var m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(expr)) !== null) {
      if (m.index !== idx) {
        throw new Error('Unexpected character at position ' + idx);
      }
      tokens.push(m[0]);
      idx = TOKEN_RE.lastIndex;
    }
    if (idx !== expr.length) {
      throw new Error('Unexpected character at position ' + idx);
    }
    if (!tokens.length || tokens[0] !== '$') {
      throw new Error('Expression must start with $');
    }
    return tokens;
  }

  /* Recursive descent: find every own-property named `keyname` anywhere
     under `value` (including nested inside a match), collecting matches
     in document order. */
  function collectRecursive(value, path, keyname, out) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) {
        collectRecursive(value[i], path + formatIndex(i), keyname, out);
      }
    } else {
      var keys = Object.keys(value);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var childPath = path + accessorFor(key);
        if (key === keyname) out.push({ value: value[key], path: childPath });
        collectRecursive(value[key], childPath, keyname, out);
      }
    }
  }

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  /* evaluate(root, expr) -> { ok, error, matches: [{ value, path }] } */
  function evaluate(root, expr) {
    expr = (expr == null ? '' : String(expr)).trim();
    if (!expr) return { ok: false, error: 'Empty expression', matches: [] };

    var tokens;
    try {
      tokens = tokenize(expr);
    } catch (e) {
      return { ok: false, error: e.message, matches: [] };
    }

    var contexts = [{ value: root, path: '$' }];

    for (var t = 1; t < tokens.length && contexts.length; t++) {
      var tok = tokens[t];
      var next = [];

      if (tok === '[*]') {
        for (var c1 = 0; c1 < contexts.length; c1++) {
          var v1 = contexts[c1].value, p1 = contexts[c1].path;
          if (Array.isArray(v1)) {
            for (var i1 = 0; i1 < v1.length; i1++) next.push({ value: v1[i1], path: p1 + formatIndex(i1) });
          } else if (isPlainObject(v1)) {
            var ks1 = Object.keys(v1);
            for (var j1 = 0; j1 < ks1.length; j1++) next.push({ value: v1[ks1[j1]], path: p1 + accessorFor(ks1[j1]) });
          }
        }
      } else if (/^\[-?\d+\]$/.test(tok)) {
        var idxNum = Number(tok.slice(1, -1));
        for (var c2 = 0; c2 < contexts.length; c2++) {
          var v2 = contexts[c2].value, p2 = contexts[c2].path;
          if (Array.isArray(v2)) {
            var real = idxNum < 0 ? v2.length + idxNum : idxNum;
            if (real >= 0 && real < v2.length) next.push({ value: v2[real], path: p2 + formatIndex(real) });
          }
        }
      } else if (tok.charAt(0) === '[') {
        // Quoted key: ['name'] or ["name"]
        var key = tok.slice(2, -2);
        for (var c3 = 0; c3 < contexts.length; c3++) {
          var v3 = contexts[c3].value, p3 = contexts[c3].path;
          if (isPlainObject(v3) && Object.prototype.hasOwnProperty.call(v3, key)) {
            next.push({ value: v3[key], path: p3 + accessorFor(key) });
          }
        }
      } else if (tok.slice(0, 2) === '..') {
        var kname = tok.slice(2);
        for (var c4 = 0; c4 < contexts.length; c4++) {
          collectRecursive(contexts[c4].value, contexts[c4].path, kname, next);
        }
      } else if (tok.charAt(0) === '.') {
        var kname2 = tok.slice(1);
        for (var c5 = 0; c5 < contexts.length; c5++) {
          var v5 = contexts[c5].value, p5 = contexts[c5].path;
          if (isPlainObject(v5) && Object.prototype.hasOwnProperty.call(v5, kname2)) {
            next.push({ value: v5[kname2], path: p5 + accessorFor(kname2) });
          }
        }
      } else if (tok === '$') {
        next = contexts; // leading/duplicate root marker — no-op
      }

      contexts = next;
    }

    return { ok: true, error: null, matches: contexts };
  }

  window.JSONPathTool = { evaluate: evaluate, accessorFor: accessorFor, formatIndex: formatIndex };
})();
