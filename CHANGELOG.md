# Changelog

All notable changes to this project will be documented in this file.

## [2.1.0] - 2026-06-04

### Added
- `ExcludedDictionaryRoots` configuration option — exclude entire dictionary root trees (and their descendants) from scan and completeness results. Useful for backoffice-only keys that should not appear as unused or missing.
- Setup wizard now lists existing dictionary roots as checkboxes and includes `ExcludedDictionaryRoots` in the generated `appsettings.json` snippet when any roots are selected.
- New `GET /umbraco/api/translation-manager/dictionary-roots` endpoint returning all root dictionary keys.

## [1.1.0] - 2026-06-04

### Added
- `ExcludedDictionaryRoots` configuration option — exclude entire dictionary root trees (and their descendants) from scan and completeness results. Useful for backoffice-only keys that should not appear as unused or missing.
- Setup wizard now lists existing dictionary roots as checkboxes and includes `ExcludedDictionaryRoots` in the generated `appsettings.json` snippet when any roots are selected.
- New `GET /umbraco/api/translation-manager/dictionary-roots` endpoint returning all root dictionary keys.

## [2.0.1] - 2026-06-03

### Changed
- Improved NuGet package description

## [2.0.0] - 2026-06-03

### Added
- v2 package targeting Umbraco 17+ (net10.0)
- Lit/Web Component dashboard replacing AngularJS
- Setup wizard with framework presets and live config snippet generator
- Multi-source support in setup wizard
- Optional AI-powered translation suggestions via Umbraco.AI

## [1.0.0] - 2026-06-03

### Added
- Initial release targeting Umbraco 13 (net8.0)
- Dashboard with Unused, Missing, Completeness and All Keys tabs
- Setup wizard with framework presets
- Configurable scan sources with regex key extraction
- Bulk delete for unused keys
- Inline add-to-dictionary for missing keys
- Scan context bar with per-source diagnostics
