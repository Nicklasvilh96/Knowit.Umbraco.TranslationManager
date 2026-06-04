# Knowit.Umbraco.TranslationManager

> **Two versions are available:**
> - **v1** (`1.x`): targets **Umbraco 13** (.NET 8). Install with `dotnet add package Knowit.Umbraco.TranslationManager --version 1.*`
> - **v2** (`2.x`): targets **Umbraco 17+** (.NET 10), with a Lit/Web Component dashboard and optional AI suggestions. Install with `dotnet add package Knowit.Umbraco.TranslationManager`

A backoffice dashboard for Umbraco that compares your Umbraco dictionary against how translation keys are actually used in your codebase. It surfaces unused keys, keys referenced in code that are missing from the dictionary, and languages with incomplete translations.

Designed as a developer tool. The dashboard is disabled in production by default. A setup wizard guides first-time configuration and generates the `appsettings.json` snippet, with support for multiple scan sources and a live preview.

## Requirements

- Umbraco 13.4 or later (v1) / Umbraco 17 or later (v2)
- .NET 8 (v1) / .NET 10 (v2)

## Installation

```
dotnet add package Knowit.Umbraco.TranslationManager
```

No changes to `Program.cs` or `Startup.cs` needed. The package registers itself on startup.

## Configuration

Add a `TranslationManager` section to `appsettings.json`. The first time you open the dashboard without any configuration, a setup wizard will guide you through it and generate the snippet to paste.

If you prefer to configure manually:

```json
"TranslationManager": {
  "ScanSources": [
    {
      "Name": "Razor",
      "RootPath": ".",
      "FilePatterns": ["*.cshtml", "*.cs"],
      "KeyPattern": "GetDictionaryValue(?:OrDefault)?\\(\\s*\"([^\"]+)\""
    }
  ]
}
```

`RootPath` is relative to the Umbraco content root. Add as many sources as your project needs.

## Scan source examples

**React / i18next**: matches `t("some.key")`
```json
{
  "Name": "React",
  "RootPath": "../frontend/src",
  "FilePatterns": ["*.tsx", "*.ts", "*.jsx", "*.js"],
  "KeyPattern": "\\bt\\(['\"]([^'\"]+)['\"]\\)"
}
```

**Vue / vue-i18n**: matches `$t("some.key")`
```json
{
  "Name": "Vue",
  "RootPath": "../frontend/src",
  "FilePatterns": ["*.vue", "*.ts", "*.js"],
  "KeyPattern": "\\$t\\(['\"]([^'\"]+)['\"]\\)"
}
```

**Angular / ngx-translate**: matches `'some.key' | translate`
```json
{
  "Name": "Angular",
  "RootPath": "../frontend/src",
  "FilePatterns": ["*.ts", "*.html"],
  "KeyPattern": "'([^']+)'\\s*\\|\\s*translate"
}
```

**Constants class**: for projects where dictionary keys are referenced through a C# constants class rather than inline strings
```json
{
  "Name": "C#",
  "RootPath": ".",
  "FilePatterns": ["*.cs", "*.cshtml"],
  "KeyPattern": "GetDictionaryValue(?:OrDefault)?\\(\\s*\\w+\\.(\\w+)",
  "ConstantsPattern": "const string (\\w+)\\s*=\\s*\"([^\"]+)\""
}
```

`ConstantsPattern` takes two capturing groups: the constant name and its string value. The scanner builds a lookup table first, then resolves captured identifiers through it.

## Options

```json
"TranslationManager": {
  "CacheDurationMinutes": 5,
  "ExcludedDirectories": ["node_modules", "bin", "obj", ".git", "dist", "wwwroot"],
  "ExcludedDictionaryRoots": ["Umbraco", "backoffice"],
  "ScanSources": []
}
```

| Option | Default | Description |
|---|---|---|
| `CacheDurationMinutes` | `5` | How long scan results are cached. Set to `0` to disable |
| `ExcludedDirectories` | see above | Directory names skipped during file traversal |
| `ExcludedDictionaryRoots` | `[]` | Root dictionary keys whose children are excluded from all results. Useful for backoffice-only keys (field labels, property descriptions) that should not be treated as missing or unused. Matched as exact root or any key starting with `root.` |

### Excluding backoffice dictionary keys

Some projects use Umbraco dictionary keys exclusively for backoffice labels — content type field names, property descriptions, and similar editor-facing strings. These are not frontend translation keys and should not appear as unused or missing in the dashboard.

Use `ExcludedDictionaryRoots` to exclude an entire root and all its descendants:

```json
"TranslationManager": {
  "ExcludedDictionaryRoots": ["Umbraco", "backoffice"],
  "ScanSources": [...]
}
```

This excludes `Umbraco`, `Umbraco.ContentTypes.PageTitle`, `backoffice.labels.name`, etc. — but not `UmbracoForms.something` (prefix matching requires an exact root or `root.` boundary).

The setup wizard lists your existing dictionary roots as checkboxes and automatically includes the setting in the generated `appsettings.json` snippet.

## Dashboard

Once configured, a **Translation Manager** section appears in the Umbraco backoffice.

**Unused**: dictionary keys that exist but are not referenced in any configured source. Select any number and delete them in bulk.

**Missing**: keys referenced in code that do not exist in the dictionary. Expand any row to add the key with translations for each configured language.

**Completeness**: keys that exist in the dictionary but are missing a translation for one or more languages.

**All keys**: full overview with source badges showing where each key is used. Every row links to the key in the Umbraco dictionary editor.

## v2 differences (Umbraco 17+)

v2 replaces the AngularJS dashboard with a **Lit/Web Component** UI that is compatible with Umbraco 14 and later. Additional changes:

- Optional integration with **Umbraco.AI** provides translation suggestions when adding missing keys.
- Targets `net10.0` and requires Umbraco 17 or later.
- The NuGet package ID is unchanged (`Knowit.Umbraco.TranslationManager`); v2 is the default (latest) version.
