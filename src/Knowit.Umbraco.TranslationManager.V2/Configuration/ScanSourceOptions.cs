namespace Knowit.Umbraco.TranslationManager.Configuration;

public class ScanSourceOptions
{
    public string Name { get; set; } = "";
    public string RootPath { get; set; } = ".";
    public List<string> FilePatterns { get; set; } = [];
    public string KeyPattern { get; set; } = "";
    public string? ConstantsPattern { get; set; }
}
