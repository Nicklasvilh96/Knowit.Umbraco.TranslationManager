import { useTranslation } from 'react-i18next'

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer>
      <p>{t("footer.company")}</p>
      <p>{t("footer.copyright")}</p>
    </footer>
  )
}
