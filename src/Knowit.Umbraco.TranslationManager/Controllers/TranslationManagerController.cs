using System.Text.RegularExpressions;
using Knowit.Umbraco.TranslationManager.Configuration;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Web.Common.Controllers;

namespace Knowit.Umbraco.TranslationManager.Controllers;

[ApiController]
[Route("umbraco/api/translation-manager")]
public class TranslationManagerController : UmbracoApiController
{
    private const string ScanCacheKey = "tm:scan";

    private readonly ILocalizationService _localizationService;
    private readonly IWebHostEnvironment _env;
    private readonly TranslationManagerOptions _options;
    private readonly IMemoryCache _cache;

    public TranslationManagerController(
        ILocalizationService localizationService,
        IWebHostEnvironment env,
        IOptionsSnapshot<TranslationManagerOptions> options,
        IMemoryCache cache)
    {
        _localizationService = localizationService;
        _env = env;
        _options = options.Value;
        _cache = cache;
    }

    // ── Scan ─────────────────────────────────────────────────────────────────

    [HttpGet("scan")]
    public IActionResult Scan([FromQuery] bool force = false)
    {
        if (_options.DisableInProduction && _env.IsProduction())
            return NotFound();

        if (!force && _options.CacheDurationMinutes > 0 && _cache.TryGetValue(ScanCacheKey, out object? cached))
            return Ok(cached);

        var result = BuildScanResult();

        if (_options.CacheDurationMinutes > 0)
            _cache.Set(ScanCacheKey, result, TimeSpan.FromMinutes(_options.CacheDurationMinutes));

        return Ok(result);
    }

    private object BuildScanResult()
    {
        var leafItems = GetLeafDictionaryItems();
        var dictionaryKeys = leafItems.Select(i => i.ItemKey).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var excludedDirs = new HashSet<string>(_options.ExcludedDirectories, StringComparer.OrdinalIgnoreCase);
        var cultures = _localizationService.GetAllLanguages()
            .Select(l => new { isoCode = l.IsoCode, name = l.CultureInfo.DisplayName })
            .ToList();

        var scanResults = new Dictionary<string, Dictionary<string, List<string>>>();
        var diagnostics = new List<object>();

        foreach (var source in _options.ScanSources)
        {
            if (string.IsNullOrWhiteSpace(source.Name) || string.IsNullOrWhiteSpace(source.KeyPattern))
                continue;

            var rootPath = Path.IsPathRooted(source.RootPath)
                ? source.RootPath
                : Path.GetFullPath(Path.Combine(_env.ContentRootPath, source.RootPath));

            var exists = Directory.Exists(rootPath);
            var allFiles = exists
                ? Directory.EnumerateFiles(rootPath, "*", SearchOption.AllDirectories).ToList()
                : [];
            var matchedFiles = allFiles
                .Where(f => source.FilePatterns.Any(p => p.TrimStart('*') == Path.GetExtension(f)))
                .ToList();
            var sampleMatches = matchedFiles
                .Take(3)
                .Select(f =>
                {
                    var content = System.IO.File.ReadAllText(f);
                    var rx = new System.Text.RegularExpressions.Regex(source.KeyPattern,
                        System.Text.RegularExpressions.RegexOptions.Multiline);
                    var hits = rx.Matches(content).Count;
                    return new { file = Path.GetFileName(f), regexHits = hits };
                })
                .ToList();

            diagnostics.Add(new
            {
                source = source.Name,
                resolvedPath = rootPath,
                exists,
                totalFiles = allFiles.Count,
                patternMatchedFiles = matchedFiles.Count,
                sampleMatches
            });

            if (!exists) continue;

            var constantsMap = string.IsNullOrWhiteSpace(source.ConstantsPattern)
                ? null
                : BuildConstantsMap(rootPath, [.. source.FilePatterns], source.ConstantsPattern, excludedDirs);

            scanResults[source.Name] = ScanFiles(rootPath, [.. source.FilePatterns], source.KeyPattern, excludedDirs, constantsMap);
        }

