using Knowit.Umbraco.TranslationManager.V2.TestSite.Seeders;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Notifications;

namespace Knowit.Umbraco.TranslationManager.V2.TestSite.Composers;

public class SeedComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.AddNotificationAsyncHandler<UmbracoApplicationStartedNotification, DictionarySeeder>();
    }
}
