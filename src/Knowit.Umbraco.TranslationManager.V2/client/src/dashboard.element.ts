import { LitElement, html, css, nothing } from '@umbraco-cms/backoffice/external/lit';
import type { TemplateResult } from '@umbraco-cms/backoffice/external/lit';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Culture { isoCode: string; name: string; }
interface Summary { dictionaryCount: number; usedCount: number; unusedCount: number; missingCount: number; }
interface Diagnostic { source: string; resolvedPath: string; exists: boolean; totalFiles: number; patternMatchedFiles: number; }
interface SourceRef { name: string; files: string[]; }
interface DictItem { key: string; id: string; }
interface MissingItem { key: string; sources: SourceRef[]; }
interface AllKeyItem { key: string; id: string; used: boolean; sources: SourceRef[]; }
interface ScanResult {
  sourcesConfigured: boolean;
  scannedAt: string;
  contentRoot: string;
  diagnostics: Diagnostic[];
  cultures: Culture[];
  summary: Summary;
  unusedInDictionary: DictItem[];
  missingFromDictionary: MissingItem[];
  allKeys: AllKeyItem[];
}
interface CompletenessItem { key: string; id: string; translations: Record<string, string>; }
interface CompletenessResult {
  cultures: Culture[];
  summary: { totalKeys: number; completeCount: number; incompleteCount: number; };
  incompleteKeys: CompletenessItem[];
}
interface SourceConfig { Name: string; RootPath: string; FilePatterns: string[]; KeyPattern: string; }
interface SetupState {
  selectedPreset: string;
  name: string; rootPath: string; filePatterns: string; keyPattern: string;
  example: string; generateError: string;
  sources: SourceConfig[];
  cacheDurationMinutes: number;
  excludedDirectories: string;
  copied: boolean;
}
interface Preset {
  id: string; label: string; badge: string; badgeBg: string; badgeColor: string;
  hint: string; name: string; filePatterns: string; keyPattern: string;
}

type TabName = 'unused' | 'missing' | 'completeness' | 'all';

// ── Constants ─────────────────────────────────────────────────────────────────

const KEY_MARKER = '{{key}}';

const PRESETS: Preset[] = [
  { id: 'react-i18next', label: 'React / i18next', badge: 'RX', badgeBg: '#e8f8fd', badgeColor: '#0d9abf', hint: "t('key')", name: 'React', filePatterns: '*.tsx, *.ts, *.jsx, *.js', keyPattern: String.raw`\bt\(['"]([^'"]+)['"]\)` },
  { id: 'razor', label: 'Umbraco Razor', badge: 'RZ', badgeBg: '#ede7f6', badgeColor: '#6200ea', hint: 'GetDictionaryValue("key")', name: 'Razor', filePatterns: '*.cshtml, *.cs', keyPattern: String.raw`GetDictionaryValue(?:OrDefault)?\(\s*"([^"]+)"` },
  { id: 'vue-i18n', label: 'Vue / vue-i18n', badge: 'VU', badgeBg: '#e8f5e9', badgeColor: '#2e7d32', hint: "$t('key')", name: 'Vue', filePatterns: '*.vue, *.ts, *.js', keyPattern: String.raw`\$t\(['"]([^'"]+)['"]\)` },
  { id: 'angular', label: 'Angular', badge: 'NG', badgeBg: '#ffebee', badgeColor: '#c62828', hint: "'key' | translate", name: 'Angular', filePatterns: '*.ts, *.html', keyPattern: String.raw`'([^']+)'\s*\|\s*translate` },
  { id: 'custom', label: 'Custom', badge: '✦', badgeBg: '#e3f2fd', badgeColor: '#1c85c7', hint: 'define your own', name: '', filePatterns: '', keyPattern: '' },
];

