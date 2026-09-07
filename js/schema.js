/* =====================================================================
   JSON Formatter Pro — schema.js
   Hand-rolled validator for a Draft-7-ish JSON Schema subset. Full JSON
   Schema is a large spec; this supports the keywords listed below and
   reports every violation with its JSON Pointer path.

   Supported keywords: type (string or array of strings; object, array,
   string, number, integer, boolean, null), required, properties, items
   (a single schema applied to every array element), minLength,
   maxLength, minimum, maximum, enum, pattern (JS regex).

   NOT supported (documented in README): $ref, additionalProperties,
   oneOf/anyOf/allOf/not, tuple-style `items` arrays, format,
   exclusiveMinimum/Maximum, multipleOf, uniqueItems, dependencies.

   Exposes window.SchemaValidator = { validate(value, schema) -> [{ path, message }] }
   ===================================================================== */
(function () {
  'use strict';

  function typeName(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  }

  function typeMatches(value, type) {
    switch (type) {
      case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
      case 'array': return Array.isArray(value);
      case 'string': return typeof value === 'string';
      case 'number': return typeof value === 'number' && isFinite(value);
      case 'integer': return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
      case 'boolean': return typeof value === 'boolean';
      case 'null': return value === null;
      default: return true; // unknown type keyword — don't fail the document over it
    }
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    var ta = typeName(a), tb = typeName(b);
    if (ta !== tb) return false;
    if (ta === 'object') {
      var ka = Object.keys(a), kb = Object.keys(b);
      if (ka.length !== kb.length) return false;
      for (var i = 0; i < ka.length; i++) {
        if (!Object.prototype.hasOwnProperty.call(b, ka[i])) return false;
        if (!deepEqual(a[ka[i]], b[ka[i]])) return false;
      }
      return true;
    }
    if (ta === 'array') {
      if (a.length !== b.length) return false;
      for (var j = 0; j < a.length; j++) if (!deepEqual(a[j], b[j])) return false;
      return true;
    }
    return false;
  }

  function pointerSeg(key) { return String(key).replace(/~/g, '~0').replace(/\//g, '~1'); }
  function displayPath(path) { return path === '' ? '(root)' : path; }

  function validateNode(value, schema, path, errors) {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return;

    if (schema.type !== undefined) {
      var types = Array.isArray(schema.type) ? schema.type : [schema.type];
      var ok = false;
      for (var t = 0; t < types.length; t++) if (typeMatches(value, types[t])) { ok = true; break; }
      if (!ok) {
        errors.push({ path: path, message: displayPath(path) + ': expected ' + types.join(' or ') + ', got ' + typeName(value) });
        return; // type mismatch makes deeper checks unreliable — stop here for this node
      }
    }

    if (schema.enum !== undefined && Array.isArray(schema.enum)) {
      var inEnum = false;
      for (var e = 0; e < schema.enum.length; e++) if (deepEqual(schema.enum[e], value)) { inEnum = true; break; }
      if (!inEnum) {
        errors.push({ path: path, message: displayPath(path) + ': ' + JSON.stringify(value) + ' is not one of the allowed values ' + JSON.stringify(schema.enum) });
      }
    }

    if (typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push({ path: path, message: displayPath(path) + ': string length ' + value.length + ' is less than minLength ' + schema.minLength });
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push({ path: path, message: displayPath(path) + ': string length ' + value.length + ' exceeds maxLength ' + schema.maxLength });
      }
      if (schema.pattern !== undefined) {
        var re = null;
        try { re = new RegExp(schema.pattern); }
        catch (err) { errors.push({ path: path, message: displayPath(path) + ': schema pattern "' + schema.pattern + '" is not a valid regular expression' }); }
        if (re && !re.test(value)) {
          errors.push({ path: path, message: displayPath(path) + ': "' + value + '" does not match pattern ' + schema.pattern });
        }
      }
    }

    if (typeof value === 'number' && isFinite(value)) {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({ path: path, message: displayPath(path) + ': ' + value + ' is less than minimum ' + schema.minimum });
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({ path: path, message: displayPath(path) + ': ' + value + ' exceeds maximum ' + schema.maximum });
      }
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      if (Array.isArray(schema.required)) {
        schema.required.forEach(function (k) {
          if (!Object.prototype.hasOwnProperty.call(value, k)) {
            var childPath = path + '/' + pointerSeg(k);
            errors.push({ path: childPath, message: displayPath(childPath) + ': missing required property' });
          }
        });
      }
      if (schema.properties && typeof schema.properties === 'object') {
        Object.keys(schema.properties).forEach(function (k) {
          if (Object.prototype.hasOwnProperty.call(value, k)) {
            validateNode(value[k], schema.properties[k], path + '/' + pointerSeg(k), errors);
          }
        });
      }
    }

    if (Array.isArray(value) && schema.items) {
      value.forEach(function (item, i) {
        validateNode(item, schema.items, path + '/' + i, errors);
      });
    }
  }

  function validate(value, schema) {
    var errors = [];
    validateNode(value, schema, '', errors);
    return errors;
  }

  window.SchemaValidator = { validate: validate };

  /* ------------------------------- UI -------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    var panel = document.getElementById('schemaPanel');
    var toggleBtn = document.getElementById('btnSchemaToggle');
    var closeBtn = document.getElementById('schemaClose');
    var schemaInput = document.getElementById('schemaInput');
    var runBtn = document.getElementById('btnSchemaRun');
    var summary = document.getElementById('schemaSummary');
    var results = document.getElementById('schemaResults');
    if (!panel || !toggleBtn) return;

    function render(errors) {
      results.innerHTML = '';
      if (!errors.length) {
        summary.className = 'diff-summary is-same';
        summary.textContent = 'Valid — document satisfies the schema.';
        return;
      }
      summary.className = 'diff-summary is-error';
      summary.textContent = errors.length + (errors.length === 1 ? ' violation' : ' violations');
      errors.forEach(function (err) {
        var row = document.createElement('div');
        row.className = 'diff-row diff-changed';
        var badge = document.createElement('span');
        badge.className = 'diff-badge';
        badge.textContent = 'invalid';
        var msg = document.createElement('span');
        msg.className = 'diff-path mono';
        msg.textContent = err.message;
        row.appendChild(badge);
        row.appendChild(msg);
        results.appendChild(row);
      });
    }

    function runValidate() {
      if (!window.JFP) return;
      var raw = window.JFP.getRaw();
      var value;
      try { value = JSON.parse(raw); }
      catch (e) {
        summary.className = 'diff-summary is-error';
        summary.textContent = 'Document is invalid JSON: ' + e.message;
        results.innerHTML = '';
        return;
      }
      var schema;
      try { schema = JSON.parse(schemaInput.value); }
      catch (e) {
        summary.className = 'diff-summary is-error';
        summary.textContent = 'Schema is invalid JSON: ' + e.message;
        results.innerHTML = '';
        return;
      }
      if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
        summary.className = 'diff-summary is-error';
        summary.textContent = 'Schema must be a JSON object.';
        results.innerHTML = '';
        return;
      }
      render(validate(value, schema));
    }

    function openPanel() { panel.hidden = false; toggleBtn.setAttribute('aria-expanded', 'true'); schemaInput.focus(); }
    function closePanel() { panel.hidden = true; toggleBtn.setAttribute('aria-expanded', 'false'); }

    toggleBtn.addEventListener('click', function () { if (panel.hidden) openPanel(); else closePanel(); });
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    runBtn.addEventListener('click', runValidate);
    schemaInput.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runValidate(); }
    });
  });
})();