        var allUsed = scanResults.Values
            .SelectMany(d => d.Keys)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return new
        {
            scannedAt = DateTime.UtcNow,
            contentRoot = _env.ContentRootPath,
            sourcesConfigured = _options.ScanSources?.Any() == true,
            diagnostics,
            cultures,
            summary = new
            {
                dictionaryCount = leafItems.Count,
                usedCount = dictionaryKeys.Count(k => allUsed.Contains(k)),
                unusedCount = dictionaryKeys.Count(k => !allUsed.Contains(k)),
                missingCount = allUsed.Count(k => !dictionaryKeys.Contains(k)),
            },
            unusedInDictionary = leafItems
                .Where(i => !allUsed.Contains(i.ItemKey))
                .OrderBy(i => i.ItemKey)
                .Select(i => new { key = i.ItemKey, id = i.Id })
                .ToList(),
            missingFromDictionary = allUsed
                .Where(k => !dictionaryKeys.Contains(k))
                .OrderBy(k => k)
                .Select(k => new
                {
                    key = k,
                    sources = scanResults
                        .Where(sr => sr.Value.ContainsKey(k))
                        .Select(sr => new { name = sr.Key, files = sr.Value[k] })
                        .ToList(),
                })
                .ToList(),
            allKeys = leafItems
                .OrderBy(i => i.ItemKey)
                .Select(i => new
                {
                    key = i.ItemKey,
                    id = i.Id,
                    used = allUsed.Contains(i.ItemKey),
                    sources = scanResults
                        .Where(sr => sr.Value.ContainsKey(i.ItemKey))
                        .Select(sr => new { name = sr.Key, files = sr.Value[i.ItemKey] })
                        .ToList(),
                })
                .ToList(),
        };
    }

    // ── Dictionary roots ──────────────────────────────────────────────────────

    [HttpGet("dictionary-roots")]
    public IActionResult DictionaryRoots()
    {
        var roots = _localizationService.GetRootDictionaryItems()
            .Select(i => i.ItemKey)
            .OrderBy(k => k)
            .ToList();
        return Ok(roots);
    }

    // ── Translation completeness ──────────────────────────────────────────────

    [HttpGet("completeness")]
    public IActionResult Completeness()
    {
        if (_options.DisableInProduction && _env.IsProduction())
            return NotFound();

        var languages = _localizationService.GetAllLanguages().ToList();
        var leafItems = GetLeafDictionaryItems();

        var incompleteKeys = leafItems
            .Where(item => languages.Any(lang =>
                !item.Translations.Any(t =>
                    t.Language.Id == lang.Id && !string.IsNullOrWhiteSpace(t.Value))))
            .OrderBy(i => i.ItemKey)
            .Select(item => new
            {
                key = item.ItemKey,
                id = item.Id,
                translations = languages.ToDictionary(
                    lang => lang.IsoCode,
                    lang => item.Translations
                        .FirstOrDefault(t => t.Language.Id == lang.Id)?.Value ?? ""),
            })
            .ToList();

        return Ok(new
        {
            cultures = languages.Select(l => new { isoCode = l.IsoCode, name = l.CultureInfo.DisplayName }),
            summary = new
            {
                totalKeys = leafItems.Count,
                completeCount = leafItems.Count - incompleteKeys.Count,
                incompleteCount = incompleteKeys.Count,
            },
            incompleteKeys,
        });
    }

    // ── Create key ────────────────────────────────────────────────────────────

    [HttpPost("keys")]
    public IActionResult CreateKey([FromBody] CreateKeyRequest request)
    {
        if (_options.DisableInProduction && _env.IsProduction())
            return NotFound();

        if (string.IsNullOrWhiteSpace(request.Key))
            return BadRequest("Key is required.");

        if (_localizationService.DictionaryItemExists(request.Key))
            return Conflict($"Key '{request.Key}' already exists.");

        var parentId = EnsureParentChain(request.Key);
        var item = _localizationService.CreateDictionaryItemWithIdentity(request.Key, parentId);

        foreach (var (isoCode, value) in request.Values)
        {
            if (string.IsNullOrWhiteSpace(value)) continue;
            var language = _localizationService.GetLanguageByIsoCode(isoCode);
            if (language is null) continue;
            _localizationService.AddOrUpdateDictionaryValue(item, language, value);
        }

        _localizationService.Save(item);
        _cache.Remove(ScanCacheKey);

        return Ok(new { id = item.Id, key = item.ItemKey });
    }

    // ── Delete keys ───────────────────────────────────────────────────────────

