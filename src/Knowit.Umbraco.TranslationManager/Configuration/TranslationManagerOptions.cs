namespace Knowit.Umbraco.TranslationManager.Configuration;

public class TranslationManagerOptions
{
    public const string SectionName = "TranslationManager";

    /// <summary>Hides the scan endpoint in production environments. Default: true.</summary>
    public bool DisableInProduction { get; set; } = true;

    /// <summary>Directory names skipped during file traversal.</summary>
    public List<string> ExcludedDirectories { get; set; } =
    [
        "node_modules", "bin", "obj", ".git", "dist", ".vite", "wwwroot"
    ];

    /// <summary>
    /// How long (in minutes) to cache scan results. 0 disables caching.
    /// Use the Rescan button or ?force=true to bypass the cache at any time.
    /// </summary>
    public int CacheDurationMinutes { get; set; } = 5;

    /// <summary>
    /// Root dictionary keys whose children and descendants are excluded from scan and completeness results.
    /// Matched as exact root or key starting with root + ".".
    /// </summary>
    public List<string> ExcludedDictionaryRoots { get; set; } = [];

    /// <summary>Ordered list of sources to scan for dictionary key usage.</summary>
    public List<ScanSourceOptions> ScanSources { get; set; } = [];
}
