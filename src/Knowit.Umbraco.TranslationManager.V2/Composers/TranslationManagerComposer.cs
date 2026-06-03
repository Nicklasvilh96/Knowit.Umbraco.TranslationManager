using Knowit.Umbraco.TranslationManager.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;

namespace Knowit.Umbraco.TranslationManager.Composers;

public class TranslationManagerComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.Services.Configure<TranslationManagerOptions>(
            builder.Config.GetSection(TranslationManagerOptions.SectionName));
        builder.Services.AddMemoryCache();
    }
}