    [HttpDelete("keys")]
    public IActionResult DeleteKeys([FromBody] string[] keys)
    {
        if (_options.DisableInProduction && _env.IsProduction())
            return NotFound();

        var deleted = 0;
        foreach (var key in keys)
        {
            var item = _localizationService.GetDictionaryItemByKey(key);
            if (item is null) continue;
            _localizationService.Delete(item);
            deleted++;
        }

        _cache.Remove(ScanCacheKey);
        return Ok(new { deleted });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private List<IDictionaryItem> GetLeafDictionaryItems()
    {
        var allItems = new List<IDictionaryItem>();
        foreach (var root in _localizationService.GetRootDictionaryItems())
        {
            allItems.Add(root);
            allItems.AddRange(_localizationService.GetDictionaryItemDescendants(root.Key));
        }

        var excluded = _options.ExcludedDictionaryRoots;
        if (excluded.Count > 0)
            allItems = allItems
                .Where(i => !excluded.Any(r =>
                    i.ItemKey.Equals(r, StringComparison.OrdinalIgnoreCase) ||
                    i.ItemKey.StartsWith(r + ".", StringComparison.OrdinalIgnoreCase)))
                .ToList();

        var parentGuids = allItems
            .Where(i => i.ParentId.HasValue)
            .Select(i => i.ParentId!.Value)
            .ToHashSet();

        return allItems
            .Where(i => !parentGuids.Contains(i.Key))
            .ToList();
    }

    // Walks up the key hierarchy and creates any missing intermediate parent nodes
    // so that contact.form.name.placeholder ends up correctly nested.
    private Guid? EnsureParentChain(string key)
    {
        var parts = key.Split('.');
        if (parts.Length <= 1) return null;

        Guid? parentId = null;
        for (var i = 1; i < parts.Length; i++)
        {
            var ancestorKey = string.Join(".", parts.Take(i));
            var existing = _localizationService.GetDictionaryItemByKey(ancestorKey);
            if (existing is not null)
            {
                parentId = existing.Key;
            }
            else
            {
                var folder = _localizationService.CreateDictionaryItemWithIdentity(ancestorKey, parentId);
                parentId = folder.Key;
            }
        }

        return parentId;
    }

    // Builds a name→value map by scanning files for constant definitions.
    // Used to resolve identifier captures from KeyPattern before comparing against the dictionary.
    private static Dictionary<string, string> BuildConstantsMap(
        string directory, string[] patterns, string constantsPattern, HashSet<string> excludedDirs)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (!Directory.Exists(directory)) return map;

        var regex = new Regex(constantsPattern, RegexOptions.Compiled | RegexOptions.Multiline);
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var file in EnumerateFiles(directory, patterns, excludedDirs, seen))
        {
            var content = System.IO.File.ReadAllText(file);
            foreach (Match match in regex.Matches(content))
            {
                var name = match.Groups[1].Value;
                var value = match.Groups[2].Value;
                if (!string.IsNullOrWhiteSpace(name) && !string.IsNullOrWhiteSpace(value))
                    map[name] = value;
            }
        }

        return map;
    }

    private static Dictionary<string, List<string>> ScanFiles(
        string directory, string[] patterns, string regexPattern, HashSet<string> excludedDirs,
        Dictionary<string, string>? constantsMap = null)
    {
        var result = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        if (!Directory.Exists(directory))
            return result;

        var regex = new Regex(regexPattern, RegexOptions.Compiled | RegexOptions.Multiline);
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var file in EnumerateFiles(directory, patterns, excludedDirs, seen))
        {
            var content = System.IO.File.ReadAllText(file);
            foreach (Match match in regex.Matches(content))
            {
                var captured = match.Groups[1].Value;
                if (string.IsNullOrWhiteSpace(captured)) continue;

                // Resolve via constants map when available; fall back to the captured value itself.
                var key = constantsMap != null && constantsMap.TryGetValue(captured, out var resolved)
                    ? resolved
                    : captured;

                if (!result.TryGetValue(key, out var list))
                    result[key] = list = [];

                var rel = Path.GetRelativePath(directory, file).Replace('\\', '/');
                if (!list.Contains(rel))
                    list.Add(rel);
            }
        }

        return result;
    }

    private static IEnumerable<string> EnumerateFiles(
        string directory, string[] patterns, HashSet<string> excludedDirs, HashSet<string> seen)
    {
        foreach (var entry in Directory.EnumerateFileSystemEntries(directory))
        {
            if (Directory.Exists(entry))
            {
                if (excludedDirs.Contains(Path.GetFileName(entry)))
                    continue;

                foreach (var file in EnumerateFiles(entry, patterns, excludedDirs, seen))
                    yield return file;
            }
            else
            {
                var ext = Path.GetExtension(entry);
                if (patterns.Any(p => p.TrimStart('*') == ext))
                    if (seen.Add(entry)) yield return entry;
            }
        }
    }
}

public record CreateKeyRequest(string Key, Dictionary<string, string> Values);
