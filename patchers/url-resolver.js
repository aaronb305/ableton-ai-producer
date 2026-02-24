// url-resolver.js — Computes the file:// URL for the UI HTML
// ES5 only (runs in Max's SpiderMonkey js object)
// On bang, reads the patcher's filepath, derives ui/index.html path,
// and outlets "url file:///path/to/ui/index.html" for jweb.

inlets = 1;
outlets = 1;

function bang() {
    var patcherPath = this.patcher.filepath;
    if (!patcherPath) {
        post("url-resolver: no patcher filepath, falling back to server\n");
        outlet(0, "url", "http://127.0.0.1:9320");
        return;
    }

    // patcherPath on macOS: "/path/to/device/AbletonAI.amxd"
    // patcherPath on Windows: "C:\\path\\to\\device\\AbletonAI.amxd"
    var sep = patcherPath.indexOf("\\") >= 0 ? "\\" : "/";
    var parts = patcherPath.split(sep);
    parts.pop(); // remove AbletonAI.amxd
    parts.pop(); // remove device/
    parts.push("ui");
    parts.push("index.html");
    var htmlPath = parts.join(sep);

    var url;
    if (sep === "\\") {
        url = "file:///" + htmlPath.replace(/\\/g, "/");
    } else {
        url = "file://" + htmlPath;
    }

    post("url-resolver: " + url + "\n");
    outlet(0, "url", url);
}
