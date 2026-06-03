// Angular translate pipe pattern: 'key' | translate
//
// Add this scan source to appsettings.json to pick up Angular templates:
// {
//   "Name": "Angular",
//   "RootPath": "../frontend/src/patterns",
//   "FilePatterns": ["*.ts", "*.html"],
//   "KeyPattern": "'([^']+)'\\s*\\|\\s*translate"
// }

// Simulated Angular template strings — the scanner extracts keys via regex
// regardless of file type, so the pattern is exercised here.
export const angularTemplates = {
  header: `
    <h1>{{ 'site.name' | translate }}</h1>
    <p>{{ 'hero.subtitle' | translate }}</p>
  `,
  footer: `
    <footer>{{ 'footer.copyright' | translate }}</footer>
    <span>{{ 'angular.example.version' | translate }}</span>
  `,
}
