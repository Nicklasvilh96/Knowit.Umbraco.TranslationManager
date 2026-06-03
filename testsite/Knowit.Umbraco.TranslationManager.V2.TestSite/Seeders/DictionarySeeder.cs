using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Services;

namespace Knowit.Umbraco.TranslationManager.V2.TestSite.Seeders;

public class DictionarySeeder : INotificationAsyncHandler<UmbracoApplicationStartedNotification>
{
    private readonly ILanguageService _languageService;
    private readonly IDictionaryItemService _dictionaryItemService;
    private readonly ILogger<DictionarySeeder> _logger;

    public DictionarySeeder(
        ILanguageService languageService,
        IDictionaryItemService dictionaryItemService,
        ILogger<DictionarySeeder> logger)
    {
        _languageService = languageService;
        _dictionaryItemService = dictionaryItemService;
        _logger = logger;
    }

    public async Task HandleAsync(UmbracoApplicationStartedNotification notification, CancellationToken cancellationToken)
    {
        try
        {
            await SeedAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DictionarySeeder failed");
        }
    }

    private async Task SeedAsync()
    {
        var english = (await _languageService.GetAllAsync())
            .FirstOrDefault(l => l.CultureInfo?.TwoLetterISOLanguageName == "en");

        if (english is null)
        {
            _logger.LogWarning("DictionarySeeder: no English language found, skipping");
            return;
        }

        var ids = new Dictionary<string, Guid>();

        async Task<Guid> Folder(string key, string? parentKey = null)
        {
            if (await _dictionaryItemService.ExistsAsync(key))
            {
                var existing = await _dictionaryItemService.GetAsync(key);
                return ids[key] = existing!.Key;
            }

            var parentId = parentKey is not null && ids.TryGetValue(parentKey, out var pid) ? pid : (Guid?)null;
            var item = new DictionaryItem(parentId, key);
            var result = await _dictionaryItemService.CreateAsync(item, Constants.Security.SuperUserKey);

            if (!result.Success)
            {
                _logger.LogError("DictionarySeeder: failed to create folder '{Key}' — status: {Status}", key, result.Status);
                return Guid.Empty;
            }

            return ids[key] = result.Result!.Key;
        }

        async Task Item(string key, string value, string parentKey)
        {
            if (await _dictionaryItemService.ExistsAsync(key))
            {
                var existing = await _dictionaryItemService.GetAsync(key);
                ids[key] = existing!.Key;
                return;
            }

            if (!ids.TryGetValue(parentKey, out var parentId) || parentId == Guid.Empty)
            {
                _logger.LogError("DictionarySeeder: parent '{ParentKey}' not found for '{Key}'", parentKey, key);
                return;
            }

            var item = new DictionaryItem(parentId, key);
            item.Translations = new List<IDictionaryTranslation> { new DictionaryTranslation(english, value) };
            var result = await _dictionaryItemService.CreateAsync(item, Constants.Security.SuperUserKey);

            if (!result.Success)
            {
                _logger.LogError("DictionarySeeder: failed to create '{Key}' — status: {Status}", key, result.Status);
                return;
            }

            ids[key] = result.Result!.Key;
        }

        await Folder("site");
        await Item("site.name",        "Translation Manager Test",                        "site");
        await Item("site.tagline",     "Keys in sync",                                    "site");
        await Item("site.description", "A test site for the Translation Manager package", "site");

        await Folder("nav");
        await Item("nav.home",     "Home",     "nav");
        await Item("nav.about",    "About",    "nav");
        await Item("nav.contact",  "Contact",  "nav");
        await Item("nav.services", "Services", "nav");
        await Item("nav.blog",     "Blog",     "nav");
        await Item("nav.login",    "Login",    "nav");

        await Folder("hero");
        await Item("hero.title",    "Testing the Translation Manager",                 "hero");
        await Item("hero.subtitle", "This site exercises translation key scanning.",   "hero");
        await Item("hero.cta",      "Open Translation Manager",                       "hero");
        await Item("hero.badge",    "Beta",                                            "hero");

        await Folder("footer");
        await Item("footer.copyright", "© 2026 Knowit",   "footer");
        await Item("footer.company",   "Knowit A/S",       "footer");
        await Item("footer.privacy",   "Privacy Policy",   "footer");
        await Item("footer.terms",     "Terms of Service", "footer");

        await Folder("buttons");
        await Item("buttons.submit", "Submit",  "buttons");
        await Item("buttons.cancel", "Cancel",  "buttons");
        await Item("buttons.save",   "Save",    "buttons");
        await Item("buttons.delete", "Delete",  "buttons");
        await Item("buttons.edit",   "Edit",    "buttons");
        await Item("buttons.back",   "Go back", "buttons");

        await Folder("errors");
        await Item("errors.notfound",     "Page not found",                  "errors");
        await Item("errors.servererror",  "Something went wrong",            "errors");
        await Item("errors.unauthorized", "Access denied",                   "errors");
        await Item("errors.validation",   "Please correct the errors below", "errors");
        await Item("errors.timeout",      "Request timed out",               "errors");

        await Folder("forms");
        await Item("forms.required",      "This field is required",      "forms");
        await Item("forms.invalid.email", "Please enter a valid email",  "forms");
        await Item("forms.success",       "Form submitted successfully", "forms");
        await Item("forms.loading",       "Loading…",                    "forms");
        await Item("forms.submit",        "Submit form",                 "forms");
        await Item("forms.reset",         "Reset form",                  "forms");

        await Folder("dashboard");
        await Item("dashboard.title",   "Dashboard",       "dashboard");
        await Item("dashboard.welcome", "Welcome back",    "dashboard");
        await Item("dashboard.stats",   "Statistics",      "dashboard");
        await Item("dashboard.recent",  "Recent activity", "dashboard");

        await Folder("meta");
        await Folder("meta.title",       "meta");
        await Folder("meta.description", "meta");
        await Folder("meta.og",          "meta");
        await Item("meta.title.default",       "Translation Manager Test",                        "meta.title");
        await Item("meta.description.default", "Test site for Knowit.Umbraco.TranslationManager", "meta.description");
        await Item("meta.og.title",            "Translation Manager",                             "meta.og");

        await Folder("accessibility");
        await Item("accessibility.skip",    "Skip to main content", "accessibility");
        await Item("accessibility.menu",    "Toggle navigation",    "accessibility");
        await Item("accessibility.close",   "Close",                "accessibility");
        await Item("accessibility.loading", "Loading content",      "accessibility");

        _logger.LogInformation("DictionarySeeder: completed successfully");
    }
}
