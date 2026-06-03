using Knowit.Umbraco.TranslationManager.TestSite.Seeders;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Notifications;

namespace Knowit.Umbraco.TranslationManager.TestSite.Composers;

public class SeedComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.AddNotificationHandler<UmbracoApplicationStartedNotification, DictionarySeeder>();
    }
}
