/**
 * library-indexer.js
 *
 * Traverses Ableton's browser tree via LiveAPI and outputs a JSON index
 * of instruments, presets, audio effects, and MIDI effects.
 *
 * Runs inside Max's `js` object (SpiderMonkey engine, NOT Node.js).
 *
 * NOTE: The Browser API is undocumented in the Max LOM. This script
 * uses best-effort access patterns. If a category fails to enumerate,
 * it logs a warning and continues with the next.
 *
 * Inlet 0:
 *   bang          — scan all categories
 *   "scan" <cat>  — scan a specific category (instruments, audio_effects, etc.)
 *   "probe"       — diagnostic: report what browser properties are accessible
 *
 * Outlet 0:
 *   "library_index" <json>  — complete index as JSON array
 *   "scan_progress" <msg>   — progress messages during scan
 *   "scan_error" <json>     — error messages
 */

inlets = 1;
outlets = 1;

// Categories to scan (maps to Browser object properties in the Python API)
var CATEGORIES = [
    "instruments",
    "sounds",
    "drums",
    "audio_effects",
    "midi_effects",
    "samples",
    "packs"
];

// Max depth for recursive traversal (prevents runaway on huge libraries)
var MAX_DEPTH = 4;

// Max items per category (safety limit)
var MAX_ITEMS_PER_CATEGORY = 500;

// ---------------------------------------------------------------------------
// Inlet handlers
// ---------------------------------------------------------------------------

function bang() {
    scanAll();
}

function anything() {
    var args = arrayfromargs(messagename, arguments);
    var cmd = args[0];

    if (cmd === "probe") {
        probeBrowser();
    } else if (cmd === "scan" && args.length > 1) {
        var category = args[1];
        var items = scanCategory(category);
        if (items && items.length > 0) {
            outlet(0, "library_index", JSON.stringify(items));
        }
    } else {
        post("library-indexer: unknown command: " + cmd + "\n");
    }
}

// ---------------------------------------------------------------------------
// Diagnostic probe — run this first in Ableton to see what's accessible
// ---------------------------------------------------------------------------

function probeBrowser() {
    post("\n=== Browser API Probe ===\n");

    try {
        var browser = new LiveAPI(null, "live_app browser");
        post("Browser id: " + browser.id + "\n");
        post("Browser type: " + browser.type + "\n");
        post("Browser path: " + browser.path + "\n");

        // Check what children the browser has in the LOM
        if (browser.children) {
            post("Browser children: " + JSON.stringify(browser.children) + "\n");
        }

        // Try each category
        for (var i = 0; i < CATEGORIES.length; i++) {
            var cat = CATEGORIES[i];
            try {
                // Method 1: Direct path navigation
                var catApi = new LiveAPI(null, "live_app browser " + cat);
                if (catApi.id && catApi.id !== "0") {
                    post(cat + " (via path): id=" + catApi.id + "\n");

                    // Try to read properties
                    tryProperty(catApi, "name");
                    tryProperty(catApi, "is_folder");
                    tryProperty(catApi, "is_loadable");
                    tryProperty(catApi, "uri");

                    // Try getcount for children
                    try {
                        var count = catApi.getcount("children");
                        post("  children count: " + count + "\n");
                    } catch (e2) {
                        post("  getcount('children') failed: " + e2.message + "\n");
                    }
                } else {
                    post(cat + " (via path): NOT ACCESSIBLE (id=0)\n");
                }

                // Method 2: get() on browser object
                try {
                    var val = browser.get(cat);
                    post(cat + " (via get): " + val + "\n");
                } catch (e3) {
                    post(cat + " (via get): failed - " + e3.message + "\n");
                }
            } catch (e) {
                post(cat + ": ERROR - " + e.message + "\n");
            }
        }
    } catch (e) {
        post("Browser probe failed: " + e.message + "\n");
    }

    post("=== End Probe ===\n\n");
}

function tryProperty(api, prop) {
    try {
        var val = api.get(prop);
        post("  " + prop + " = " + val + "\n");
    } catch (e) {
        post("  " + prop + " failed: " + e.message + "\n");
    }
}

// ---------------------------------------------------------------------------
// Full scan
// ---------------------------------------------------------------------------

function scanAll() {
    post("library-indexer: starting full scan...\n");
    outlet(0, "scan_progress", "Starting library scan...");

    var allItems = [];

    for (var i = 0; i < CATEGORIES.length; i++) {
        var cat = CATEGORIES[i];
        outlet(0, "scan_progress", "Scanning " + cat + "...");

        var items = scanCategory(cat);
        if (items) {
            allItems = allItems.concat(items);
            post("  " + cat + ": " + items.length + " items\n");
        }
    }

    post("library-indexer: scan complete. " + allItems.length + " total items.\n");
    outlet(0, "scan_progress", "Scan complete: " + allItems.length + " items");

    if (allItems.length > 0) {
        outlet(0, "library_index", JSON.stringify(allItems));
    }
}

// ---------------------------------------------------------------------------
// Category scan
// ---------------------------------------------------------------------------

