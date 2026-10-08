/**
 * Bootstrap Icons search + select picker for "Icon (bi class)" fields.
 *
 * Turns any <input data-icon-picker> into a search field with a live dropdown
 * of icon previews (search + select), backed by the Bootstrap Icons API:
 *   https://bootstrap-icons-api-picker.vercel.app/docs/API.md
 *
 * The original <input> is preserved (same name/value), so forms keep
 * submitting the raw class string, e.g. "bi-droplet-fill". Selecting an
 * option stores icon.className; free typing stays allowed (API failures
 * never block manual entry).
 *
 * Dynamically added rows: call window.ibcInitIconPicker(container)
 * (see views/admin/category/_form.ejs).
 */
(function () {
    'use strict';

    var API_BASE = 'https://bootstrap-icons-api-picker.vercel.app';
    var API_PATH = '/api/icons';
    var LIMIT = 30;              // API clamps limit to 1..200
    var DEBOUNCE_MS = 250;       // pause between keystrokes and API calls
    var TIMEOUT_MS = 8000;       // abort requests that hang
    var results = new Map();     // query -> icon[] (completed responses only)
    var uid = 0;
    var openPicker = null;       // keep a single dropdown open at a time

    // Case-insensitive highlight of the matched substring (docs: `search`
    // matches name / className / category as a substring).
    function highlightInto(container, text, query) {
        container.textContent = '';
        var q = (query || '').trim().toLowerCase();
        var idx = q ? text.toLowerCase().indexOf(q) : -1;
        if (idx < 0) { container.textContent = text; return; }
        if (idx > 0) container.appendChild(document.createTextNode(text.slice(0, idx)));
        var mark = document.createElement('mark');
        mark.textContent = text.slice(idx, idx + q.length);
        container.appendChild(mark);
        if (idx + q.length < text.length) {
            container.appendChild(document.createTextNode(text.slice(idx + q.length)));
        }
    }

    function IconPicker(input) {
        this.input = input;
        this.id = 'ibc-icon-picker-' + (++uid);
        this.icons = [];
        this.active = -1;
        this.isOpen = false;
        this.timer = null;
        this.reqId = 0;
        this.pending = null;     // { q, ctrl, promise, id } in-flight request
        this._suppress = false;  // blocks re-entrant search on programmatic input
        this._build();
        this._bind();
        this._preview(input.value);
        this._syncClear();
    }

    IconPicker.prototype._build = function () {
        var input = this.input;
        var wrap = document.createElement('div');
        wrap.className = 'ibc-icon-picker';
        if (input.classList.contains('form-control-sm')) wrap.classList.add('is-sm');
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);

        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-expanded', 'false');
        input.setAttribute('aria-controls', this.id + '-menu');
        input.setAttribute('autocomplete', 'off');

        // Live preview of the selected / matched icon, inside the field
        this.preview = document.createElement('span');
        this.preview.className = 'ibc-icon-picker-preview is-empty';
        this.preview.setAttribute('aria-hidden', 'true');
        this.glyph = document.createElement('i');
        this.preview.appendChild(this.glyph);
        wrap.appendChild(this.preview);

        this.clearBtn = document.createElement('button');
        this.clearBtn.type = 'button';
        this.clearBtn.className = 'ibc-icon-picker-clear';
        this.clearBtn.setAttribute('aria-label', 'Clear icon');
        this.clearBtn.textContent = '\u00d7';
        this.clearBtn.hidden = true;
        wrap.appendChild(this.clearBtn);

        this.menu = document.createElement('div');
        this.menu.className = 'ibc-icon-picker-menu';
        this.menu.id = this.id + '-menu';
        this.menu.setAttribute('role', 'listbox');
        this.menu.hidden = true;
        wrap.appendChild(this.menu);

        this.wrap = wrap;
    };

    IconPicker.prototype._bind = function () {
        var self = this, input = this.input;

        input.addEventListener('focus', function () { self.open(); });
        input.addEventListener('input', function () {
            if (self._suppress) return;
            self._syncClear();
            if (self.isOpen) self.schedule(); else self.open();
        });
        input.addEventListener('keydown', function (e) { self._onKeydown(e); });

        // Keep keyboard focus in the input while clicking an option
        this.menu.addEventListener('mousedown', function (e) {
            if (e.target.closest && e.target.closest('.ibc-icon-picker-option')) e.preventDefault();
        });

        this.clearBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
        this.clearBtn.addEventListener('click', function () {
            if (!self.input.value) return;
            self.input.value = '';
            self._emit();
            self._syncClear();
            self._preview('');
            self.input.focus();
            if (self.isOpen) self.search(''); else self.open();
        });

        // Close when clicking outside the widget; drop the listener if this
        // row was removed from the DOM (dynamic add/remove rows).
        this._onDocMousedown = function (e) {
            if (!self.input.isConnected) {
                document.removeEventListener('mousedown', self._onDocMousedown);
                return;
            }
            if (self.isOpen && !self.wrap.contains(e.target)) self.close();
        };
        document.addEventListener('mousedown', this._onDocMousedown);
    };

    IconPicker.prototype.open = function () {
        if (this.isOpen) return;
        if (openPicker && openPicker !== this) openPicker.close();
        openPicker = this;
        this.isOpen = true;
        this.menu.hidden = false;
        this.input.setAttribute('aria-expanded', 'true');
        this.search(this.input.value.trim());
    };

    IconPicker.prototype.close = function () {
        clearTimeout(this.timer);
        this.timer = null;
        this.isOpen = false;
        this.menu.hidden = true;
        this.input.setAttribute('aria-expanded', 'false');
        this.input.removeAttribute('aria-activedescendant');
        if (openPicker === this) openPicker = null;
        this._preview(this.input.value);   // back to the committed value
    };

    IconPicker.prototype.schedule = function () {
        var self = this;
        clearTimeout(this.timer);
        this.timer = setTimeout(function () {
            self.search(self.input.value.trim());
        }, DEBOUNCE_MS);
    };

    // GET {API_BASE}/api/icons?search=<q>&limit=<n>   (docs/API.md §1)
    IconPicker.prototype.search = function (q) {
        var self = this, id = ++this.reqId;

        if (this.pending && this.pending.q !== q) {   // supersede older query
            try { this.pending.ctrl.abort(); } catch (e) { /* noop */ }
            this.pending = null;
        }
        if (results.has(q)) { this._render(results.get(q), q); return; }
        if (this.pending && this.pending.q === q) {   // reuse in-flight request
            this.pending.promise.then(
                function (icons) { if (id === self.reqId) self._render(icons, q); },
                function () { if (id === self.reqId) self._fail(); }
            );
            return;
        }

        this._status('Searching icons\u2026', true);
        var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timeout = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);
        var promise = fetch(API_BASE + API_PATH + '?search=' + encodeURIComponent(q) + '&limit=' + LIMIT,
                ctrl ? { signal: ctrl.signal } : {})
            .then(function (res) {
                var type = res.headers.get('content-type') || '';
                // Non-2xx or a non-JSON body (docs: mistyped paths fall through
                // to the SPA and return HTML) is a transport-level failure.
                if (!res.ok || type.indexOf('application/json') === -1) throw new Error('bad-response');
                return res.json();
            })
            .then(function (json) {
                // Envelope: always check `success` before reading `data`.
                if (!json || json.success !== true) throw new Error((json && json.error) || 'failed');
                var icons = Array.isArray(json.data) ? json.data : [];
                results.set(q, icons);
                return icons;
            });
        this.pending = { q: q, ctrl: ctrl, promise: promise, id: id };

        promise.then(
            function (icons) {
                clearTimeout(timeout);
                if (self.pending && self.pending.id === id) self.pending = null;
                if (id === self.reqId) self._render(icons, q);
            },
            function (err) {
                clearTimeout(timeout);
                if (self.pending && self.pending.id === id) self.pending = null;
                if (id !== self.reqId) return;   // superseded, ignore
                if (err && err.name === 'AbortError') {
                    self._status('Icon search timed out \u2014 type to retry.', false);
                } else {
                    self._fail();
                }
            }
        );
    };

    // API down / error: keep the field usable as free text (docs §Error handling).
    IconPicker.prototype._fail = function () {
        this._status('Couldn\u2019t reach the icons API \u2014 you can still type a class.', false);
    };

    IconPicker.prototype._render = function (icons, q) {
        var self = this;
        this.icons = icons || [];
        this.active = -1;
        this.menu.textContent = '';

        if (!this.icons.length) {
            this._status('No icons found for \u201c' + (q || '') + '\u201d.', false);
            this._preview(this.input.value);
            return;
        }

        var frag = document.createDocumentFragment();
        this.icons.forEach(function (icon, i) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ibc-icon-picker-option';
            btn.id = self.id + '-opt-' + i;
            btn.setAttribute('role', 'option');

            var glyph = document.createElement('i');       // icon preview…
            glyph.className = icon.class || ('bi ' + (icon.className || icon.name || ''));
            btn.appendChild(glyph);

            var label = document.createElement('span');    // …+ label preview
            label.className = 'ibc-icon-picker-option-label';
            highlightInto(label, icon.name || icon.className || '', q);
            btn.appendChild(label);

            var cat = document.createElement('span');
            cat.className = 'ibc-icon-picker-option-category';
            cat.textContent = icon.category || '';
            btn.appendChild(cat);

            btn.addEventListener('click', function () { self.select(icon); });
            btn.addEventListener('mouseenter', function () { self.setActive(i); });
            frag.appendChild(btn);
        });
        this.menu.appendChild(frag);
        this._syncChecks();
        // With a query, pre-select the top match so Enter picks it and the
        // in-field preview shows the matched icon (docs: substring match on
        // name / className / category).
        this.setActive(q ? 0 : -1);
    };

    // Marks the committed selection inside the dropdown (✓ + aria-selected).
    // Tolerates values saved as "bi bi-house" as well as "bi-house".
    IconPicker.prototype._syncChecks = function () {
        var val = (this.input.value || '').trim().replace(/^bi\s+/, '');
        var opts = this.menu.querySelectorAll('.ibc-icon-picker-option');
        for (var i = 0; i < opts.length; i++) {
            var icon = this.icons[i];
            var name = icon ? (icon.className || icon.name || '') : '';
            var selected = !!name && name === val;
            opts[i].classList.toggle('is-selected', selected);
            opts[i].setAttribute('aria-selected', selected ? 'true' : 'false');
        }
    };

    // Highlights option `i` and mirrors its preview into the search field.
    IconPicker.prototype.setActive = function (i) {
        var opts = this.menu.querySelectorAll('.ibc-icon-picker-option');
        if (!opts.length) {
            this.active = -1;
            this.input.removeAttribute('aria-activedescendant');
            this._preview(this.input.value);
            return;
        }
        var next = (i < 0) ? -1 : Math.min(i, opts.length - 1);
        for (var k = 0; k < opts.length; k++) {
            opts[k].classList.toggle('is-active', k === next);
        }
        this.active = next;
        if (next < 0) {
            this.input.removeAttribute('aria-activedescendant');
            this._preview(this.input.value);
            return;
        }
        if (opts[next].scrollIntoView) opts[next].scrollIntoView({ block: 'nearest' });
        this.input.setAttribute('aria-activedescendant', opts[next].id);
        var icon = this.icons[next];
        this._preview(icon ? (icon.className || icon.class || this.input.value) : this.input.value);
    };

    IconPicker.prototype._nextActive = function (dir) {
        var len = this.icons.length;
        if (!len) return -1;
        if (this.active < 0) return dir > 0 ? 0 : len - 1;
        return Math.max(0, Math.min(this.active + dir, len - 1));
    };

    IconPicker.prototype.select = function (icon) {
        this.input.value = icon.className || icon.class || icon.name || '';
        this._emit();
        this._syncClear();
        this.close();
        this.input.focus();
    };

    IconPicker.prototype._emit = function () {
        this._suppress = true;
        try {
            this.input.dispatchEvent(new Event('input', { bubbles: true }));
            this.input.dispatchEvent(new Event('change', { bubbles: true }));
        } finally {
            this._suppress = false;
        }
    };

    IconPicker.prototype._onKeydown = function (e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!this.isOpen) this.open(); else this.setActive(this._nextActive(1));
        } else if (e.key === 'ArrowUp') {
            if (!this.isOpen) return;
            e.preventDefault();
            this.setActive(this._nextActive(-1));
        } else if (e.key === 'Home' && this.isOpen && this.icons.length) {
            e.preventDefault();
            this.setActive(0);
        } else if (e.key === 'End' && this.isOpen && this.icons.length) {
            e.preventDefault();
            this.setActive(this.icons.length - 1);
        } else if (e.key === 'Enter') {
            if (this.isOpen && this.active >= 0 && this.icons[this.active]) {
                e.preventDefault();
                this.select(this.icons[this.active]);
            } else if (this.isOpen) {
                this.close();   // nothing highlighted: let the form submit
            }
        } else if (e.key === 'Escape' && this.isOpen) {
            e.preventDefault();
            this.close();
        } else if (e.key === 'Tab') {
            this.close();
        }
    };

    IconPicker.prototype._status = function (msg, loading) {
        this.menu.textContent = '';
        this.icons = [];
        this.active = -1;
        this.input.removeAttribute('aria-activedescendant');
        var box = document.createElement('div');
        box.className = 'ibc-icon-picker-status';
        if (loading) {
            var spin = document.createElement('span');
            spin.className = 'spinner-border spinner-border-sm me-1';
            spin.setAttribute('role', 'status');
            box.appendChild(spin);
        }
        box.appendChild(document.createTextNode(msg));
        this.menu.appendChild(box);
    };

    // Preview inside the search field: shows the glyph only for plausible
    // values (e.g. "bi-droplet-fill" / "bi bi-house"), hides otherwise.
    IconPicker.prototype._preview = function (cls) {
        var v = (cls || '').trim();
        if (!v || !/^(bi\b|bi-)/i.test(v)) {
            this.preview.classList.add('is-empty');
            return;
        }
        this.glyph.className = v;
        this.preview.classList.remove('is-empty');
    };

    IconPicker.prototype._syncClear = function () {
        this.clearBtn.hidden = !this.input.value;
    };

    // ─── Public API ───────────────────────────────────────────────────
    // Initializes every [data-icon-picker] input inside `root` (or the
    // document). Safe to call repeatedly — already-initialized inputs are
    // skipped. Mirrors window.ibcInitTinyMCE in /admin/assets/js/tinymce.js.
    function init(root) {
        var scope = root || document;
        if (!scope.querySelectorAll) return;
        var list = scope.querySelectorAll('input[data-icon-picker]');
        if (scope.matches && scope.matches('input[data-icon-picker]')) {
            list = [scope].concat(Array.prototype.slice.call(list));
        }
        Array.prototype.forEach.call(list, function (el) {
            if (el.ibcIconPicker) return;
            el.ibcIconPicker = new IconPicker(el);
        });
    }

    window.ibcInitIconPicker = init;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { init(document); });
    } else {
        init(document);
    }
})();



