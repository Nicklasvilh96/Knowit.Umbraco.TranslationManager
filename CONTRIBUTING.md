# Contributing

## Prerequisites

| Package | Requirement |
|---|---|
| v1 (Umbraco 13) | .NET 8 SDK, Visual Studio 2022 17.8+ |
| v2 (Umbraco 17) | .NET 10 SDK, Visual Studio 2022 17.14+ |


## Getting started

Clone the repo and open either solution in Visual Studio:

- `Knowit.Umbraco.TranslationManager.sln` (v1, Umbraco 13)
- `Knowit.Umbraco.TranslationManager.V2.sln` (v2, Umbraco 17)

### v2 frontend

The dashboard is a Lit/TypeScript component that must be built before running the test site:

```
cd src/Knowit.Umbraco.TranslationManager.V2/client
npm install
npm run build      # one-off build
npm run dev        # watch mode during development
```

The output lands in `App_Plugins/TranslationManager/dashboard.js` automatically.

### Test sites

Both test sites require completing the Umbraco install wizard on first run (empty database connection string triggers it). The v2 test site runs on `https://localhost:44302`.

> **Important:** Stop the test site before rebuilding the solution. The test site holds the package DLL open while running, which causes MSBuild to fail with a file lock error. This is normal .NET behaviour and only affects local development.

The `App_Plugins` folder in each test site is a directory junction pointing at the source. No rebuild is needed after changing dashboard files, just refresh the browser.
