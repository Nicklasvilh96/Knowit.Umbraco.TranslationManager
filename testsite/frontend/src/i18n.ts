import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

// Seed translations so the app renders without a backend call.
// In a real project these would be loaded from /umbraco/api/... at runtime.
const en: Record<string, string> = {
  'site.name': 'Translation Manager Test Site',
  'nav.home': 'Home',
  'nav.about': 'About',
  'nav.contact': 'Contact',
  'hero.title': 'Testing the Translation Manager',
  'hero.subtitle': 'This frontend exercises translation key scanning across multiple frameworks.',
  'hero.cta': 'Open Translation Manager',
  'footer.copyright': '© 2026 Knowit',
  // contact.* keys are intentionally absent from the Umbraco dictionary
  // so they show up as "Missing from dictionary" in the dashboard.
}

i18next
  .use(initReactI18next)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  })

export default i18next
