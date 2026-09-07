/* =====================================================================
   JSON Formatter Pro — diff.js
   Structural JSON diff (not a text/line diff): compares two parsed JSON
   documents and reports added / removed / changed values with JSON
   Pointer-ish paths. Object key order never counts as a difference —
   only object shape (which keys exist) and leaf values do. Array order
   is significant (arrays are compared positionally, index by index).

   Exposes window.JSONDiff = { diff(a, b) -> [{ path, type, oldValue, newValue }] }
   and self-wires the Compare panel UI (ids declared in index.html).
   ===================================================================== */
(function () {
  'use strict';

  var JP = window.JSONPathTool;

  function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    var ta = typeOf(a), tb = typeOf(b);
    if (ta !== tb) return false;
    if (ta === 'object') {
      var ka = Object.keys(a), kb = Object.keys(b);
      if (ka.length !== kb.length) return false;
      for (var i = 0; i < ka.length; i++) {
        var k = ka[i];
        if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
        if (!deepEqual(a[k], b[k])) return false;
      }
      return true;
    }
    if (ta === 'array') {
      if (a.length !== b.length) return false;
      for (var j = 0; j < a.length; j++) if (!deepEqual(a[j], b[j])) return false;
      return true;
    }
    return false; // primitives already covered by === above
  }

  function diffValues(a, b, path, out) {
    if (deepEqual(a, b)) return;
    var ta = typeOf(a), tb = typeOf(b);

    if (ta !== tb) {
      out.push({ path: path, type: 'changed', oldValue: a, newValue: b });
      return;
    }

    if (ta === 'object') {
      var keysA = Object.keys(a);
      var keysB = Object.keys(b);
      var seen = Object.create(null);
      for (var i = 0; i < keysA.length; i++) {
        var k = keysA[i];
        seen[k] = true;
        var childPath = path + JP.accessorFor(k);
        if (!Object.prototype.hasOwnProperty.call(b, k)) {
          out.push({ path: childPath, type: 'removed', oldValue: a[k], newValue: undefined });
        } else {
          diffValues(a[k], b[k], childPath, out);
        }
      }
      for (var j = 0; j < keysB.length; j++) {
        var k2 = keysB[j];
        if (!seen[k2]) out.push({ path: path + JP.accessorFor(k2), type: 'added', oldValue: undefined, newValue: b[k2] });
      }
      return;
    }

    if (ta === 'array') {
      var maxLen = Math.max(a.length, b.length);
      for (var idx = 0; idx < maxLen; idx++) {
        var childPath2 = path + JP.formatIndex(idx);
        if (idx >= a.length) out.push({ path: childPath2, type: 'added', oldValue: undefined, newValue: b[idx] });
        else if (idx >= b.length) out.push({ path: childPath2, type: 'removed', oldValue: a[idx], newValue: undefined });
        else diffValues(a[idx], b[idx], childPath2, out);
      }
      return;
    }

    // Primitive values, not equal.
    out.push({ path: path, type: 'changed', oldValue: a, newValue: b });
  }

  function diff(a, b) {
    var out = [];
    diffValues(a, b, '$', out);
    return out;
  }

  window.JSONDiff = { diff: diff };

  /* ------------------------------- UI -------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    var WUS = window.WUS;
    var panel = document.getElementById('diffPanel');
    var toggleBtn = document.getElementById('btnDiffToggle');
    var closeBtn = document.getElementById('diffClose');
    var taA = document.getElementById('diffA');
    var taB = document.getElementById('diffB');
    var runBtn = document.getElementById('btnDiffRun');
    var summary = document.getElementById('diffSummary');
    var results = document.getElementById('diffResults');
    if (!panel || !toggleBtn) return; // markup not present — nothing to wire

    function preview(v) {
      if (v === undefined) return '—';
      var s;
      try { s = JSON.stringify(v); } catch (e) { s = String(v); }
      if (s.length > 240) s = s.slice(0, 240) + '…';
      return s;
    }

    function render(entries) {
      results.innerHTML = '';
      if (!entries.length) {
        summary.textContent = 'Documents are structurally identical (key order ignored).';
        summary.className = 'diff-summary is-same';
        return;
      }
      var added = 0, removed = 0, changed = 0;
      entries.forEach(function (e) {
        if (e.type === 'added') added++;
        else if (e.type === 'removed') removed++;
        else changed++;
      });
      summary.className = 'diff-summary';
      summary.textContent = added + ' added · ' + removed + ' removed · ' + changed + ' changed';

      entries.forEach(function (e) {
        var row = document.createElement('div');
        row.className = 'diff-row diff-' + e.type;

        var badge = document.createElement('span');
        badge.className = 'diff-badge';
        badge.textContent = e.type === 'added' ? '+ added' : e.type === 'removed' ? '− removed' : '~ changed';

        var pathEl = document.createElement('span');
        pathEl.className = 'diff-path mono';
        pathEl.textContent = e.path;

        var valEl = document.createElement('span');
        valEl.className = 'diff-values mono';
        if (e.type === 'added') {
          valEl.textContent = preview(e.newValue);
        } else if (e.type === 'removed') {
          valEl.textContent = preview(e.oldValue);
        } else {
          valEl.textContent = preview(e.oldValue) + '  →  ' + preview(e.newValue);
        }

        row.appendChild(badge);
        row.appendChild(pathEl);
        row.appendChild(valEl);
        results.appendChild(row);
      });
    }

    function runDiff() {
      var a, b;
      try { a = JSON.parse(taA.value); }
      catch (e) { summary.className = 'diff-summary is-error'; summary.textContent = 'Document A is invalid JSON: ' + e.message; results.innerHTML = ''; return; }
      try { b = JSON.parse(taB.value); }
      catch (e) { summary.className = 'diff-summary is-error'; summary.textContent = 'Document B is invalid JSON: ' + e.message; results.innerHTML = ''; return; }
      render(diff(a, b));
    }

    function openPanel() {
      panel.hidden = false;
      if (!taA.value.trim() && window.JFP) {
        var raw = window.JFP.getRaw();
        if (raw && raw.trim()) taA.value = raw;
      }
      toggleBtn.setAttribute('aria-expanded', 'true');
      taA.focus();
    }
    function closePanel() {
      panel.hidden = true;
      toggleBtn.setAttribute('aria-expanded', 'false');
    }

    toggleBtn.addEventListener('click', function () {
      if (panel.hidden) openPanel(); else closePanel();
    });
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    runBtn.addEventListener('click', runDiff);
    if (WUS) {
      // Ctrl/Cmd+Enter inside either diff textarea runs the compare.
      [taA, taB].forEach(function (ta) {
        ta.addEventListener('keydown', function (e) {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runDiff(); }
        });
      });
    }
  });
})();
