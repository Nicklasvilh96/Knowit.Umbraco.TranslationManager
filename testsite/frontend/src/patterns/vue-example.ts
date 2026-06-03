// Vue i18n pattern: $t("key")
//
// Add this scan source to appsettings.json to pick up Vue files:
// {
//   "Name": "Vue",
//   "RootPath": "../frontend/src/patterns",
//   "FilePatterns": ["*.vue", "*.ts"],
//   "KeyPattern": "\\$t\\(\"([^\"]+)\""
// }

// Simulated Vue component usage — the scanner finds keys in any file type,
// so these calls are picked up even without a real .vue file.
export function simulatedVueUsage() {
  const $t = (key: string) => key

  const title = $t("site.name")
  const subtitle = $t("hero.subtitle")
  const vueCta = $t("vue.example.cta")           // missing from dictionary
  const vueNotice = $t("vue.example.notice")     // missing from dictionary

  return { title, subtitle, vueCta, vueNotice }
}
