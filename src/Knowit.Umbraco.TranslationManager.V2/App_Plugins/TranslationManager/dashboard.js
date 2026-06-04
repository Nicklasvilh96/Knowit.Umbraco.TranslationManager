import { LitElement as u, html as a, nothing as n, css as h } from "@umbraco-cms/backoffice/external/lit";
const d = "{{key}}", f = [
  { id: "react-i18next", label: "React / i18next", badge: "RX", badgeBg: "#e8f8fd", badgeColor: "#0d9abf", hint: "t('key')", name: "React", filePatterns: "*.tsx, *.ts, *.jsx, *.js", keyPattern: String.raw`\bt\(['"]([^'"]+)['"]\)` },
  { id: "razor", label: "Umbraco Razor", badge: "RZ", badgeBg: "#ede7f6", badgeColor: "#6200ea", hint: 'GetDictionaryValue("key")', name: "Razor", filePatterns: "*.cshtml, *.cs", keyPattern: String.raw`GetDictionaryValue(?:OrDefault)?\(\s*"([^"]+)"` },
  { id: "vue-i18n", label: "Vue / vue-i18n", badge: "VU", badgeBg: "#e8f5e9", badgeColor: "#2e7d32", hint: "$t('key')", name: "Vue", filePatterns: "*.vue, *.ts, *.js", keyPattern: String.raw`\$t\(['"]([^'"]+)['"]\)` },
  { id: "angular", label: "Angular", badge: "NG", badgeBg: "#ffebee", badgeColor: "#c62828", hint: "'key' | translate", name: "Angular", filePatterns: "*.ts, *.html", keyPattern: String.raw`'([^']+)'\s*\|\s*translate` },
  { id: "custom", label: "Custom", badge: "✦", badgeBg: "#e3f2fd", badgeColor: "#1c85c7", hint: "define your own", name: "", filePatterns: "", keyPattern: "" }
];
function b() {
  return {
    selectedPreset: "",
    name: "",
    rootPath: "",
    filePatterns: "",
    keyPattern: "",
    example: "",
    generateError: "",
    sources: [],
    cacheDurationMinutes: 5,
    excludedDirectories: "node_modules, bin, obj, .git, dist, .vite, wwwroot",
    excludedDictionaryRoots: [],
    copied: !1
  };
}
function l(r) {
  return r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function g(r) {
  const e = r.indexOf(d);
  if (e === -1) return "";
  const t = r.substring(0, e), s = r.substring(e + d.length), i = /^\w/.test(t) ? "\\b" : "", o = t.match(/(['"])$/);
  return o && s.startsWith(o[1]) ? i + l(t.slice(0, -1)) + `['"]([^'"]+)['"]` + l(s.slice(1)) : t.endsWith(".") ? i + l(t) + "([A-Z]\\w+)" : i + l(t) + `([^'"\\s]+)` + l(s);
}
const c = class c extends u {
  constructor() {
    super(...arguments), this._data = null, this._loading = !1, this._error = null, this._activeTab = "unused", this._filter = "", this._completeness = null, this._loadingCompleteness = !1, this._completenessFilter = "", this._selectedUnused = /* @__PURE__ */ new Set(), this._expandedMissing = /* @__PURE__ */ new Set(), this._newKeyValues = {}, this._savingKey = /* @__PURE__ */ new Set(), this._setup = b(), this._aiAvailable = !1, this._suggestingKey = "", this._suggestError = "", this._dictionaryRoots = [];
  }
  connectedCallback() {
    super.connectedCallback(), this._scan(!1), this._checkAiAvailable(), this._loadDictionaryRoots();
  }
  async _loadDictionaryRoots() {
    try {
      const e = await fetch("/umbraco/api/translation-manager/dictionary-roots");
      e.ok && (this._dictionaryRoots = await e.json());
    } catch {
    }
  }
  // ── API ───────────────────────────────────────────────────────────────────
  async _scan(e) {
    this._loading = !0, this._error = null, this._data = null, this._selectedUnused = /* @__PURE__ */ new Set(), this._expandedMissing = /* @__PURE__ */ new Set();
    try {
      const t = await fetch(`/umbraco/api/translation-manager/scan?force=${e}`);
      if (!t.ok) throw new Error(`${t.status}`);
      this._data = await t.json();
    } catch (t) {
      this._error = t instanceof Error ? t.message : "Scan failed.";
    } finally {
      this._loading = !1;
    }
  }
  async _openCompleteness() {
    if (this._activeTab = "completeness", !(this._completeness || this._loadingCompleteness)) {
      this._loadingCompleteness = !0;
      try {
        const e = await fetch("/umbraco/api/translation-manager/completeness");
        if (!e.ok) throw new Error(`${e.status}`);
        this._completeness = await e.json();
      } catch (e) {
        this._error = e instanceof Error ? e.message : "Could not load completeness.";
      } finally {
        this._loadingCompleteness = !1;
      }
    }
  }
  async _deleteSelected() {
    const e = [...this._selectedUnused];
    if (e.length && confirm(`Delete ${e.length} dictionary item(s)? This cannot be undone.`))
      try {
        const t = await fetch("/umbraco/api/translation-manager/keys", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(e)
        });
        if (!t.ok) throw new Error(`${t.status}`);
        await this._scan(!0);
      } catch (t) {
        this._error = `Delete failed: ${t instanceof Error ? t.message : t}`;
      }
  }
  async _saveKey(e) {
    this._savingKey = /* @__PURE__ */ new Set([...this._savingKey, e]);
    try {
      const t = await fetch("/umbraco/api/translation-manager/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: e, values: this._newKeyValues[e] ?? {} })
      });
      if (!t.ok) throw new Error(`${t.status}`);
      this._completeness = null, await this._scan(!0);
    } catch (t) {
      this._error = `Could not add key: ${t instanceof Error ? t.message : t}`;
    } finally {
      const t = new Set(this._savingKey);
      t.delete(e), this._savingKey = t;
    }
  }
  // ── Helpers ───────────────────────────────────────────────────────────────
  _timeAgo() {
    var t;
    if (!((t = this._data) != null && t.scannedAt)) return "";
    const e = Math.round((Date.now() - new Date(this._data.scannedAt).getTime()) / 6e4);
    return e < 1 ? "just now" : `${e} minute${e === 1 ? "" : "s"} ago`;
  }
  _filteredUnused() {
    if (!this._data) return [];
    const e = this._filter.toLowerCase();
    return this._data.unusedInDictionary.filter((t) => !e || t.key.toLowerCase().includes(e));
  }
  _filteredMissing() {
    if (!this._data) return [];
    const e = this._filter.toLowerCase();
    return this._data.missingFromDictionary.filter((t) => !e || t.key.toLowerCase().includes(e));
  }
  _filteredAll() {
    if (!this._data) return [];
    const e = this._filter.toLowerCase();
    return this._data.allKeys.filter((t) => !e || t.key.toLowerCase().includes(e));
  }
  _filteredIncomplete() {
    if (!this._completeness) return [];
    const e = this._completenessFilter.toLowerCase();
    return this._completeness.incompleteKeys.filter((t) => !e || t.key.toLowerCase().includes(e));
  }
  _healthClass() {
    return this._data ? this._data.summary.missingCount > 0 ? "health-danger" : this._data.summary.unusedCount > 0 ? "health-warn" : "health-ok" : "";
  }
  _healthLabel() {
    if (!this._data) return "";
    const e = [];
    return this._data.summary.missingCount > 0 && e.push(`${this._data.summary.missingCount} missing`), this._data.summary.unusedCount > 0 && e.push(`${this._data.summary.unusedCount} unused`), e.length ? e.join(" · ") : "All good";
  }
  _toggleAddKey(e) {
    const t = new Set(this._expandedMissing);
    t.has(e) ? t.delete(e) : t.add(e), this._expandedMissing = t, this._newKeyValues[e] || (this._newKeyValues = { ...this._newKeyValues, [e]: {} });
  }
  _setNewKeyValue(e, t, s) {
    this._newKeyValues = {
      ...this._newKeyValues,
      [e]: { ...this._newKeyValues[e] ?? {}, [t]: s }
    };
  }
  _toggleSelectUnused(e) {
    const t = new Set(this._selectedUnused);
    t.has(e) ? t.delete(e) : t.add(e), this._selectedUnused = t;
  }
  _toggleAllUnused() {
    const e = this._filteredUnused(), t = e.length > 0 && e.every((i) => this._selectedUnused.has(i.id)), s = new Set(this._selectedUnused);
    t ? e.forEach((i) => s.delete(i.id)) : e.forEach((i) => s.add(i.id)), this._selectedUnused = s;
  }
  async _checkAiAvailable() {
    try {
      const e = await fetch("/umbraco/api/translation-manager/ai-available");
      this._aiAvailable = e.ok;
    } catch {
      this._aiAvailable = !1;
    }
  }
  async _suggestTranslations(e) {
    this._suggestingKey = e, this._suggestError = "";
    try {
      const t = this._data.cultures.map((o) => o.isoCode), s = await fetch("/umbraco/api/translation-manager/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: e, cultures: t })
      });
      if (!s.ok) {
        const o = await s.json().catch(() => ({}));
        throw new Error(o.error ?? `Request failed (${s.status})`);
      }
      const i = await s.json();
      this._newKeyValues = {
        ...this._newKeyValues,
        [e]: { ...this._newKeyValues[e] ?? {}, ...i.suggestions }
      };
    } catch (t) {
      this._suggestError = t instanceof Error ? t.message : "AI suggestion failed.";
    } finally {
      this._suggestingKey = "";
    }
  }
  // ── Setup wizard ──────────────────────────────────────────────────────────
  _selectPreset(e) {
    this._setup = {
      ...this._setup,
      selectedPreset: e.id,
      name: e.name,
      filePatterns: e.filePatterns,
      keyPattern: e.keyPattern,
      example: "",
      generateError: "",
      copied: !1
    };
  }
  _canAddSource() {
    return !!(this._setup.name && this._setup.keyPattern);
  }
  _addSource() {
    if (!this._canAddSource()) return;
    const e = this._setup.filePatterns.split(",").map((s) => s.trim()).filter(Boolean), t = {
      Name: this._setup.name,
      RootPath: this._setup.rootPath || "../path/to/source",
      FilePatterns: e.length ? e : ["*.*"],
      KeyPattern: this._setup.keyPattern
    };
    this._setup = {
      ...this._setup,
      sources: [...this._setup.sources, t],
      selectedPreset: "",
      name: "",
      rootPath: "",
      filePatterns: "",
      keyPattern: "",
      example: "",
      generateError: ""
    };
  }
  _removeSource(e) {
    const t = [...this._setup.sources];
    t.splice(e, 1), this._setup = { ...this._setup, sources: t };
  }
  _onExampleInput(e) {
    const t = e.target.value, s = g(t);
    this._setup = { ...this._setup, example: t, keyPattern: s, generateError: "" };
  }
  _generatedSnippet() {
    const e = [...this._setup.sources];
    if (this._setup.selectedPreset && this._setup.name && this._setup.keyPattern) {
      const i = this._setup.filePatterns.split(",").map((o) => o.trim()).filter(Boolean);
      e.push({
        Name: this._setup.name,
        RootPath: this._setup.rootPath || "../path/to/source",
        FilePatterns: i.length ? i : ["*.*"],
        KeyPattern: this._setup.keyPattern
      });
    }
    const t = this._setup.excludedDirectories.split(",").map((i) => i.trim()).filter(Boolean), s = {
      CacheDurationMinutes: this._setup.cacheDurationMinutes,
      ExcludedDirectories: t,
      ScanSources: e
    };
    return this._setup.excludedDictionaryRoots.length > 0 && (s.ExcludedDictionaryRoots = this._setup.excludedDictionaryRoots), JSON.stringify({ TranslationManager: s }, null, 2);
  }
  async _copySnippet() {
    await navigator.clipboard.writeText(this._generatedSnippet()), this._setup = { ...this._setup, copied: !0 }, setTimeout(() => {
      this._setup = { ...this._setup, copied: !1 };
    }, 2e3);
  }
  // ── Render ────────────────────────────────────────────────────────────────
  render() {
    return this._loading ? a`<div class="loading"><div class="spinner"></div></div>` : this._data && !this._data.sourcesConfigured ? this._renderWizard() : this._data ? this._renderDashboard() : this._error ? a`<div class="error">${this._error}</div>` : a`<div class="empty"><button class="btn-primary" @click=${() => this._scan(!1)}>Run scan</button></div>`;
  }
  _renderWizard() {
    const e = this._setup, t = `e.g. t('${d}')`;
    return a`
      <div class="wizard">
        <div class="wizard-header">
          <div class="wizard-icon">⚙</div>
          <div>
            <h2>Configure scan sources</h2>
            <p>Select a preset to configure where Translation Manager should look for translation keys in your code.</p>
          </div>
        </div>

        <div class="section-label">${e.sources.length > 0 ? "Add another source" : "Choose a preset"}</div>
        <div class="preset-grid">
          ${f.map((s) => a`
            <button class="preset-card ${e.selectedPreset === s.id ? "active" : ""}"
                    @click=${() => this._selectPreset(s)}>
              <div class="preset-badge" style="background:${s.badgeBg};color:${s.badgeColor}">${s.badge}</div>
              <div>
                <span class="preset-name">${s.label}</span>
                <span class="preset-hint">${s.hint}</span>
              </div>
            </button>
          `)}
        </div>

        ${e.selectedPreset || e.sources.length > 0 ? a`
          <div class="config-panes">
            <div class="config-pane">
              <div class="pane-header">Configuration</div>
              <div class="pane-body">

                ${e.sources.length > 0 ? a`
                  <div class="sources-list">
                    <div class="field-label" style="margin-bottom:8px">Scan sources</div>
                    ${e.sources.map((s, i) => a`
                      <div class="source-chip">
                        <span class="source-chip-name">${s.Name}</span>
                        <span class="source-chip-path">${s.RootPath}</span>
                        <button class="source-chip-remove" @click=${() => this._removeSource(i)}>×</button>
                      </div>
                    `)}
                  </div>
                ` : n}

                ${e.selectedPreset ? a`
                  ${e.sources.length > 0 ? a`<div class="pane-divider">New source</div>` : n}

                  <div class="field">
                    <label class="field-label">Source name</label>
                    <input class="field-input" .value=${e.name} placeholder="e.g. React"
                           @input=${(s) => {
      this._setup = { ...e, name: s.target.value };
    }} />
                  </div>
                  <div class="field">
                    <label class="field-label">Root path <span class="field-hint">relative to ContentRootPath</span></label>
                    <input class="field-input mono" .value=${e.rootPath} placeholder="../frontend/src"
                           @input=${(s) => {
      this._setup = { ...e, rootPath: s.target.value };
    }} />
                  </div>
                  <div class="field">
                    <label class="field-label">File patterns <span class="field-hint">comma-separated</span></label>
                    <input class="field-input mono" .value=${e.filePatterns} placeholder="*.tsx, *.ts, *.js"
                           @input=${(s) => {
      this._setup = { ...e, filePatterns: s.target.value };
    }} />
                  </div>

                  ${e.selectedPreset === "custom" ? a`
                    <div class="generator">
                      <div class="generator-title">Generate key pattern</div>
                      <div class="field">
                        <label class="field-label">Translation convention</label>
                        <input class="field-input mono" .value=${e.example}
                               placeholder=${t}
                               @input=${this._onExampleInput} />
                        <span class="generator-hint">
                          Replace the translation key with <code>${d}</code> and the pattern updates automatically.
                        </span>
                      </div>
                    </div>
                  ` : n}

                  <div class="field">
                    <label class="field-label">Key pattern <span class="field-hint">regex, group 1 = key</span></label>
                    <input class="field-input mono" .value=${e.keyPattern} placeholder="regex pattern"
                           @input=${(s) => {
      this._setup = { ...e, keyPattern: s.target.value };
    }} />
                  </div>

                  <div class="form-actions">
                    <button class="add-source-btn" ?disabled=${!this._canAddSource()} @click=${this._addSource}>
                      + Add source
                    </button>
                  </div>
                ` : n}

                <div class="global-settings">
                  <div class="pane-divider">Global settings</div>
                  <div class="field">
                    <label class="field-label">Excluded directories <span class="field-hint">comma-separated</span></label>
                    <input class="field-input mono" .value=${e.excludedDirectories}
                           @input=${(s) => {
      this._setup = { ...e, excludedDirectories: s.target.value };
    }} />
                  </div>
                  <div class="field">
                    <label class="field-label">Cache duration <span class="field-hint">minutes, 0 = off</span></label>
                    <input class="field-input narrow" type="number" min="0" .value=${String(e.cacheDurationMinutes)}
                           @input=${(s) => {
      this._setup = { ...e, cacheDurationMinutes: Number(s.target.value) };
    }} />
                  </div>
                  ${this._dictionaryRoots.length > 0 ? a`
                    <div class="field">
                      <label class="field-label">Excluded dictionary roots <span class="field-hint">backend / backoffice keys</span></label>
                      <div class="roots-list">
                        ${this._dictionaryRoots.map((s) => a`
                          <label class="root-checkbox-label">
                            <input type="checkbox"
                                   .checked=${e.excludedDictionaryRoots.includes(s)}
                                   @change=${() => {
      const i = e.excludedDictionaryRoots.includes(s) ? e.excludedDictionaryRoots.filter((o) => o !== s) : [...e.excludedDictionaryRoots, s];
      this._setup = { ...e, excludedDictionaryRoots: i };
    }} />
                            <code>${s}</code>
                          </label>
                        `)}
                      </div>
                    </div>
                  ` : n}
                </div>

              </div>
            </div>

            <div class="snippet-pane">
              <div class="pane-header">
                appsettings.json
                <button class="snippet-copy-btn ${e.copied ? "copied" : ""}" @click=${this._copySnippet}>
                  ${e.copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <pre class="snippet-pre">${this._generatedSnippet()}</pre>
            </div>
          </div>
        ` : n}
      </div>
    `;
  }
  _renderDashboard() {
    const e = this._data;
    return a`
      <div class="dashboard">
        ${this._error ? a`<div class="error">${this._error}</div>` : n}

        <div class="scan-bar">
          <div class="scan-sources">
            ${e.diagnostics.map((t) => a`
              <span class="scan-source">
                <span class="scan-dot ${t.exists ? "dot-ok" : "dot-warn"}"></span>
                <span class="scan-source-name">${t.source}</span>
                <span class="scan-filecount">${t.patternMatchedFiles} files</span>
              </span>
            `)}
          </div>
          <div class="scan-right">
            <span class="health-badge ${this._healthClass()}">${this._healthLabel()}</span>
            <span class="scanned-at">${this._timeAgo()}</span>
            <button class="rescan-btn" @click=${() => this._scan(!0)}>↻ Rescan</button>
          </div>
        </div>

        <div class="summary">
          <div class="stat">
            <span class="stat-value">${e.summary.dictionaryCount}</span>
            <span class="stat-label">Dictionary keys</span>
            <span class="stat-sub">total in Umbraco</span>
          </div>
          <div class="stat stat-ok">
            <span class="stat-value">${e.summary.usedCount}</span>
            <span class="stat-label">Used in code</span>
            <span class="stat-sub">found in sources</span>
          </div>
          <div class="stat ${e.summary.unusedCount > 0 ? "stat-warn" : "stat-ok"}">
            <span class="stat-value">${e.summary.unusedCount}</span>
            <span class="stat-label">Unused</span>
            <span class="stat-sub">safe to remove</span>
          </div>
          <div class="stat ${e.summary.missingCount > 0 ? "stat-danger" : "stat-ok"}">
            <span class="stat-value">${e.summary.missingCount}</span>
            <span class="stat-label">Missing</span>
            <span class="stat-sub">not in dictionary</span>
          </div>
        </div>

        <div class="toolbar">
          <input class="search" type="search" placeholder="Filter keys…"
                 .value=${this._filter}
                 @input=${(t) => {
      this._filter = t.target.value;
    }} />
        </div>

        <div class="tabs">
          <button class="tab ${this._activeTab === "unused" ? "active" : ""}"
                  @click=${() => {
      this._activeTab = "unused";
    }}>
            Unused <span class="badge">${e.summary.unusedCount}</span>
          </button>
          <button class="tab ${this._activeTab === "missing" ? "active" : ""}"
                  @click=${() => {
      this._activeTab = "missing";
    }}>
            Missing <span class="badge">${e.summary.missingCount}</span>
          </button>
          <button class="tab ${this._activeTab === "completeness" ? "active" : ""}"
                  @click=${this._openCompleteness}>
            Completeness
            ${this._completeness ? a`<span class="badge">${this._completeness.summary.incompleteCount}</span>` : n}
          </button>
          <button class="tab ${this._activeTab === "all" ? "active" : ""}"
                  @click=${() => {
      this._activeTab = "all";
    }}>
            All keys <span class="badge">${e.summary.dictionaryCount}</span>
          </button>
        </div>

        ${this._activeTab === "unused" ? this._renderUnused() : n}
        ${this._activeTab === "missing" ? this._renderMissing() : n}
        ${this._activeTab === "completeness" ? this._renderCompleteness() : n}
        ${this._activeTab === "all" ? this._renderAllKeys() : n}
      </div>
    `;
  }
  _renderUnused() {
    const e = this._filteredUnused();
    if (!e.length) return a`<p class="empty">${this._filter ? "No matches." : "No unused keys."}</p>`;
    const t = e.every((s) => this._selectedUnused.has(s.id));
    return a`
      <div class="bulk-bar">
        <label class="checkbox-label">
          <input type="checkbox" .checked=${t} @change=${this._toggleAllUnused} /> Select all
        </label>
        <button class="btn-danger btn-sm" ?disabled=${this._selectedUnused.size === 0} @click=${this._deleteSelected}>
          Delete (${this._selectedUnused.size})
        </button>
      </div>
      <table class="tm-table">
        <thead><tr><th class="col-check"></th><th>Key</th><th class="col-action"></th></tr></thead>
        <tbody>
          ${e.map((s) => a`
            <tr class="${this._selectedUnused.has(s.id) ? "selected" : ""}">
              <td><input type="checkbox" .checked=${this._selectedUnused.has(s.id)}
                         @change=${() => this._toggleSelectUnused(s.id)} /></td>
              <td><code>${s.key}</code></td>
              <td><a class="icon-btn" href="/umbraco/section/translation/workspace/dictionary/edit/${s.id}" title="Go to dictionary">✎</a></td>
            </tr>
          `)}
        </tbody>
      </table>
    `;
  }
  _renderMissing() {
    const e = this._filteredMissing();
    return e.length ? a`
      <table class="tm-table">
        <thead><tr><th>Key</th><th>Referenced in</th><th class="col-action"></th></tr></thead>
        <tbody>
          ${e.map((t) => a`
            <tr>
              <td><code>${t.key}</code></td>
              <td>
                ${t.sources.map((s) => a`
                  <div class="source-group">
                    <span class="source-name">${s.name}</span>
                    <div class="files">${s.files.map((i) => a`<span class="file">${i}</span>`)}</div>
                  </div>
                `)}
              </td>
              <td>
                <button class="icon-btn ${this._expandedMissing.has(t.key) ? "active" : ""}"
                        @click=${() => this._toggleAddKey(t.key)}>+</button>
              </td>
            </tr>
            ${this._expandedMissing.has(t.key) ? a`
              <tr class="add-row">
                <td colspan="3">
                  <div class="add-form">
                    <div class="add-fields">
                      ${this._data.cultures.map((s) => {
      var i;
      return a`
                        <div class="add-field">
                          <label class="add-label">${s.name}</label>
                          <input class="add-input" type="text"
                                 .value=${((i = this._newKeyValues[t.key]) == null ? void 0 : i[s.isoCode]) ?? ""}
                                 placeholder=${s.isoCode}
                                 @input=${(o) => this._setNewKeyValue(t.key, s.isoCode, o.target.value)} />
                        </div>
                      `;
    })}
                    </div>
                    ${this._aiAvailable ? a`
                      <div class="ai-bar">
                        <button class="btn-ai btn-sm"
                                ?disabled=${this._suggestingKey === t.key}
                                @click=${() => this._suggestTranslations(t.key)}>
                          ${this._suggestingKey === t.key ? a`<span class="ai-spinner"></span> Suggesting…` : "✦ Suggest with AI"}
                        </button>
                        ${this._suggestError && this._suggestingKey !== t.key ? a`<span class="ai-error">${this._suggestError}</span>` : n}
                      </div>
                    ` : n}
                    <div class="add-actions">
                      <button class="btn-primary btn-sm" ?disabled=${this._savingKey.has(t.key)}
                              @click=${() => this._saveKey(t.key)}>
                        ${this._savingKey.has(t.key) ? "Saving…" : "Add to dictionary"}
                      </button>
                      <button class="btn-sm" @click=${() => this._toggleAddKey(t.key)}>Cancel</button>
                    </div>
                  </div>
                </td>
              </tr>
            ` : n}
          `)}
        </tbody>
      </table>
    ` : a`<p class="empty">${this._filter ? "No matches." : "No missing keys."}</p>`;
  }
  _renderCompleteness() {
    if (this._loadingCompleteness) return a`<div class="loading"><div class="spinner"></div></div>`;
    if (!this._completeness) return a``;
    const e = this._completeness, t = this._filteredIncomplete();
    return a`
      <div class="completeness-summary">
        <span class="text-ok">${e.summary.completeCount} fully translated</span>
        ${e.summary.incompleteCount > 0 ? a`<span class="text-warn">${e.summary.incompleteCount} incomplete</span>` : a`<span class="text-ok">All keys have translations for all languages</span>`}
      </div>
      <div class="toolbar">
        <input class="search" type="search" placeholder="Filter keys…"
               .value=${this._completenessFilter}
               @input=${(s) => {
      this._completenessFilter = s.target.value;
    }} />
      </div>
      ${t.length ? a`
          <table class="tm-table">
            <thead>
              <tr>
                <th>Key</th>
                ${e.cultures.map((s) => a`<th>${s.name}</th>`)}
                <th class="col-action"></th>
              </tr>
            </thead>
            <tbody>
              ${t.map((s) => a`
                <tr>
                  <td><code>${s.key}</code></td>
                  ${e.cultures.map((i) => a`
                    <td>
                      ${s.translations[i.isoCode] ? a`<span class="translation-value" title=${s.translations[i.isoCode]}>${s.translations[i.isoCode]}</span>` : a`<span class="missing-badge">missing</span>`}
                    </td>
                  `)}
                  <td><a class="icon-btn" href="/umbraco/section/translation/workspace/dictionary/edit/${s.id}" title="Edit">✎</a></td>
                </tr>
              `)}
            </tbody>
          </table>
        ` : a`<p class="empty">${this._completenessFilter ? "No matches." : "All keys are fully translated."}</p>`}
    `;
  }
  _renderAllKeys() {
    const e = this._filteredAll();
    return e.length ? a`
      <table class="tm-table">
        <thead><tr><th>Key</th><th>Status</th><th>Files</th><th class="col-action"></th></tr></thead>
        <tbody>
          ${e.map((t) => a`
            <tr>
              <td><code>${t.key}</code></td>
              <td><span class="badge-status ${t.used ? "badge-used" : "badge-unused"}">${t.used ? t.sources.map((s) => s.name).join(" + ") : "Unused"}</span></td>
              <td>
                ${t.sources.map((s) => a`
                  <div class="source-group">
                    <span class="source-name">${s.name}</span>
                    <div class="files">${s.files.map((i) => a`<span class="file">${i}</span>`)}</div>
                  </div>
                `)}
              </td>
              <td><a class="icon-btn" href="/umbraco/section/translation/workspace/dictionary/edit/${t.id}" title="Edit">✎</a></td>
            </tr>
          `)}
        </tbody>
      </table>
    ` : a`<p class="empty">No matches.</p>`;
  }
};
c.properties = {
  _data: { state: !0 },
  _loading: { state: !0 },
  _error: { state: !0 },
  _activeTab: { state: !0 },
  _filter: { state: !0 },
  _completeness: { state: !0 },
  _loadingCompleteness: { state: !0 },
  _completenessFilter: { state: !0 },
  _selectedUnused: { state: !0 },
  _expandedMissing: { state: !0 },
  _newKeyValues: { state: !0 },
  _savingKey: { state: !0 },
  _setup: { state: !0 },
  _aiAvailable: { state: !0 },
  _suggestingKey: { state: !0 },
  _suggestError: { state: !0 },
  _dictionaryRoots: { state: !0 }
}, c.styles = h`
    :host { display: block; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #333; }

    h2 { margin: 0 0 6px; font-size: 17px; font-weight: 700; color: #1a2332; }
    p  { margin: 0; font-size: 13px; color: #556677; line-height: 1.65; }
    code { font-family: 'Courier New', Consolas, monospace; font-size: 0.9em; background: #f0f0f0; padding: 1px 4px; border-radius: 3px; }
    a { color: inherit; text-decoration: none; }

    /* Loading */
    .loading { display: flex; justify-content: center; padding: 40px; }
    .spinner { width: 32px; height: 32px; border: 3px solid #e0e0e0; border-top-color: #1c85c7; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .error { background: #ffebee; border: 1px solid #ef9a9a; border-radius: 3px; padding: 12px 16px; color: #b71c1c; margin-bottom: 16px; }
    .empty { color: #888; font-style: italic; padding: 16px 0; }

    /* Wizard */
    .wizard { max-width: 860px; animation: fadein 0.25s ease; }
    @keyframes fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    .wizard-header { display: flex; align-items: flex-start; gap: 16px; padding: 22px 24px; background: linear-gradient(135deg, #f0f7ff 0%, #fafcff 100%); border: 1px solid #cfe2f3; border-radius: 8px; margin-bottom: 28px; }
    .wizard-icon { width: 44px; height: 44px; background: #1c85c7; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; flex-shrink: 0; box-shadow: 0 2px 10px rgba(28,133,199,0.3); }

    .section-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9aabb8; margin-bottom: 10px; }

    .preset-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 28px; }
    .preset-card { display: flex; align-items: center; gap: 11px; padding: 11px 13px; border: 1.5px solid #e4eaf0; border-radius: 7px; background: #fff; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s, transform 0.12s; text-align: left; width: 100%; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .preset-card:hover { border-color: #96c8e6; box-shadow: 0 3px 10px rgba(28,133,199,0.1); transform: translateY(-1px); }
    .preset-card.active { border-color: #1c85c7; background: #f0f8ff; box-shadow: 0 0 0 3px rgba(28,133,199,0.1); transform: translateY(-1px); }
    .preset-badge { width: 34px; height: 34px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; flex-shrink: 0; }
    .preset-name { display: block; font-size: 12px; font-weight: 600; color: #2c3e50; }
    .preset-card.active .preset-name { color: #1c85c7; }
    .preset-hint { display: block; font-size: 10px; color: #8fa0b0; font-family: 'Courier New', Consolas, monospace; margin-top: 2px; }

    .config-panes { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
    .config-pane { border: 1px solid #e4eaf0; border-radius: 7px; background: #fff; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
    .pane-header { padding: 10px 14px; background: #f7f9fb; border-bottom: 1px solid #e4eaf0; font-size: 10px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: #8899aa; display: flex; align-items: center; gap: 6px; }
    .pane-body { padding: 14px; }

    .pane-divider { font-size: 10px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: #9aabb8; margin: 14px 0 12px; display: flex; align-items: center; gap: 8px; }
    .pane-divider::before, .pane-divider::after { content: ''; flex: 1; height: 1px; background: #e4eaf0; }

    .field { margin-bottom: 12px; }
    .field:last-child { margin-bottom: 0; }
    .field-label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #667788; margin-bottom: 5px; }
    .field-hint { font-size: 10px; font-weight: 400; text-transform: none; letter-spacing: 0; color: #bbb; margin-left: 4px; }
    .field-input { width: 100%; padding: 7px 10px; border: 1.5px solid #dde4ec; border-radius: 5px; font-size: 12px; color: #2c3e50; background: #fafbfc; transition: border-color 0.15s, box-shadow 0.15s; box-sizing: border-box; }
    .field-input:focus { outline: none; border-color: #1c85c7; background: #fff; box-shadow: 0 0 0 3px rgba(28,133,199,0.08); }
    .field-input.mono { font-family: 'Courier New', Consolas, monospace; font-size: 11.5px; }
    .field-input.narrow { width: 80px; }

    .generator { margin-top: 12px; padding-top: 12px; border-top: 1.5px dashed #dde4ec; }
    .generator-title { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #1c85c7; margin-bottom: 10px; }
    .generator-hint { display: block; font-size: 11px; color: #8899aa; margin-top: 5px; }
    .generator-hint code { background: #eef2f6; color: #1c85c7; }

    .sources-list { margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid #e4eaf0; }
    .source-chip { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #f0f8ff; border: 1px solid #c8e0f4; border-radius: 5px; margin-bottom: 6px; font-size: 12px; }
    .source-chip-name { font-weight: 700; color: #1c85c7; flex-shrink: 0; }
    .source-chip-path { color: #778899; font-family: 'Courier New', Consolas, monospace; font-size: 11px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .source-chip-remove { background: none; border: none; color: #aab; font-size: 15px; cursor: pointer; padding: 0 2px; flex-shrink: 0; }
    .source-chip-remove:hover { color: #c62828; }

    .form-actions { margin-top: 14px; }
    .add-source-btn { width: 100%; padding: 8px; background: #f0f8ff; border: 1.5px dashed #96c8e6; border-radius: 5px; color: #1c85c7; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
    .add-source-btn:hover:not([disabled]) { background: #e0f0fc; border-color: #1c85c7; }
    .add-source-btn[disabled] { opacity: 0.4; cursor: default; }

    .global-settings { margin-top: 4px; }
    .roots-list { display: flex; flex-direction: column; gap: 5px; margin-top: 4px; }
    .root-checkbox-label { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #2c3e50; cursor: pointer; padding: 4px 6px; border-radius: 4px; transition: background 0.12s; }
    .root-checkbox-label:hover { background: #f0f8ff; }
    .root-checkbox-label input[type="checkbox"] { cursor: pointer; accent-color: #1c85c7; }

    .snippet-pane { border: 1px solid #1a2636; border-radius: 7px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.18); }
    .snippet-pane .pane-header { background: #1e2d3d; border-bottom: 1px solid #283d52; color: #7a9ab0; }
    .snippet-copy-btn { margin-left: auto; padding: 2px 10px; height: 22px; background: transparent; border: 1px solid #2d4560; border-radius: 3px; color: #7a9ab0; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
    .snippet-copy-btn:hover { background: #253347; color: #aabccc; }
    .snippet-copy-btn.copied { background: #152e1e; border-color: #1e5c35; color: #4caf50; }
    .snippet-pre { margin: 0; padding: 16px; font-family: 'Courier New', Consolas, monospace; font-size: 11.5px; line-height: 1.7; color: #b8cfe0; background: #12202e; border: none; white-space: pre; overflow-x: auto; min-height: 160px; display: block; }

    /* Dashboard */
    .dashboard { max-width: 1200px; }

    .scan-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 10px 16px; background: #f7f9fb; border: 1px solid #e4eaf0; border-radius: 6px; margin-bottom: 16px; }
    .scan-sources { display: flex; flex-wrap: wrap; gap: 12px; }
    .scan-source { display: flex; align-items: center; gap: 6px; font-size: 12px; }
    .scan-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .dot-ok { background: #4caf50; }
    .dot-warn { background: #ff9800; }
    .scan-source-name { font-weight: 600; color: #2c3e50; }
    .scan-filecount { color: #8899aa; font-size: 11px; }
    .scan-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
    .health-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
    .health-ok { background: #e8f5e9; color: #2e7d32; }
    .health-warn { background: #fff3e0; color: #e65100; }
    .health-danger { background: #ffebee; color: #c62828; }
    .scanned-at { font-size: 12px; color: #999; }
    .rescan-btn { padding: 5px 12px; background: #fff; border: 1.5px solid #d0dce8; border-radius: 4px; color: #445566; font-size: 12px; font-weight: 600; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
    .rescan-btn:hover { border-color: #1c85c7; color: #1c85c7; background: #f0f8ff; }

    .summary { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
    .stat { background: #f5f5f5; border-left: 4px solid #ccc; border-radius: 3px; padding: 12px 20px; min-width: 130px; }
    .stat-ok { border-left-color: #4caf50; }
    .stat-warn { border-left-color: #ff9800; }
    .stat-danger { border-left-color: #f44336; }
    .stat-value { display: block; font-size: 2em; font-weight: 600; line-height: 1; color: #333; }
    .stat-label { display: block; font-size: 0.8em; color: #444; font-weight: 600; margin-top: 4px; }
    .stat-sub { display: block; font-size: 0.7em; color: #999; margin-top: 2px; }

    .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .search { flex: 1; max-width: 400px; padding: 6px 12px; border: 1px solid #ddd; border-radius: 3px; font-size: 14px; }

    .tabs { display: flex; gap: 0; border-bottom: 2px solid #ddd; margin-bottom: 16px; }
    .tab { padding: 8px 16px; border: none; background: none; cursor: pointer; font-size: 13px; color: #666; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: color 0.15s; }
    .tab:hover { color: #333; }
    .tab.active { color: #1c85c7; border-bottom-color: #1c85c7; font-weight: 600; }
    .tab .badge { display: inline-block; background: #e0e0e0; color: #555; border-radius: 10px; padding: 1px 7px; font-size: 11px; margin-left: 5px; }
    .tab.active .badge { background: #d0eaf7; color: #1c85c7; }

    .bulk-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; padding: 8px 12px; background: #f9f9f9; border: 1px solid #eee; border-radius: 3px; }
    .checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: normal; margin: 0; cursor: pointer; }

    .tm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .tm-table th { background: #f5f5f5; padding: 8px 12px; text-align: left; border-bottom: 2px solid #ddd; font-weight: 600; white-space: nowrap; }
    .tm-table td { padding: 8px 12px; border-bottom: 1px solid #eee; vertical-align: top; }
    .tm-table tr:hover td { background: #fafafa; }
    .tm-table tr.selected td { background: #fff8e1; }
    .col-check { width: 32px; }
    .col-action { width: 36px; text-align: center; }

    .icon-btn { display: inline-block; width: 26px; height: 26px; line-height: 26px; text-align: center; border-radius: 3px; background: #f0f0f0; color: #555; font-size: 13px; cursor: pointer; border: 1px solid #ddd; transition: background 0.15s; }
    .icon-btn:hover, .icon-btn.active { background: #1c85c7; color: #fff; border-color: #1c85c7; }

    .source-group { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; margin-bottom: 4px; }
    .source-name { font-weight: 600; min-width: 56px; color: #555; }
    .files { display: flex; flex-wrap: wrap; gap: 4px; }
    .file { background: #f0f0f0; padding: 1px 6px; border-radius: 2px; font-family: monospace; font-size: 11px; color: #333; }

    .add-row td { background: #f7fbff; border-bottom: 2px solid #d0e8f7; }
    .add-form { padding: 8px 4px; }
    .add-fields { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 10px; }
    .add-field { display: flex; flex-direction: column; gap: 4px; min-width: 180px; }
    .add-label { font-size: 11px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.03em; }
    .add-input { padding: 5px 8px; border: 1px solid #ccc; border-radius: 3px; font-size: 13px; }
    .add-actions { display: flex; gap: 8px; }

    .ai-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding: 8px 10px; background: #f5f0ff; border-radius: 5px; border: 1px solid #ddd0f7; }
    .btn-ai { background: #7c3aed; color: #fff; border: none; border-radius: 4px; padding: 5px 12px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.15s; }
    .btn-ai:hover:not([disabled]) { background: #6d28d9; }
    .btn-ai[disabled] { opacity: 0.6; cursor: default; }
    .ai-spinner { width: 10px; height: 10px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
    .ai-error { font-size: 11px; color: #c62828; }

    .completeness-summary { display: flex; gap: 16px; margin-bottom: 16px; font-size: 13px; font-weight: 600; }
    .text-ok { color: #2e7d32; }
    .text-warn { color: #e65100; }
    .translation-value { display: block; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: #333; }
    .missing-badge { display: inline-block; padding: 1px 6px; background: #fce4ec; color: #c62828; border-radius: 3px; font-size: 11px; font-weight: 600; }

    .badge-status { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .badge-used { background: #e8f5e9; color: #2e7d32; }
    .badge-unused { background: #fce4ec; color: #c62828; }

    .btn-primary { background: #1c85c7; color: #fff; border: none; border-radius: 3px; padding: 7px 16px; font-size: 13px; cursor: pointer; }
    .btn-primary:hover { background: #1570a8; }
    .btn-danger { background: #f44336; color: #fff; border: none; border-radius: 3px; padding: 7px 16px; font-size: 13px; cursor: pointer; }
    .btn-danger:hover { background: #d32f2f; }
    .btn-sm { padding: 4px 10px; font-size: 12px; border: 1px solid #ddd; background: #f5f5f5; color: #444; border-radius: 3px; cursor: pointer; }
    .btn-sm:hover { background: #e8e8e8; }
    .btn-danger.btn-sm { background: #f44336; color: #fff; border-color: #f44336; }
  `;
let p = c;
customElements.define("tm-dashboard", p);
export {
  p as default
};
