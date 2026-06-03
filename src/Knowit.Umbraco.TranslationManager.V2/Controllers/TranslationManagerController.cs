using System.Text.Json;
using System.Text.RegularExpressions;
using Knowit.Umbraco.TranslationManager.Configuration;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Umbraco.AI.Core.Chat;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Services;

namespace Knowit.Umbraco.TranslationManager.Controllers;

[ApiController]
[Route("umbraco/api/translation-manager")]
public class TranslationManagerController : ControllerBase
{
    private const string ScanCacheKey = "tm:scan";

    private readonly ILanguageService _languageService;
    private readonly IDictionaryItemService _dictionaryItemService;
    private readonly IWebHostEnvironment _env;
    private readonly TranslationManagerOptions _options;
    private readonly IMemoryCache _cache;
    private readonly IServiceProvider _serviceProvider;

    public TranslationManagerController(
        ILanguageService languageService,
        IDictionaryItemService dictionaryItemService,
        IWebHostEnvironment env,
        IOptionsSnapshot<TranslationManagerOptions> options,
        IMemoryCache cache,
        IServiceProvider serviceProvider)
    {
        _languageService = languageService;
        _dictionaryItemService = dictionaryItemService;
        _env = env;
        _options = options.Value;
        _cache = cache;
        _serviceProvider = serviceProvider;
    }

    [HttpGet("scan")]
    public async Task<IActionResult> Scan([FromQuery] bool force = false)
    {
        if (_options.DisableInProduction && _env.IsProduction())
            return NotFound();

        if (!force && _options.CacheDurationMinutes > 0 && _cache.TryGetValue(ScanCacheKey, out object? cached))
            return Ok(cached);

        var result = await BuildScanResultAsync();

        if (_options.CacheDurationMinutes > 0)
            _cache.Set(ScanCacheKey, result, TimeSpan.FromMinutes(_options.CacheDurationMinutes));

        return Ok(result);
    }

