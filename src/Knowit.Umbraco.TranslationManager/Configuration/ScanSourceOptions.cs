namespace Knowit.Umbraco.TranslationManager.Configuration;

public class ScanSourceOptions
{
    /// <summary>Display name shown in the dashboard (e.g. "Razor", "React", "Vue").</summary>
    public string Name { get; set; } = "";

    /// <summary>
    /// Directory to scan. Relative paths are resolved from ContentRootPath.
    /// Use ".." notation to reach sibling directories (e.g. "../../frontend").
    /// </summary>
    public string RootPath { get; set; } = ".";

    /// <summary>Glob-style file extensions to include (e.g. ["*.cshtml", "*.cs"]).</summary>
    public List<string> FilePatterns { get; set; } = [];

    /// <summary>
    /// Regex pattern where capturing group 1 is the dictionary key.
    /// Example (string literal): GetDictionaryValue(?:OrDefault)?\(\s*"([^"]+)"
    /// Example (React):          \bt\("([^"]+)"
    /// Example (via constants):  GetDictionaryValue(?:OrDefault)?\(\s*\w+\.(\w+)
    /// </summary>
    public string KeyPattern { get; set; } = "";

    /// <summary>
    /// Optional. Enables two-pass constant resolution for projects that reference
    /// dictionary keys through a constants class rather than string literals.
    ///
    /// Provide a regex with exactly two capturing groups:
    ///   Group 1 — the constant identifier (property name)
    ///   Group 2 — the dictionary key value (the string the constant holds)
    ///
    /// The scanner first builds a name→value map from all matching files, then
    /// resolves any identifier captured by KeyPattern through that map.
    /// Identifiers not found in the map are used as-is (safe fallback).
    ///
    /// Example for a C# constants class:
    ///   const string (\w+)\s*=\s*"([^"]+)"
    ///   Maps: Winter → "Winter",  NavHome → "nav.home", etc.
    /// </summary>
    public string? ConstantsPattern { get; set; }
}
