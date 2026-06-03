using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Services;

namespace Knowit.Umbraco.TranslationManager.TestSite.Seeders;

/// <summary>
/// Seeds test dictionary items on startup. Idempotent — skips keys that already exist.
///
/// Scenarios exercised:
///   USED   — key exists in dictionary AND referenced in at least one scan source
///   UNUSED — key exists in dictionary but NOT referenced anywhere in code
///   MISSING — key referenced in code but NOT in the dictionary (contact.*, vue.example.*, angular.example.*)
/// </summary>
public class DictionarySeeder : INotificationHandler<UmbracoApplicationStartedNotification>
{
    private readonly ILocalizationService _localizationService;

    public DictionarySeeder(ILocalizationService localizationService)
    {
        _localizationService = localizationService;
    }

    public void Handle(UmbracoApplicationStartedNotification notification) => Seed();

    private void Seed()
    {
        var english = _localizationService.GetAllLanguages()
            .FirstOrDefault(l => l.CultureInfo.TwoLetterISOLanguageName == "en");

        if (english is null) return;

        var ids = new Dictionary<string, Guid>();

        // ── helpers ────────────────────────────────────────────────────────────

        IDictionaryItem Folder(string key, string? parentKey = null)
        {
            if (_localizationService.DictionaryItemExists(key))
            {
                var e = _localizationService.GetDictionaryItemByKey(key)!;
                ids[key] = e.Key;
                return e;
            }

            var parentId = parentKey is not null && ids.TryGetValue(parentKey, out var pid) ? pid : (Guid?)null;
            var item = _localizationService.CreateDictionaryItemWithIdentity(key, parentId);
            ids[key] = item.Key;
            return item;
        }

        IDictionaryItem Item(string key, string value, string parentKey)
        {
            if (_localizationService.DictionaryItemExists(key))
            {
                var e = _localizationService.GetDictionaryItemByKey(key)!;
                ids[key] = e.Key;
                return e;
            }

            var parentId = ids.TryGetValue(parentKey, out var pid) ? pid : (Guid?)null;
            var item = _localizationService.CreateDictionaryItemWithIdentity(key, parentId);
            _localizationService.AddOrUpdateDictionaryValue(item, english, value);
            _localizationService.Save(item);
            ids[key] = item.Key;
            return item;
        }

        // ── site/ ──────────────────────────────────────────────────────────────
        // Used: site.name → React, Vue, Angular
        //       site.tagline → React
        // Unused: site.description

        Folder("site");
        Item("site.name",        "Translation Manager Test",                        "site");
        Item("site.tagline",     "Keys in sync",                                    "site");
        Item("site.description", "A test site for the Translation Manager package", "site"); // UNUSED

        // ── nav/ ───────────────────────────────────────────────────────────────
        // Used: nav.home → React, Vue, Angular
        //       nav.about, nav.contact → React
        //       nav.login → Razor
        // Unused: nav.services, nav.blog

        Folder("nav");
        Item("nav.home",     "Home",     "nav");
        Item("nav.about",    "About",    "nav");
        Item("nav.contact",  "Contact",  "nav");
        Item("nav.services", "Services", "nav"); // UNUSED
        Item("nav.blog",     "Blog",     "nav"); // UNUSED
        Item("nav.login",    "Login",    "nav");

        // ── hero/ ──────────────────────────────────────────────────────────────
        // Used: hero.title → React
        //       hero.subtitle → React, Vue, Angular
        //       hero.cta → React, Vue
        // Unused: hero.badge

        Folder("hero");
        Item("hero.title",    "Testing the Translation Manager",                     "hero");
        Item("hero.subtitle", "This frontend exercises translation key scanning.",   "hero");
        Item("hero.cta",      "Open Translation Manager",                           "hero");
        Item("hero.badge",    "Beta",                                               "hero"); // UNUSED

        // ── footer/ ────────────────────────────────────────────────────────────
        // Used: footer.copyright → React, Vue, Angular
        //       footer.company → React
        // Unused: footer.privacy, footer.terms

        Folder("footer");
        Item("footer.copyright", "© 2026 Knowit",   "footer");
        Item("footer.company",   "Knowit A/S",       "footer");
        Item("footer.privacy",   "Privacy Policy",   "footer"); // UNUSED
        Item("footer.terms",     "Terms of Service", "footer"); // UNUSED

        // ── buttons/ ───────────────────────────────────────────────────────────
        // Used: buttons.submit, buttons.cancel, buttons.back → Razor
        //       buttons.save → Razor + React
        // Unused: buttons.delete, buttons.edit

        Folder("buttons");
        Item("buttons.submit", "Submit",  "buttons");
        Item("buttons.cancel", "Cancel",  "buttons");
        Item("buttons.save",   "Save",    "buttons");
        Item("buttons.delete", "Delete",  "buttons"); // UNUSED
        Item("buttons.edit",   "Edit",    "buttons"); // UNUSED
        Item("buttons.back",   "Go back", "buttons");

        // ── errors/ ────────────────────────────────────────────────────────────
        // Used: errors.notfound, errors.unauthorized → Razor
        // Unused: errors.servererror, errors.validation, errors.timeout

        Folder("errors");
        Item("errors.notfound",     "Page not found",                  "errors");
        Item("errors.servererror",  "Something went wrong",            "errors"); // UNUSED
        Item("errors.unauthorized", "Access denied",                   "errors");
        Item("errors.validation",   "Please correct the errors below", "errors"); // UNUSED
        Item("errors.timeout",      "Request timed out",               "errors"); // UNUSED

        // ── forms/ ─────────────────────────────────────────────────────────────
        // Used: forms.required, forms.invalid.email → Razor
        //       forms.loading → React
        //       forms.submit → Razor + React
        // Unused: forms.success, forms.reset

        Folder("forms");
        Item("forms.required",      "This field is required",         "forms");
        Item("forms.invalid.email", "Please enter a valid email",     "forms");
        Item("forms.success",       "Form submitted successfully",    "forms"); // UNUSED
        Item("forms.loading",       "Loading…",                  "forms");
        Item("forms.submit",        "Submit form",                    "forms");
        Item("forms.reset",         "Reset form",                     "forms"); // UNUSED

        // ── dashboard/ ─────────────────────────────────────────────────────────
        // Used: dashboard.welcome → Razor
        // Unused: dashboard.title, dashboard.stats, dashboard.recent

        Folder("dashboard");
        Item("dashboard.title",   "Dashboard",       "dashboard"); // UNUSED
        Item("dashboard.welcome", "Welcome back",    "dashboard");
        Item("dashboard.stats",   "Statistics",      "dashboard"); // UNUSED
        Item("dashboard.recent",  "Recent activity", "dashboard"); // UNUSED

        // ── meta/ ──────────────────────────────────────────────────────────────
        // All unused — demonstrates 3-level nesting in the backoffice

        Folder("meta");
        Folder("meta.title",       "meta");
        Folder("meta.description", "meta");
        Folder("meta.og",          "meta");
        Item("meta.title.default",       "Translation Manager Test",                        "meta.title");       // UNUSED
        Item("meta.description.default", "Test site for Knowit.Umbraco.TranslationManager", "meta.description"); // UNUSED
        Item("meta.og.title",            "Translation Manager",                             "meta.og");          // UNUSED

        // ── accessibility/ ─────────────────────────────────────────────────────
        // Used: accessibility.menu → Razor
        //       accessibility.close → React
        // Unused: accessibility.skip, accessibility.loading

        Folder("accessibility");
        Item("accessibility.skip",    "Skip to main content", "accessibility"); // UNUSED
        Item("accessibility.menu",    "Toggle navigation",    "accessibility");
        Item("accessibility.close",   "Close",                "accessibility");
        Item("accessibility.loading", "Loading content",      "accessibility"); // UNUSED
    }
}
