import { useTranslation } from 'react-i18next'

export function Header() {
  const { t } = useTranslation()

  return (
    <header>
      <div>
        <strong>{t("site.name")}</strong>
        <span>{t("site.tagline")}</span>
      </div>
      <nav aria-label={t("accessibility.menu")}>
        <a href="/">{t("nav.home")}</a>
        <a href="/about">{t("nav.about")}</a>
        <a href="/contact">{t("nav.contact")}</a>
      </nav>
    </header>
  )
}
