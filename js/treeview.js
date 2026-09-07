/* =====================================================================
   JSON Formatter Pro — treeview.js
   A collapsible tree-view inspector for parsed JSON values.

   Design goals for large documents:
   - Nothing is built eagerly except the root row. A container's children
     are only turned into DOM nodes the first time it is expanded.
   - Containers with many children are rendered in chunks (CHUNK items at
     a time) behind a "Show N more" control, so a 50,000-element array
     never creates 50,000 DOM nodes unless the user keeps clicking.
   - All interaction is handled through two delegated listeners (click,
     keydown) on the root container instead of one listener per row.

   Exposes window.TreeView = { render(container, value), reveal(container, path) }
   Depends on window.WUS (toast/copy) and window.JSONPathTool (accessorFor).
   ===================================================================== */
(function () {
  'use strict';

  var CHUNK = 150;

  function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v; // object | string | number | boolean
  }

  function hint(v) {
    var t = typeOf(v);
    if (t === 'object') {
      var n = Object.keys(v).length;
      return 'Object · ' + n + (n === 1 ? ' key' : ' keys');
    }
    if (t === 'array') {
      var m = v.length;
      return 'Array · ' + m + (m === 1 ? ' item' : ' items');
    }
    return t;
  }

  function isContainer(v) { return v !== null && typeof v === 'object'; }

  function valueSpan(v) {
    var t = typeOf(v);
    var span = document.createElement('span');
    if (t === 'string') {
      span.className = 'tv-value tok-string';
      span.textContent = JSON.stringify(v);
    } else if (t === 'number') {
      span.className = 'tv-value tok-number';
      span.textContent = String(v);
    } else if (t === 'boolean') {
      span.className = 'tv-value tok-boolean';
      span.textContent = String(v);
    } else if (t === 'null') {
      span.className = 'tv-value tok-null';
      span.textContent = 'null';
    }
    span.tabIndex = 0;
    span.setAttribute('role', 'button');
    span.title = 'Click to copy value';
    span._copyValue = (t === 'string') ? v : String(v);
    return span;
  }

  /* Build one `.tv-node` row for a value at `path`, with an (initially
     empty, unbuilt) `.tv-children` container if it's an object/array. */
  function createNode(path, keyLabel, value, isRootWildcard) {
    var node = document.createElement('div');
    node.className = 'tv-node';

    var row = document.createElement('div');
    row.className = 'tv-row';

    var container = isContainer(value);
    node.dataset.path = path;

    if (container) {
      // The whole row toggles expand/collapse, so the row itself is the
      // tab stop. Leaf rows have no row-level action — their value span
      // (below) is the real interactive element and carries its own
      // tabIndex, so the row is left out of tab order to avoid a dead stop.
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      var toggle = document.createElement('span');
      toggle.className = 'tv-toggle';
      toggle.setAttribute('aria-hidden', 'true');
      toggle.textContent = '▸'; // ▸
      row.appendChild(toggle);
      row.setAttribute('aria-expanded', 'false');
      node.dataset.container = '1';
    } else {
      var spacer = document.createElement('span');
      spacer.className = 'tv-toggle tv-toggle--leaf';
      row.appendChild(spacer);
    }

    if (keyLabel != null) {
      var keyEl = document.createElement('span');
      keyEl.className = 'tv-key';
      keyEl.textContent = keyLabel + ':';
      row.appendChild(keyEl);
    }

    if (container) {
      var hintEl = document.createElement('span');
      hintEl.className = 'tv-hint';
      hintEl.textContent = hint(value);
      row.appendChild(hintEl);
    } else {
      row.appendChild(valueSpan(value));
    }

    node.appendChild(row);
    node._value = value;
    node._row = row;

    if (container) {
      var childrenEl = document.createElement('div');
      childrenEl.className = 'tv-children';
      childrenEl.hidden = true;
      childrenEl._built = false;
      childrenEl._entries = null;
      childrenEl._rowEls = [];
      childrenEl._renderedCount = 0;
      childrenEl._moreBtn = null;
      childrenEl._parentPath = path;
      node.appendChild(childrenEl);
      node._children = childrenEl;
    }

    return node;
  }

  function computeEntries(value) {
    var entries = [];
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) {
        entries.push({ label: String(i), childPath: window.JSONPathTool.formatIndex(i), value: value[i] });
      }
    } else {
      var keys = Object.keys(value);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        entries.push({ label: JSON.stringify(key), childPath: window.JSONPathTool.accessorFor(key), value: value[key] });
      }
    }
    return entries;
  }

  /* Append DOM rows for entries[renderedCount .. targetCount), updating
     the trailing "Show N more" control as needed. */
  function ensureRendered(childrenEl, targetCount) {
    var entries = childrenEl._entries;
    var total = entries.length;
    var upto = Math.min(targetCount, total);

    if (childrenEl._moreBtn) {
      childrenEl.removeChild(childrenEl._moreBtn);
      childrenEl._moreBtn = null;
    }

    for (var i = childrenEl._renderedCount; i < upto; i++) {
      var e = entries[i];
      var childNode = createNode(childrenEl._parentPath + e.childPath, e.label, e.value);
      childrenEl.appendChild(childNode);
      childrenEl._rowEls.push(childNode);
    }
    childrenEl._renderedCount = upto;

    if (childrenEl._renderedCount < total) {
      var remaining = total - childrenEl._renderedCount;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tv-more';
      btn.textContent = 'Show ' + Math.min(CHUNK, remaining) + ' more of ' + remaining + ' remaining…';
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        ensureRendered(childrenEl, childrenEl._renderedCount + CHUNK);
      });
      childrenEl.appendChild(btn);
      childrenEl._moreBtn = btn;
    }
  }

  function expandNode(node) {
    var row = node._row;
    var childrenEl = node._children;
    if (!childrenEl) return;
    if (!childrenEl._entries) {
      childrenEl._entries = computeEntries(node._value);
      ensureRendered(childrenEl, CHUNK);
    }
    childrenEl.hidden = false;
    row.setAttribute('aria-expanded', 'true');
    row.querySelector('.tv-toggle').textContent = '▾'; // ▾
  }

  function collapseNode(node) {
    var row = node._row;
    var childrenEl = node._children;
    if (!childrenEl) return;
    childrenEl.hidden = true;
    row.setAttribute('aria-expanded', 'false');
    row.querySelector('.tv-toggle').textContent = '▸'; // ▸
  }

  function toggleNode(node) {
    if (!node._children) return;
    if (node._children.hidden) expandNode(node); else collapseNode(node);
  }

  function copyLeaf(span) {
    if (span._copyValue === undefined) return;
    window.WUS.copy(span._copyValue, 'Value copied to clipboard');
  }

  function nodeFromEventTarget(root, target) {
    var row = target.closest ? target.closest('.tv-row') : null;
    if (!row || !root.contains(row)) return null;
    return row.parentElement; // .tv-node
  }

  function render(container, rootValue) {
    container.innerHTML = '';
    if (!container._wired) {
      container.addEventListener('click', function (ev) {
        var valueSpanEl = ev.target.closest && ev.target.closest('.tv-value');
        if (valueSpanEl && container.contains(valueSpanEl)) {
          copyLeaf(valueSpanEl);
          return;
        }
        var node = nodeFromEventTarget(container, ev.target);
        if (node && node.dataset.container) toggleNode(node);
      });
      container.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        if (ev.target.classList && ev.target.classList.contains('tv-value')) {
          ev.preventDefault();
          copyLeaf(ev.target);
          return;
        }
        var node = nodeFromEventTarget(container, ev.target);
        if (node && node.dataset.container) {
          ev.preventDefault();
          toggleNode(node);
        }
      });
      container._wired = true;
    }

    var root = createNode('$', null, rootValue);
    container.appendChild(root);
    if (root.dataset.container) expandNode(root);
    container._root = root;
  }

  /* Parse a canonical path string ("$.a['b-c'][0]") produced by
     JSONPathTool back into a sequence of { key } / { index } steps. */
  function parsePathSegments(path) {
    var body = String(path).slice(1); // drop leading $
    var re = /\.[A-Za-z_$][A-Za-z0-9_$]*|\['(?:[^'\\]|\\.)*'\]|\[\d+\]/g;
    var segs = [];
    var m;
    while ((m = re.exec(body)) !== null) {
      var tok = m[0];
      if (tok.charAt(0) === '.') {
        segs.push({ key: tok.slice(1) });
      } else if (/^\[\d+\]$/.test(tok)) {
        segs.push({ index: Number(tok.slice(1, -1)) });
      } else {
        var raw = tok.slice(2, -2).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
        segs.push({ key: raw });
      }
    }
    return segs;
  }

  /* Expand + build ancestors as needed so the node at `path` exists in
     the DOM, then return its .tv-row element (or null if not found —
     e.g. the tree hasn't been rendered, or the path doesn't resolve). */
  function reveal(container, path) {
    var root = container._root;
    if (!root) return null;
    if (path === '$') { expandNode(root); return root._row; }

    var segs = parsePathSegments(path);
    var current = root;
    for (var s = 0; s < segs.length; s++) {
      if (!current.dataset.container) return null;
      expandNode(current);
      var childrenEl = current._children;
      var seg = segs[s];
      var idx = -1;
      if (seg.key !== undefined) {
        var wantAccessor = window.JSONPathTool.accessorFor(seg.key);
        for (var i = 0; i < childrenEl._entries.length; i++) {
          if (childrenEl._entries[i].childPath === wantAccessor) { idx = i; break; }
        }
      } else {
        var wantIdx = window.JSONPathTool.formatIndex(seg.index);
        for (var j = 0; j < childrenEl._entries.length; j++) {
          if (childrenEl._entries[j].childPath === wantIdx) { idx = j; break; }
        }
      }
      if (idx === -1) return null;
      if (idx >= childrenEl._renderedCount) ensureRendered(childrenEl, idx + 1);
      current = childrenEl._rowEls[idx];
    }
    return current._row;
  }

  window.TreeView = { render: render, reveal: reveal };
})();
