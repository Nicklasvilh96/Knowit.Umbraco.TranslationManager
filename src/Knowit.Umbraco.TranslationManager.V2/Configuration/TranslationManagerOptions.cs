namespace Knowit.Umbraco.TranslationManager.Configuration;

public class TranslationManagerOptions
{
    public const string SectionName = "TranslationManager";

    public bool DisableInProduction { get; set; } = true;

    public List<string> ExcludedDirectories { get; set; } =
    [
        "node_modules", "bin", "obj", ".git", "dist", ".vite", "wwwroot"
    ];

    public int CacheDurationMinutes { get; set; } = 5;

    public List<ScanSourceOptions> ScanSources { get; set; } = [];
}
