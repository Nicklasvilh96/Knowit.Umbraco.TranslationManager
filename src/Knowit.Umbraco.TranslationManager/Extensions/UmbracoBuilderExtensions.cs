using Knowit.Umbraco.TranslationManager.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Umbraco.Cms.Core.DependencyInjection;

namespace Knowit.Umbraco.TranslationManager.Extensions;

public static class UmbracoBuilderExtensions
{
    /// <summary>
    /// Applies additional configuration on top of what is loaded from appsettings.json.
    /// The composer auto-registers the section and binds the config section — this method
    /// is only needed when you want to override options in code.
    /// </summary>
    public static IUmbracoBuilder AddTranslationManager(
        this IUmbracoBuilder builder,
        Action<TranslationManagerOptions> configure)
    {
        builder.Services.PostConfigure<TranslationManagerOptions>(configure);
        return builder;
    }
}