    private async Task<object> BuildScanResultAsync()
    {
        var leafItems = await GetLeafDictionaryItemsAsync();
        var dictionaryKeys = leafItems.Select(i => i.ItemKey).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var excludedDirs = new HashSet<string>(_options.ExcludedDirectories, StringComparer.OrdinalIgnoreCase);
        var languages = (await _languageService.GetAllAsync()).ToList();
        var cultures = languages.Select(l => new { isoCode = l.IsoCode, name = l.CultureInfo.DisplayName }).ToList();

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

            diagnostics.Add(new
            {
                source = source.Name,
                resolvedPath = rootPath,
                exists,
                totalFiles = allFiles.Count,
                patternMatchedFiles = matchedFiles.Count,
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
                .Select(i => new { key = i.ItemKey, id = i.Key })
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
                    id = i.Key,
                    used = allUsed.Contains(i.ItemKey),
                    sources = scanResults
                        .Where(sr => sr.Value.ContainsKey(i.ItemKey))
                        .Select(sr => new { name = sr.Key, files = sr.Value[i.ItemKey] })
                        .ToList(),
                })
                .ToList(),
        };
    }

    [HttpGet("completeness")]
    public async Task<IActionResult> Completeness()
    {
        if (_options.DisableInProduction && _env.IsProduction())
            return NotFound();

        var languages = (await _languageService.GetAllAsync()).ToList();
        var leafItems = await GetLeafDictionaryItemsAsync();

        var incompleteKeys = leafItems
            .Where(item => languages.Any(lang =>
                !item.Translations.Any(t =>
                    t.LanguageIsoCode == lang.IsoCode && !string.IsNullOrWhiteSpace(t.Value))))
            .OrderBy(i => i.ItemKey)
            .Select(item => new
            {
                key = item.ItemKey,
                id = item.Key,
                translations = languages.ToDictionary(
                    lang => lang.IsoCode,
                    lang => item.Translations
                        .FirstOrDefault(t => t.LanguageIsoCode == lang.IsoCode)?.Value ?? ""),
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

    [HttpPost("keys")]
    public async Task<IActionResult> CreateKey([FromBody] CreateKeyRequest request)
    {
        if (_options.DisableInProduction && _env.IsProduction())
            return NotFound();

        if (string.IsNullOrWhiteSpace(request.Key))
            return BadRequest("Key is required.");

        if (await _dictionaryItemService.ExistsAsync(request.Key))
            return Conflict($"Key '{request.Key}' already exists.");

        var parentKey = await EnsureParentChainAsync(request.Key);
        var item = new DictionaryItem(parentKey, request.Key);

        var translations = new List<IDictionaryTranslation>();
        foreach (var (isoCode, value) in request.Values)
        {
            if (string.IsNullOrWhiteSpace(value)) continue;
            var language = await _languageService.GetAsync(isoCode);
            if (language is null) continue;
            translations.Add(new DictionaryTranslation(language, value));
        }
        var createResult = await _dictionaryItemService.CreateAsync(item, Constants.Security.SuperUserKey);
        if (!createResult.Success)
            return Conflict($"Could not create key '{request.Key}': {createResult.Status}");

        if (translations.Count > 0)
        {
            var created = createResult.Result!;
            created.Translations = translations;
            await _dictionaryItemService.UpdateAsync(created, Constants.Security.SuperUserKey);
        }

        _cache.Remove(ScanCacheKey);
        return Ok(new { id = item.Key, key = item.ItemKey });
    }

    [HttpDelete("keys")]
    public async Task<IActionResult> DeleteKeys([FromBody] Guid[] keys)
    {
        if (_options.DisableInProduction && _env.IsProduction())
            return NotFound();

        var deleted = 0;
        foreach (var key in keys)
        {
            await _dictionaryItemService.DeleteAsync(key, Constants.Security.SuperUserKey);
            deleted++;
        }

        _cache.Remove(ScanCacheKey);
        return Ok(new { deleted });
    }

    [HttpGet("ai-available")]
    public IActionResult AiAvailable()
    {
        if (_options.DisableInProduction && _env.IsProduction())
            return NotFound();

        var aiService = _serviceProvider.GetService<IAIChatService>();
        return aiService is not null ? Ok() : NotFound();
    }

    [HttpPost("suggest")]
    public async Task<IActionResult> Suggest([FromBody] SuggestRequest request, CancellationToken ct)
    {
        if (_options.DisableInProduction && _env.IsProduction())
            return NotFound();

        var aiService = _serviceProvider.GetService<IAIChatService>();
        if (aiService is null)
            return NotFound(new { error = "AI service not available. Install and configure Umbraco.AI." });

        if (string.IsNullOrWhiteSpace(request.Key) || request.Cultures.Length == 0)
            return BadRequest("Key and cultures are required.");

        var languages = (await _languageService.GetAllAsync())
            .Where(l => request.Cultures.Contains(l.IsoCode, StringComparer.OrdinalIgnoreCase))
            .Select(l => $"{l.IsoCode} ({l.CultureInfo.DisplayName})")
            .ToList();

        var messages = new List<ChatMessage>
        {
            new(ChatRole.System,
                "You are a UI translation assistant for a web CMS. " +
                "Respond ONLY with a valid JSON object — no explanation, no markdown code blocks. " +
                "Keys must be the ISO culture codes provided. Values must be short, natural UI label translations."),
            new(ChatRole.User,
                $"Translate the UI label for dictionary key \"{request.Key}\" into these languages: " +
                string.Join(", ", languages))
        };

        try
        {
            var response = await aiService.GetChatResponseAsync(messages, cancellationToken: ct);
            var raw = response.Text?.Trim() ?? "";

            if (raw.StartsWith("```")) raw = Regex.Replace(raw, @"^```[a-z]*\n?|\n?```$", "", RegexOptions.Multiline).Trim();

            var suggestions = JsonSerializer.Deserialize<Dictionary<string, string>>(raw,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            return Ok(new { suggestions });
        }
        catch (JsonException)
        {
            return StatusCode(502, new { error = "AI returned an unexpected response format." });
        }
        catch (Exception ex) when (ex.Message.Contains("429") || ex.Message.Contains("quota") || ex.Message.Contains("rate"))
        {
            return StatusCode(429, new { error = "AI quota exceeded or rate limited. Check your API plan and billing." });
        }
        catch (Exception ex)
        {
            return StatusCode(502, new { error = $"AI request failed: {ex.Message}" });
        }
    }

    private async Task<List<IDictionaryItem>> GetLeafDictionaryItemsAsync()
    {
        var allItems = new List<IDictionaryItem>();
        var roots = await _dictionaryItemService.GetAtRootAsync();
        foreach (var root in roots)
        {
            allItems.Add(root);
            var descendants = await _dictionaryItemService.GetDescendantsAsync(root.Key, string.Empty);
            allItems.AddRange(descendants);
        }

        var parentGuids = allItems
            .Where(i => i.ParentId.HasValue)
            .Select(i => i.ParentId!.Value)
            .ToHashSet();

        return allItems.Where(i => !parentGuids.Contains(i.Key)).ToList();
    }

    // Walks up the key hierarchy and creates any missing intermediate parent nodes
    // so that contact.form.name.placeholder ends up correctly nested.
    private async Task<Guid?> EnsureParentChainAsync(string key)
    {
        var parts = key.Split('.');
        if (parts.Length <= 1) return null;

        Guid? parentId = null;
        for (var i = 1; i < parts.Length; i++)
        {
            var ancestorKey = string.Join(".", parts.Take(i));
            var existing = await _dictionaryItemService.GetAsync(ancestorKey);
            if (existing is not null)
            {
                parentId = existing.Key;
            }
            else
            {
                var folder = new DictionaryItem(parentId, ancestorKey);
                var result = await _dictionaryItemService.CreateAsync(folder, Constants.Security.SuperUserKey);
                if (result.Success) parentId = result.Result!.Key;
            }
        }

        return parentId;
    }

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
        if (!Directory.Exists(directory)) return result;

        var regex = new Regex(regexPattern, RegexOptions.Compiled | RegexOptions.Multiline);
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var file in EnumerateFiles(directory, patterns, excludedDirs, seen))
        {
            var content = System.IO.File.ReadAllText(file);
            foreach (Match match in regex.Matches(content))
            {
                var captured = match.Groups[1].Value;
                if (string.IsNullOrWhiteSpace(captured)) continue;

                var key = constantsMap != null && constantsMap.TryGetValue(captured, out var resolved)
                    ? resolved
                    : captured;

                if (!result.TryGetValue(key, out var list))
                    result[key] = list = [];

                var rel = Path.GetRelativePath(directory, file).Replace('\\', '/');
                if (!list.Contains(rel)) list.Add(rel);
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
                if (excludedDirs.Contains(Path.GetFileName(entry))) continue;
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
public record SuggestRequest(string Key, string[] Cultures);