function scanCategory(category) {
    var items = [];

    try {
        // Try to access the category root via direct path
        var catApi = new LiveAPI(null, "live_app browser " + category);

        if (!catApi.id || catApi.id === "0") {
            // Fallback: try get() on browser to get the category's id
            var browser = new LiveAPI(null, "live_app browser");
            var catId = browser.get(category);

            if (catId && String(catId) !== "0" && String(catId) !== "") {
                catApi = new LiveAPI(null);
                catApi.id = parseInt(catId, 10) || catId;
            } else {
                post("  " + category + ": not accessible\n");
                return items;
            }
        }

        walkBrowserItem(catApi, category, "", 0, items);

    } catch (e) {
        post("  " + category + " scan error: " + e.message + "\n");
        outlet(0, "scan_error", JSON.stringify({
            category: category,
            error: e.message
        }));
    }

    return items;
}

// ---------------------------------------------------------------------------
// Recursive browser tree walker
// ---------------------------------------------------------------------------

function walkBrowserItem(api, category, parentPath, depth, items) {
    if (depth > MAX_DEPTH) return;
    if (items.length >= MAX_ITEMS_PER_CATEGORY) return;

    var name = getString(api, "name");
    var currentPath = parentPath ? parentPath + "/" + name : name;

    // Check if this item is loadable (a preset/device we can use)
    var isLoadable = false;
    try {
        isLoadable = parseInt(api.get("is_loadable"), 10) === 1;
    } catch (e) { /* ignore */ }

    var isFolder = false;
    try {
        isFolder = parseInt(api.get("is_folder"), 10) === 1;
    } catch (e) { /* ignore */ }

    // If loadable, add to index
    if (isLoadable && name) {
        var uri = "";
        try { uri = getString(api, "uri"); } catch (e) { /* ignore */ }

        items.push({
            name: name,
            category: category,
            path: currentPath,
            uri: uri,
            tags: extractTags(name, currentPath, category),
            is_device: getBoolProp(api, "is_device")
        });
    }

    // Recurse into folders
    if (isFolder && depth < MAX_DEPTH && items.length < MAX_ITEMS_PER_CATEGORY) {
        var childCount = 0;

        // Try getcount("children")
        try {
            childCount = api.getcount("children");
        } catch (e) {
            childCount = 0;
        }

        if (childCount > 0) {
            // Get the base path for constructing child paths
            var basePath = api.unquotedpath || String(api.path).replace(/^"|"$/g, "");

            for (var i = 0; i < childCount && items.length < MAX_ITEMS_PER_CATEGORY; i++) {
                try {
                    var childApi = new LiveAPI(null, basePath + " children " + i);
                    if (childApi.id && childApi.id !== "0") {
                        walkBrowserItem(childApi, category, currentPath, depth + 1, items);
                    }
                } catch (e) {
                    // Skip inaccessible children
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function getString(api, property) {
    var val = api.get(property);
    if (val === undefined || val === null) return "";
    if (typeof val === "string") return val;
    // LiveAPI often returns arrays for string properties
    if (val.length !== undefined) {
        var joined = "";
        for (var i = 0; i < val.length; i++) {
            if (i > 0) joined += " ";
            joined += val[i];
        }
        // Strip surrounding quotes
        if (joined.charAt(0) === '"' && joined.charAt(joined.length - 1) === '"') {
            joined = joined.substring(1, joined.length - 1);
        }
        return joined;
    }
    return String(val);
}

function getBoolProp(api, property) {
    try {
        return parseInt(api.get(property), 10) === 1;
    } catch (e) {
        return false;
    }
}

/**
 * Extract search tags from the item's name and path.
 * This makes items more discoverable via text search.
 */
function extractTags(name, itemPath, category) {
    var tags = [];

    // Add path segments as tags (e.g., "Analog/Bass/Growl" → ["analog", "bass", "growl"])
    var segments = itemPath.split("/");
    for (var i = 0; i < segments.length; i++) {
        var seg = segments[i].toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
        if (seg && seg.length > 1) {
            tags.push(seg);
        }
    }

    // Category-specific tags
    if (category === "instruments") tags.push("instrument");
    if (category === "audio_effects") tags.push("effect", "audio effect");
    if (category === "midi_effects") tags.push("midi effect");
    if (category === "drums") tags.push("drum", "percussion", "kit");
    if (category === "samples") tags.push("sample", "audio");

    // Name-based keyword extraction
    var nameLower = name.toLowerCase();
    if (nameLower.indexOf("bass") >= 0) tags.push("bass");
    if (nameLower.indexOf("pad") >= 0) tags.push("pad");
    if (nameLower.indexOf("lead") >= 0) tags.push("lead");
    if (nameLower.indexOf("key") >= 0) tags.push("keys");
    if (nameLower.indexOf("piano") >= 0) tags.push("piano", "keys");
    if (nameLower.indexOf("string") >= 0) tags.push("strings");
    if (nameLower.indexOf("vocal") >= 0) tags.push("vocal");
    if (nameLower.indexOf("ambient") >= 0) tags.push("ambient");
    if (nameLower.indexOf("warm") >= 0) tags.push("warm");
    if (nameLower.indexOf("dark") >= 0) tags.push("dark");
    if (nameLower.indexOf("bright") >= 0) tags.push("bright");

    return tags;
}
