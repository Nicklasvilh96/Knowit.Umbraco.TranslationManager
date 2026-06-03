import { useTranslation } from 'react-i18next'

export function Hero() {
  const { t } = useTranslation()

  return (
    <section>
      <h1>{t("hero.title")}</h1>
      <p>{t("hero.subtitle")}</p>
      <a href="/umbraco">{t("hero.cta")}</a>

      <div>
        <button>{t("buttons.save")}</button>
        <button>{t("accessibility.close")}</button>
      </div>

      <p>{t("forms.loading")}</p>

      {/*
        The keys below are intentionally NOT in the Umbraco dictionary.
        They appear as "Missing from dictionary" in the Translation Manager dashboard.
      */}
      <form>
        <label>{t("contact.form.name.label")}</label>
        <input placeholder={t("contact.form.name.placeholder")} />
        <label>{t("contact.form.email.label")}</label>
        <input placeholder={t("contact.form.email.placeholder")} />
        <button type="submit">{t("contact.form.submit.label")}</button>
      </form>

      <button type="submit">{t("forms.submit")}</button>
    </section>
  )
}
