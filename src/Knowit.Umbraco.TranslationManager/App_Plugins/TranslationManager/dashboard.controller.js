angular.module("umbraco").controller("TranslationManagerDashboardController", [
    "$http", "$scope", "$timeout", "$rootScope",
    function ($http, $scope, $timeout, $rootScope) {
        var vm = this;

        vm.loading = false;
        vm.loadingCompleteness = false;
        vm.data = null;
        vm.completeness = null;
        vm.error = null;
        vm.activeTab = "unused";
        vm.filter = "";
        vm.completenessFilter = "";
        vm.selectedUnused = {};
        vm.expandedMissing = {};
        vm.newKeyValues = {};
        vm.savingKey = {};

        function clearAllForms() {
            var scope = $scope;
            var depth = 0;
            while (scope && scope !== scope.$root && depth++ < 20) {
                angular.forEach(scope, function (val, key) {
                    if (key[0] !== "$" && val && typeof val.$setPristine === "function") {
                        val.$setPristine();
                        val.$setUntouched();
                    }
                });
                scope = scope.$parent;
            }
        }

        function resetDirty() {
            $timeout(clearAllForms, 0);
        }

        // Intercept navigation before Umbraco's guard checks dirty state.
        var deregisterNavGuard = $rootScope.$on("$locationChangeStart", clearAllForms);
        $scope.$on("$destroy", deregisterNavGuard);

        vm.scan = function (force) {
            vm.loading = true;
            vm.error = null;
            vm.data = null;
            vm.selectedUnused = {};
            vm.expandedMissing = {};

            $http.get("/umbraco/api/translation-manager/scan", { params: { force: !!force } })
                .then(function (res) { vm.data = res.data; resetDirty(); })
                .catch(function (err) { vm.error = (err.data && (err.data.title || err.data)) || "Scan failed."; })
                .finally(function () { vm.loading = false; });
        };

        vm.openCompleteness = function () {
            vm.activeTab = "completeness";
            if (!vm.completeness && !vm.loadingCompleteness) {
                vm.loadingCompleteness = true;
                $http.get("/umbraco/api/translation-manager/completeness")
                    .then(function (res) { vm.completeness = res.data; })
                    .catch(function (err) { vm.error = (err.data && (err.data.title || err.data)) || "Could not load completeness."; })
                    .finally(function () { vm.loadingCompleteness = false; });
            }
        };

        vm.timeAgo = function () {
            if (!vm.data || !vm.data.scannedAt) return "";
            var diff = Math.round((Date.now() - new Date(vm.data.scannedAt).getTime()) / 60000);
            if (diff < 1) return "just now";
            return diff + " minute" + (diff === 1 ? "" : "s") + " ago";
        };

        vm.filteredUnused = function () {
            if (!vm.data) return [];
            var q = vm.filter.toLowerCase();
            return vm.data.unusedInDictionary.filter(function (item) {
                return !q || item.key.toLowerCase().indexOf(q) !== -1;
            });
        };

        vm.filteredMissing = function () {
            if (!vm.data) return [];
            var q = vm.filter.toLowerCase();
            return vm.data.missingFromDictionary.filter(function (item) {
                return !q || item.key.toLowerCase().indexOf(q) !== -1;
            });
        };

        vm.filteredAll = function () {
            if (!vm.data) return [];
            var q = vm.filter.toLowerCase();
            return vm.data.allKeys.filter(function (item) {
                return !q || item.key.toLowerCase().indexOf(q) !== -1;
            });
        };

        vm.filteredIncomplete = function () {
            if (!vm.completeness) return [];
            var q = vm.completenessFilter.toLowerCase();
            return vm.completeness.incompleteKeys.filter(function (item) {
                return !q || item.key.toLowerCase().indexOf(q) !== -1;
            });
        };

        vm.selectedUnusedCount = function () {
            return Object.keys(vm.selectedUnused).filter(function (k) { return vm.selectedUnused[k]; }).length;
        };

        vm.allUnusedSelected = function () {
            var filtered = vm.filteredUnused();
            return filtered.length > 0 && filtered.every(function (item) { return vm.selectedUnused[item.key]; });
        };

        vm.toggleAllUnused = function () {
            var selectAll = !vm.allUnusedSelected();
            vm.filteredUnused().forEach(function (item) { vm.selectedUnused[item.key] = selectAll; });
        };

        vm.deleteSelected = function () {
            var keys = Object.keys(vm.selectedUnused).filter(function (k) { return vm.selectedUnused[k]; });
            if (!keys.length) return;
            if (!confirm("Delete " + keys.length + " dictionary item(s)? This cannot be undone.")) return;

            $http.delete("/umbraco/api/translation-manager/keys", {
                data: keys,
                headers: { "Content-Type": "application/json" }
            })
                .then(function () { resetDirty(); vm.scan(true); })
                .catch(function (err) { vm.error = "Delete failed: " + ((err.data && err.data.title) || err.status); });
        };

        vm.toggleAddKey = function (key) {
            vm.expandedMissing[key] = !vm.expandedMissing[key];
            if (vm.expandedMissing[key] && !vm.newKeyValues[key]) {
                vm.newKeyValues[key] = {};
            }
        };

        vm.saveKey = function (key) {
            vm.savingKey[key] = true;
            $http.post("/umbraco/api/translation-manager/keys", {
                key: key,
                values: vm.newKeyValues[key] || {}
            })
                .then(function () {
                    resetDirty();
                    vm.scan(true);
                    if (vm.completeness) vm.completeness = null;
                })
                .catch(function (err) { vm.error = "Could not add key: " + ((err.data && err.data.title) || err.status); })
                .finally(function () { vm.savingKey[key] = false; });
        };

        vm.sourceLabel = function (item) {
            if (!item.sources || item.sources.length === 0) return "Unused";
            return item.sources.map(function (s) { return s.name; }).join(" + ");
        };

        vm.sourceClass = function (item) {
            return (item.sources && item.sources.length > 0) ? "tm-badge-used" : "tm-badge-unused";
        };

        vm.allFiles = function (item) {
            if (!item.sources) return [];
            return item.sources.reduce(function (acc, s) { return acc.concat(s.files || []); }, []);
        };

        vm.hasTranslation = function (value) {
            return value && value.trim().length > 0;
        };

        vm.presets = [
            {
                id: "react-i18next",
                label: "React / i18next",
                badge: "RX", badgeBg: "#e8f8fd", badgeColor: "#0d9abf",
                hint: "t('key')",
                name: "React",
                filePatterns: "*.tsx, *.ts, *.jsx, *.js",
                keyPattern: "\\bt\\(['\"]([^'\"]+)['\"]\\)"
            },
            {
                id: "razor",
                label: "Umbraco Razor",
                badge: "RZ", badgeBg: "#ede7f6", badgeColor: "#6200ea",
                hint: "GetDictionaryValue(\"key\")",
                name: "Razor",
                filePatterns: "*.cshtml, *.cs",
                keyPattern: "GetDictionaryValue(?:OrDefault)?\\(\\s*\"([^\"]+)\""
            },
            {
                id: "vue-i18n",
                label: "Vue / vue-i18n",
                badge: "VU", badgeBg: "#e8f5e9", badgeColor: "#2e7d32",
                hint: "$t('key')",
                name: "Vue",
                filePatterns: "*.vue, *.ts, *.js",
                keyPattern: "\\$t\\(['\"]([^'\"]+)['\"]\\)"
            },
            {
                id: "angular",
                label: "Angular",
                badge: "NG", badgeBg: "#ffebee", badgeColor: "#c62828",
                hint: "'key' | translate",
                name: "Angular",
                filePatterns: "*.ts, *.html",
                keyPattern: "'([^']+)'\\s*\\|\\s*translate"
            },
            {
                id: "custom",
                label: "Custom",
                badge: "✦", badgeBg: "#e3f2fd", badgeColor: "#1c85c7",
                hint: "define your own",
                name: "", filePatterns: "", keyPattern: ""
            }
        ];

        vm.keyMarker = "{{key}}";
        vm.examplePlaceholder = "e.g. t('{{key}}')";

        vm.setup = {
            selectedPreset: null,
            name: "",
            rootPath: "",
            filePatterns: "",
            keyPattern: "",
            example: "",
            generateError: null,
            sources: [],
            cacheDurationMinutes: 5,
            excludedDirectories: "node_modules, bin, obj, .git, dist, .vite, wwwroot",
            excludedDictionaryRoots: [],
            copied: false
        };

        vm.dictionaryRoots = [];

        $http.get("/umbraco/api/translation-manager/dictionary-roots")
            .then(function (res) { vm.dictionaryRoots = res.data; })
            .catch(function () { /* non-critical */ });

        vm.toggleDictionaryRoot = function (root) {
            var idx = vm.setup.excludedDictionaryRoots.indexOf(root);
            if (idx === -1) {
                vm.setup.excludedDictionaryRoots.push(root);
            } else {
                vm.setup.excludedDictionaryRoots.splice(idx, 1);
            }
        };

        vm.isDictionaryRootExcluded = function (root) {
            return vm.setup.excludedDictionaryRoots.indexOf(root) !== -1;
        };

        vm.selectPreset = function (preset) {
            vm.setup.selectedPreset = preset.id;
            vm.setup.name = preset.name;
            vm.setup.filePatterns = preset.filePatterns;
            vm.setup.keyPattern = preset.keyPattern;
            vm.setup.example = "";
            vm.setup.generateError = null;
            vm.setup.copied = false;
        };

        vm.canAddSource = function () {
            return !!(vm.setup.name && vm.setup.keyPattern);
        };

        vm.addSource = function () {
            if (!vm.canAddSource()) return;
            var patterns = (vm.setup.filePatterns || "")
                .split(",").map(function (p) { return p.trim(); }).filter(function (p) { return p.length > 0; });
            vm.setup.sources.push({
                Name: vm.setup.name,
                RootPath: vm.setup.rootPath || "../path/to/source",
                FilePatterns: patterns.length ? patterns : ["*.*"],
                KeyPattern: vm.setup.keyPattern
            });
            vm.setup.selectedPreset = null;
            vm.setup.name = "";
            vm.setup.rootPath = "";
            vm.setup.filePatterns = "";
            vm.setup.keyPattern = "";
            vm.setup.example = "";
            vm.setup.generateError = null;
        };

        vm.removeSource = function (index) {
            vm.setup.sources.splice(index, 1);
        };

        vm.derivePattern = function () {
            var example = (vm.setup.example || "").trim();
            vm.setup.generateError = null;

            if (!example) { vm.setup.keyPattern = ""; return; }

            var MARKER = "{{key}}";
            var idx = example.indexOf(MARKER);

            if (idx === -1) return;

            var before = example.substring(0, idx);
            var after = example.substring(idx + MARKER.length);

            function escapeRegex(str) {
                return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            }

            var prefix = /^\w/.test(before) ? "\\b" : "";
            var quoteMatch = before.match(/(['"])$/);

            if (quoteMatch && after.startsWith(quoteMatch[1])) {
                vm.setup.keyPattern = prefix + escapeRegex(before.slice(0, -1)) + "['\"]([^'\"]+)['\"]" + escapeRegex(after.slice(1));
            } else if (before.endsWith(".")) {
                vm.setup.keyPattern = prefix + escapeRegex(before) + "([A-Z]\\w+)";
            } else {
                vm.setup.keyPattern = prefix + escapeRegex(before) + "([^'\"\\s]+)" + escapeRegex(after);
            }
        };

        vm.generatedSnippet = function () {
            var sources = vm.setup.sources.slice();

            if (vm.setup.selectedPreset && vm.setup.name && vm.setup.keyPattern) {
                var patterns = (vm.setup.filePatterns || "")
                    .split(",").map(function (p) { return p.trim(); }).filter(function (p) { return p.length > 0; });
                sources.push({
                    Name: vm.setup.name,
                    RootPath: vm.setup.rootPath || "../path/to/source",
                    FilePatterns: patterns.length ? patterns : ["*.*"],
                    KeyPattern: vm.setup.keyPattern
                });
            }

            var excludedDirs = (vm.setup.excludedDirectories || "")
                .split(",").map(function (d) { return d.trim(); }).filter(function (d) { return d.length > 0; });

            var translationManager = {
                CacheDurationMinutes: parseInt(vm.setup.cacheDurationMinutes, 10) || 0,
                ExcludedDirectories: excludedDirs,
                ScanSources: sources
            };

            if (vm.setup.excludedDictionaryRoots.length > 0) {
                translationManager.ExcludedDictionaryRoots = vm.setup.excludedDictionaryRoots.slice();
            }

            return JSON.stringify({ TranslationManager: translationManager }, null, 2);
        };

        vm.copySnippet = function () {
            var text = vm.generatedSnippet();
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(function () {
                    vm.setup.copied = true;
                    $timeout(function () { vm.setup.copied = false; }, 2000);
                });
            } else {
                var el = document.createElement("textarea");
                el.value = text;
                document.body.appendChild(el);
                el.select();
                document.execCommand("copy");
                document.body.removeChild(el);
                vm.setup.copied = true;
                $timeout(function () { vm.setup.copied = false; }, 2000);
            }
        };

        vm.scanWarnings = function () {
            if (!vm.data) return [];
            var warnings = [];
            var d = vm.data;

            angular.forEach(d.diagnostics, function (diag) {
                if (!diag.exists) {
                    warnings.push({ source: diag.source, message: 'Path not found: ' + diag.resolvedPath });
                } else if (diag.patternMatchedFiles === 0) {
                    warnings.push({ source: diag.source, message: 'No files matched the configured patterns.' });
                }
            });

            var hasConfiguredSources = d.diagnostics && d.diagnostics.length > 0;
            var allSourcesValid = hasConfiguredSources && warnings.length === 0;
            var noKeysFound = d.summary.usedCount === 0 && d.summary.missingCount === 0;
            var hasDictionary = d.summary.dictionaryCount > 0;

            if (allSourcesValid && noKeysFound && hasDictionary) {
                warnings.push({
                    source: 'Scan result',
                    message: 'Sources are reachable and files were found, but no translation keys were matched. Check your KeyPattern regex.'
                });
            }

            return warnings;
        };

        vm.healthClass = function () {
            if (!vm.data) return "";
            if (vm.data.summary.missingCount > 0) return "tm-health-danger";
            if (vm.data.summary.unusedCount > 0) return "tm-health-warn";
            return "tm-health-ok";
        };

        vm.healthLabel = function () {
            if (!vm.data) return "";
            var parts = [];
            if (vm.data.summary.missingCount > 0) parts.push(vm.data.summary.missingCount + " missing");
            if (vm.data.summary.unusedCount > 0) parts.push(vm.data.summary.unusedCount + " unused");
            return parts.length ? parts.join(" · ") : "All good";
        };

        vm.scan(false);
    }
]);