function makeSetup(): SetupState {
  return {
    selectedPreset: '', name: '', rootPath: '', filePatterns: '', keyPattern: '',
    example: '', generateError: '',
    sources: [],
    cacheDurationMinutes: 5,
    excludedDirectories: 'node_modules, bin, obj, .git, dist, .vite, wwwroot',
    copied: false,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function derivePattern(example: string): string {
  const idx = example.indexOf(KEY_MARKER);
  if (idx === -1) return '';
  const before = example.substring(0, idx);
  const after = example.substring(idx + KEY_MARKER.length);
  const prefix = /^\w/.test(before) ? '\\b' : '';
  const quoteMatch = before.match(/(['"])$/);
  if (quoteMatch && after.startsWith(quoteMatch[1])) {
    return prefix + escapeRegex(before.slice(0, -1)) + `['"]([^'"]+)['"]` + escapeRegex(after.slice(1));
  }
  if (before.endsWith('.')) {
    return prefix + escapeRegex(before) + '([A-Z]\\w+)';
  }
  return prefix + escapeRegex(before) + `([^'"\\s]+)` + escapeRegex(after);
}

// ── Element ───────────────────────────────────────────────────────────────────

class TmDashboardElement extends LitElement {

  static properties = {
    _data:                  { state: true },
    _loading:               { state: true },
    _error:                 { state: true },
    _activeTab:             { state: true },
    _filter:                { state: true },
    _completeness:          { state: true },
    _loadingCompleteness:   { state: true },
    _completenessFilter:    { state: true },
    _selectedUnused:        { state: true },
    _expandedMissing:       { state: true },
    _newKeyValues:          { state: true },
    _savingKey:             { state: true },
    _setup:                 { state: true },
    _aiAvailable:           { state: true },
    _suggestingKey:         { state: true },
    _suggestError:          { state: true },
  };

  private _data: ScanResult | null = null;
  private _loading = false;
  private _error: string | null = null;
  private _activeTab: TabName = 'unused';
  private _filter = '';
  private _completeness: CompletenessResult | null = null;
  private _loadingCompleteness = false;
  private _completenessFilter = '';
  private _selectedUnused = new Set<string>();
  private _expandedMissing = new Set<string>();
  private _newKeyValues: Record<string, Record<string, string>> = {};
  private _savingKey = new Set<string>();
  private _setup: SetupState = makeSetup();
  private _aiAvailable = false;
  private _suggestingKey = '';
  private _suggestError = '';

  connectedCallback() {
    super.connectedCallback();
    this._scan(false);
    this._checkAiAvailable();
  }

  // ── API ───────────────────────────────────────────────────────────────────

  private async _scan(force: boolean) {
    this._loading = true;
    this._error = null;
    this._data = null;
    this._selectedUnused = new Set();
    this._expandedMissing = new Set();
    try {
      const res = await fetch(`/umbraco/api/translation-manager/scan?force=${force}`);
      if (!res.ok) throw new Error(`${res.status}`);
      this._data = await res.json();
    } catch (e) {
      this._error = e instanceof Error ? e.message : 'Scan failed.';
    } finally {
      this._loading = false;
    }
  }

  private async _openCompleteness() {
    this._activeTab = 'completeness';
    if (this._completeness || this._loadingCompleteness) return;
    this._loadingCompleteness = true;
    try {
      const res = await fetch('/umbraco/api/translation-manager/completeness');
      if (!res.ok) throw new Error(`${res.status}`);
      this._completeness = await res.json();
    } catch (e) {
      this._error = e instanceof Error ? e.message : 'Could not load completeness.';
    } finally {
      this._loadingCompleteness = false;
    }
  }

  private async _deleteSelected() {
    const ids = [...this._selectedUnused];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} dictionary item(s)? This cannot be undone.`)) return;
    try {
      const res = await fetch('/umbraco/api/translation-manager/keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await this._scan(true);
    } catch (e) {
      this._error = `Delete failed: ${e instanceof Error ? e.message : e}`;
    }
  }

  private async _saveKey(key: string) {
    this._savingKey = new Set([...this._savingKey, key]);
    try {
      const res = await fetch('/umbraco/api/translation-manager/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, values: this._newKeyValues[key] ?? {} }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      this._completeness = null;
      await this._scan(true);
    } catch (e) {
      this._error = `Could not add key: ${e instanceof Error ? e.message : e}`;
    } finally {
      const next = new Set(this._savingKey);
      next.delete(key);
      this._savingKey = next;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _timeAgo(): string {
    if (!this._data?.scannedAt) return '';
    const diff = Math.round((Date.now() - new Date(this._data.scannedAt).getTime()) / 60000);
    if (diff < 1) return 'just now';
    return `${diff} minute${diff === 1 ? '' : 's'} ago`;
  }

  private _filteredUnused(): DictItem[] {
    if (!this._data) return [];
    const q = this._filter.toLowerCase();
    return this._data.unusedInDictionary.filter(i => !q || i.key.toLowerCase().includes(q));
  }

  private _filteredMissing(): MissingItem[] {
    if (!this._data) return [];
    const q = this._filter.toLowerCase();
    return this._data.missingFromDictionary.filter(i => !q || i.key.toLowerCase().includes(q));
  }

  private _filteredAll(): AllKeyItem[] {
    if (!this._data) return [];
    const q = this._filter.toLowerCase();
    return this._data.allKeys.filter(i => !q || i.key.toLowerCase().includes(q));
  }

  private _filteredIncomplete(): CompletenessItem[] {
    if (!this._completeness) return [];
    const q = this._completenessFilter.toLowerCase();
    return this._completeness.incompleteKeys.filter(i => !q || i.key.toLowerCase().includes(q));
  }

  private _healthClass(): string {
    if (!this._data) return '';
    if (this._data.summary.missingCount > 0) return 'health-danger';
    if (this._data.summary.unusedCount > 0) return 'health-warn';
    return 'health-ok';
  }

  private _healthLabel(): string {
    if (!this._data) return '';
    const parts: string[] = [];
    if (this._data.summary.missingCount > 0) parts.push(`${this._data.summary.missingCount} missing`);
    if (this._data.summary.unusedCount > 0) parts.push(`${this._data.summary.unusedCount} unused`);
    return parts.length ? parts.join(' · ') : 'All good';
  }

  private _toggleAddKey(key: string) {
    const next = new Set(this._expandedMissing);
    if (next.has(key)) { next.delete(key); } else { next.add(key); }
    this._expandedMissing = next;
    if (!this._newKeyValues[key]) {
      this._newKeyValues = { ...this._newKeyValues, [key]: {} };
    }
  }

  private _setNewKeyValue(key: string, isoCode: string, value: string) {
    this._newKeyValues = {
      ...this._newKeyValues,
      [key]: { ...(this._newKeyValues[key] ?? {}), [isoCode]: value },
    };
  }

  private _toggleSelectUnused(id: string) {
    const next = new Set(this._selectedUnused);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    this._selectedUnused = next;
  }

  private _toggleAllUnused() {
    const filtered = this._filteredUnused();
    const allSelected = filtered.length > 0 && filtered.every(i => this._selectedUnused.has(i.id));
    const next = new Set(this._selectedUnused);
    if (allSelected) { filtered.forEach(i => next.delete(i.id)); }
    else { filtered.forEach(i => next.add(i.id)); }
    this._selectedUnused = next;
  }

  private async _checkAiAvailable() {
    try {
      const res = await fetch('/umbraco/api/translation-manager/ai-available');
      this._aiAvailable = res.ok;
    } catch {
      this._aiAvailable = false;
    }
  }

  private async _suggestTranslations(key: string) {
    this._suggestingKey = key;
    this._suggestError = '';
    try {
      const cultures = this._data!.cultures.map(c => c.isoCode);
      const res = await fetch('/umbraco/api/translation-manager/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, cultures }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Request failed (${res.status})`);
      }
      const data = await res.json() as { suggestions: Record<string, string> };
      this._newKeyValues = {
        ...this._newKeyValues,
        [key]: { ...(this._newKeyValues[key] ?? {}), ...data.suggestions },
      };
    } catch (e) {
      this._suggestError = e instanceof Error ? e.message : 'AI suggestion failed.';
    } finally {
      this._suggestingKey = '';
    }
  }

  // ── Setup wizard ──────────────────────────────────────────────────────────

  private _selectPreset(preset: Preset) {
    this._setup = {
      ...this._setup,
      selectedPreset: preset.id,
      name: preset.name,
      filePatterns: preset.filePatterns,
      keyPattern: preset.keyPattern,
      example: '',
      generateError: '',
      copied: false,
    };
  }

  private _canAddSource(): boolean {
    return !!(this._setup.name && this._setup.keyPattern);
  }

  private _addSource() {
    if (!this._canAddSource()) return;
    const patterns = this._setup.filePatterns.split(',').map(p => p.trim()).filter(Boolean);
    const source: SourceConfig = {
      Name: this._setup.name,
      RootPath: this._setup.rootPath || '../path/to/source',
      FilePatterns: patterns.length ? patterns : ['*.*'],
      KeyPattern: this._setup.keyPattern,
    };
    this._setup = {
      ...this._setup,
      sources: [...this._setup.sources, source],
      selectedPreset: '', name: '', rootPath: '', filePatterns: '',
      keyPattern: '', example: '', generateError: '',
    };
  }

  private _removeSource(index: number) {
    const sources = [...this._setup.sources];
    sources.splice(index, 1);
    this._setup = { ...this._setup, sources };
  }

  private _onExampleInput(e: Event) {
    const example = (e.target as HTMLInputElement).value;
    const keyPattern = derivePattern(example);
    this._setup = { ...this._setup, example, keyPattern, generateError: '' };
  }

  private _generatedSnippet(): string {
    const sources = [...this._setup.sources];
    if (this._setup.selectedPreset && this._setup.name && this._setup.keyPattern) {
      const patterns = this._setup.filePatterns.split(',').map(p => p.trim()).filter(Boolean);
      sources.push({
        Name: this._setup.name,
        RootPath: this._setup.rootPath || '../path/to/source',
        FilePatterns: patterns.length ? patterns : ['*.*'],
        KeyPattern: this._setup.keyPattern,
      });
    }
    const excludedDirs = this._setup.excludedDirectories.split(',').map(d => d.trim()).filter(Boolean);
    return JSON.stringify({
      TranslationManager: {
        CacheDurationMinutes: this._setup.cacheDurationMinutes,
        ExcludedDirectories: excludedDirs,
        ScanSources: sources,
      }
    }, null, 2);
  }

  private async _copySnippet() {
    await navigator.clipboard.writeText(this._generatedSnippet());
    this._setup = { ...this._setup, copied: true };
    setTimeout(() => { this._setup = { ...this._setup, copied: false }; }, 2000);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  render(): TemplateResult {
    if (this._loading) return html`<div class="loading"><div class="spinner"></div></div>`;
    if (this._data && !this._data.sourcesConfigured) return this._renderWizard();
    if (this._data) return this._renderDashboard();
    if (this._error) return html`<div class="error">${this._error}</div>`;
    return html`<div class="empty"><button class="btn-primary" @click=${() => this._scan(false)}>Run scan</button></div>`;
  }

  private _renderWizard(): TemplateResult {
    const s = this._setup;
    const examplePlaceholder = `e.g. t('${KEY_MARKER}')`;
    return html`
      <div class="wizard">
        <div class="wizard-header">
          <div class="wizard-icon">⚙</div>
          <div>
            <h2>Configure scan sources</h2>
            <p>Select a preset to configure where Translation Manager should look for translation keys in your code.</p>
          </div>
        </div>

        <div class="section-label">${s.sources.length > 0 ? 'Add another source' : 'Choose a preset'}</div>
        <div class="preset-grid">
          ${PRESETS.map(p => html`
            <button class="preset-card ${s.selectedPreset === p.id ? 'active' : ''}"
                    @click=${() => this._selectPreset(p)}>
              <div class="preset-badge" style="background:${p.badgeBg};color:${p.badgeColor}">${p.badge}</div>
              <div>
                <span class="preset-name">${p.label}</span>
                <span class="preset-hint">${p.hint}</span>
              </div>
            </button>
          `)}
        </div>

        ${s.selectedPreset || s.sources.length > 0 ? html`
          <div class="config-panes">
            <div class="config-pane">
              <div class="pane-header">Configuration</div>
              <div class="pane-body">

                ${s.sources.length > 0 ? html`
                  <div class="sources-list">
                    <div class="field-label" style="margin-bottom:8px">Scan sources</div>
                    ${s.sources.map((src, i) => html`
                      <div class="source-chip">
                        <span class="source-chip-name">${src.Name}</span>
                        <span class="source-chip-path">${src.RootPath}</span>
                        <button class="source-chip-remove" @click=${() => this._removeSource(i)}>×</button>
                      </div>
                    `)}
                  </div>
                ` : nothing}

                ${s.selectedPreset ? html`
                  ${s.sources.length > 0 ? html`<div class="pane-divider">New source</div>` : nothing}

                  <div class="field">
                    <label class="field-label">Source name</label>
                    <input class="field-input" .value=${s.name} placeholder="e.g. React"
                           @input=${(e: Event) => { this._setup = { ...s, name: (e.target as HTMLInputElement).value }; }} />
                  </div>
                  <div class="field">
                    <label class="field-label">Root path <span class="field-hint">relative to ContentRootPath</span></label>
                    <input class="field-input mono" .value=${s.rootPath} placeholder="../frontend/src"
                           @input=${(e: Event) => { this._setup = { ...s, rootPath: (e.target as HTMLInputElement).value }; }} />
                  </div>
                  <div class="field">
                    <label class="field-label">File patterns <span class="field-hint">comma-separated</span></label>
                    <input class="field-input mono" .value=${s.filePatterns} placeholder="*.tsx, *.ts, *.js"
                           @input=${(e: Event) => { this._setup = { ...s, filePatterns: (e.target as HTMLInputElement).value }; }} />
                  </div>

                  ${s.selectedPreset === 'custom' ? html`
                    <div class="generator">
                      <div class="generator-title">Generate key pattern</div>
                      <div class="field">
                        <label class="field-label">Translation convention</label>
                        <input class="field-input mono" .value=${s.example}
                               placeholder=${examplePlaceholder}
                               @input=${this._onExampleInput} />
                        <span class="generator-hint">
                          Replace the translation key with <code>${KEY_MARKER}</code> and the pattern updates automatically.
                        </span>
                      </div>
                    </div>
                  ` : nothing}

                  <div class="field">
                    <label class="field-label">Key pattern <span class="field-hint">regex, group 1 = key</span></label>
                    <input class="field-input mono" .value=${s.keyPattern} placeholder="regex pattern"
                           @input=${(e: Event) => { this._setup = { ...s, keyPattern: (e.target as HTMLInputElement).value }; }} />
                  </div>

                  <div class="form-actions">
                    <button class="add-source-btn" ?disabled=${!this._canAddSource()} @click=${this._addSource}>
                      + Add source
                    </button>
                  </div>
                ` : nothing}

                <div class="global-settings">
                  <div class="pane-divider">Global settings</div>
                  <div class="field">
                    <label class="field-label">Excluded directories <span class="field-hint">comma-separated</span></label>
                    <input class="field-input mono" .value=${s.excludedDirectories}
                           @input=${(e: Event) => { this._setup = { ...s, excludedDirectories: (e.target as HTMLInputElement).value }; }} />
                  </div>
                  <div class="field">
                    <label class="field-label">Cache duration <span class="field-hint">minutes, 0 = off</span></label>
                    <input class="field-input narrow" type="number" min="0" .value=${String(s.cacheDurationMinutes)}
                           @input=${(e: Event) => { this._setup = { ...s, cacheDurationMinutes: Number((e.target as HTMLInputElement).value) }; }} />
                  </div>
                </div>

              </div>
            </div>

            <div class="snippet-pane">
              <div class="pane-header">
                appsettings.json
                <button class="snippet-copy-btn ${s.copied ? 'copied' : ''}" @click=${this._copySnippet}>
                  ${s.copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <pre class="snippet-pre">${this._generatedSnippet()}</pre>
            </div>
          </div>
        ` : nothing}
      </div>
    `;
  }

  private _renderDashboard(): TemplateResult {
    const d = this._data!;
    return html`
      <div class="dashboard">
        ${this._error ? html`<div class="error">${this._error}</div>` : nothing}

        <div class="scan-bar">
          <div class="scan-sources">
            ${d.diagnostics.map(diag => html`
              <span class="scan-source">
                <span class="scan-dot ${diag.exists ? 'dot-ok' : 'dot-warn'}"></span>
                <span class="scan-source-name">${diag.source}</span>
                <span class="scan-filecount">${diag.patternMatchedFiles} files</span>
              </span>
            `)}
          </div>
          <div class="scan-right">
            <span class="health-badge ${this._healthClass()}">${this._healthLabel()}</span>
            <span class="scanned-at">${this._timeAgo()}</span>
            <button class="rescan-btn" @click=${() => this._scan(true)}>↻ Rescan</button>
          </div>
        </div>

        <div class="summary">
          <div class="stat">
            <span class="stat-value">${d.summary.dictionaryCount}</span>
            <span class="stat-label">Dictionary keys</span>
            <span class="stat-sub">total in Umbraco</span>
          </div>
          <div class="stat stat-ok">
            <span class="stat-value">${d.summary.usedCount}</span>
            <span class="stat-label">Used in code</span>
            <span class="stat-sub">found in sources</span>
          </div>
          <div class="stat ${d.summary.unusedCount > 0 ? 'stat-warn' : 'stat-ok'}">
            <span class="stat-value">${d.summary.unusedCount}</span>
            <span class="stat-label">Unused</span>
            <span class="stat-sub">safe to remove</span>
          </div>
          <div class="stat ${d.summary.missingCount > 0 ? 'stat-danger' : 'stat-ok'}">
            <span class="stat-value">${d.summary.missingCount}</span>
            <span class="stat-label">Missing</span>
            <span class="stat-sub">not in dictionary</span>
          </div>
        </div>

        <div class="toolbar">
          <input class="search" type="search" placeholder="Filter keys…"
                 .value=${this._filter}
                 @input=${(e: Event) => { this._filter = (e.target as HTMLInputElement).value; }} />
        </div>

        <div class="tabs">
          <button class="tab ${this._activeTab === 'unused' ? 'active' : ''}"
                  @click=${() => { this._activeTab = 'unused'; }}>
            Unused <span class="badge">${d.summary.unusedCount}</span>
          </button>
          <button class="tab ${this._activeTab === 'missing' ? 'active' : ''}"
                  @click=${() => { this._activeTab = 'missing'; }}>
            Missing <span class="badge">${d.summary.missingCount}</span>
          </button>
          <button class="tab ${this._activeTab === 'completeness' ? 'active' : ''}"
                  @click=${this._openCompleteness}>
            Completeness
            ${this._completeness ? html`<span class="badge">${this._completeness.summary.incompleteCount}</span>` : nothing}
          </button>
          <button class="tab ${this._activeTab === 'all' ? 'active' : ''}"
                  @click=${() => { this._activeTab = 'all'; }}>
            All keys <span class="badge">${d.summary.dictionaryCount}</span>
          </button>
        </div>

        ${this._activeTab === 'unused' ? this._renderUnused() : nothing}
        ${this._activeTab === 'missing' ? this._renderMissing() : nothing}
        ${this._activeTab === 'completeness' ? this._renderCompleteness() : nothing}
        ${this._activeTab === 'all' ? this._renderAllKeys() : nothing}
      </div>
    `;
  }

  private _renderUnused(): TemplateResult {
    const items = this._filteredUnused();
    if (!items.length) return html`<p class="empty">${this._filter ? 'No matches.' : 'No unused keys.'}</p>`;
    const allSelected = items.every(i => this._selectedUnused.has(i.id));
    return html`
      <div class="bulk-bar">
        <label class="checkbox-label">
          <input type="checkbox" .checked=${allSelected} @change=${this._toggleAllUnused} /> Select all
        </label>
        <button class="btn-danger btn-sm" ?disabled=${this._selectedUnused.size === 0} @click=${this._deleteSelected}>
          Delete (${this._selectedUnused.size})
        </button>
      </div>
      <table class="tm-table">
        <thead><tr><th class="col-check"></th><th>Key</th><th class="col-action"></th></tr></thead>
        <tbody>
          ${items.map(item => html`
            <tr class="${this._selectedUnused.has(item.id) ? 'selected' : ''}">
              <td><input type="checkbox" .checked=${this._selectedUnused.has(item.id)}
                         @change=${() => this._toggleSelectUnused(item.id)} /></td>
              <td><code>${item.key}</code></td>
              <td><a class="icon-btn" href="/umbraco/section/translation/workspace/dictionary/edit/${item.id}" title="Go to dictionary">✎</a></td>
            </tr>
          `)}
        </tbody>
      </table>
    `;
  }

  private _renderMissing(): TemplateResult {
    const items = this._filteredMissing();
    if (!items.length) return html`<p class="empty">${this._filter ? 'No matches.' : 'No missing keys.'}</p>`;
    return html`
      <table class="tm-table">
        <thead><tr><th>Key</th><th>Referenced in</th><th class="col-action"></th></tr></thead>
        <tbody>
          ${items.map(item => html`
            <tr>
              <td><code>${item.key}</code></td>
              <td>
                ${item.sources.map(src => html`
                  <div class="source-group">
                    <span class="source-name">${src.name}</span>
                    <div class="files">${src.files.map(f => html`<span class="file">${f}</span>`)}</div>
                  </div>
                `)}
              </td>
              <td>
                <button class="icon-btn ${this._expandedMissing.has(item.key) ? 'active' : ''}"
                        @click=${() => this._toggleAddKey(item.key)}>+</button>
              </td>
            </tr>
            ${this._expandedMissing.has(item.key) ? html`
              <tr class="add-row">
                <td colspan="3">
                  <div class="add-form">
                    <div class="add-fields">
                      ${this._data!.cultures.map(c => html`
                        <div class="add-field">
                          <label class="add-label">${c.name}</label>
                          <input class="add-input" type="text"
                                 .value=${this._newKeyValues[item.key]?.[c.isoCode] ?? ''}
                                 placeholder=${c.isoCode}
                                 @input=${(e: Event) => this._setNewKeyValue(item.key, c.isoCode, (e.target as HTMLInputElement).value)} />
                        </div>
                      `)}
                    </div>
                    ${this._aiAvailable ? html`
                      <div class="ai-bar">
                        <button class="btn-ai btn-sm"
                                ?disabled=${this._suggestingKey === item.key}
                                @click=${() => this._suggestTranslations(item.key)}>
                          ${this._suggestingKey === item.key ? html`<span class="ai-spinner"></span> Suggesting…` : '✦ Suggest with AI'}
                        </button>
                        ${this._suggestError && this._suggestingKey !== item.key ? html`<span class="ai-error">${this._suggestError}</span>` : nothing}
                      </div>
                    ` : nothing}
                    <div class="add-actions">
                      <button class="btn-primary btn-sm" ?disabled=${this._savingKey.has(item.key)}
                              @click=${() => this._saveKey(item.key)}>
                        ${this._savingKey.has(item.key) ? 'Saving…' : 'Add to dictionary'}
                      </button>
                      <button class="btn-sm" @click=${() => this._toggleAddKey(item.key)}>Cancel</button>
                    </div>
                  </div>
                </td>
              </tr>
            ` : nothing}
          `)}
        </tbody>
      </table>
    `;
  }

  private _renderCompleteness(): TemplateResult {
    if (this._loadingCompleteness) return html`<div class="loading"><div class="spinner"></div></div>`;
    if (!this._completeness) return html``;
    const c = this._completeness;
    const items = this._filteredIncomplete();
    return html`
      <div class="completeness-summary">
        <span class="text-ok">${c.summary.completeCount} fully translated</span>
        ${c.summary.incompleteCount > 0
          ? html`<span class="text-warn">${c.summary.incompleteCount} incomplete</span>`
          : html`<span class="text-ok">All keys have translations for all languages</span>`}
      </div>
      <div class="toolbar">
        <input class="search" type="search" placeholder="Filter keys…"
               .value=${this._completenessFilter}
               @input=${(e: Event) => { this._completenessFilter = (e.target as HTMLInputElement).value; }} />
      </div>
      ${!items.length
        ? html`<p class="empty">${this._completenessFilter ? 'No matches.' : 'All keys are fully translated.'}</p>`
        : html`
          <table class="tm-table">
            <thead>
              <tr>
                <th>Key</th>
                ${c.cultures.map(cu => html`<th>${cu.name}</th>`)}
                <th class="col-action"></th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => html`
                <tr>
                  <td><code>${item.key}</code></td>
                  ${c.cultures.map(cu => html`
                    <td>
                      ${item.translations[cu.isoCode]
                        ? html`<span class="translation-value" title=${item.translations[cu.isoCode]}>${item.translations[cu.isoCode]}</span>`
                        : html`<span class="missing-badge">missing</span>`}
                    </td>
                  `)}
                  <td><a class="icon-btn" href="/umbraco/section/translation/workspace/dictionary/edit/${item.id}" title="Edit">✎</a></td>
                </tr>
              `)}
            </tbody>
          </table>
        `}
    `;
  }

  private _renderAllKeys(): TemplateResult {
    const items = this._filteredAll();
    if (!items.length) return html`<p class="empty">No matches.</p>`;
    return html`
      <table class="tm-table">
        <thead><tr><th>Key</th><th>Status</th><th>Files</th><th class="col-action"></th></tr></thead>
        <tbody>
          ${items.map(item => html`
            <tr>
              <td><code>${item.key}</code></td>
              <td><span class="badge-status ${item.used ? 'badge-used' : 'badge-unused'}">${item.used ? item.sources.map(s => s.name).join(' + ') : 'Unused'}</span></td>
              <td>
                ${item.sources.map(src => html`
                  <div class="source-group">
                    <span class="source-name">${src.name}</span>
                    <div class="files">${src.files.map(f => html`<span class="file">${f}</span>`)}</div>
                  </div>
                `)}
              </td>
              <td><a class="icon-btn" href="/umbraco/section/translation/workspace/dictionary/edit/${item.id}" title="Edit">✎</a></td>
            </tr>
          `)}
        </tbody>
      </table>
    `;
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  static styles = css`
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
}

customElements.define('tm-dashboard', TmDashboardElement);

export default TmDashboardElement;
