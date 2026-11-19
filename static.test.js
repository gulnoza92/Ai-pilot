/**
 * Tests for the public-file allowlist (static.js).
 *
 * Run: node static.test.js
 */
const path = require("path");
const { resolvePublicFile, PUBLIC_FILES } = require("./static");

const ROOT = path.join(path.sep, "srv", "aipilot");

function assert(cond, msg) {
  if (!cond) {
    console.error("❌ FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("✅ OK:", msg);
  }
}

const file = (url) => resolvePublicFile(url, ROOT);

// --- Files the browser is allowed to load ---
assert(file("/")?.filePath === path.join(ROOT, "index.html"), "\"/\" serves the web monitor (index.html)");
assert(file("/app")?.filePath === path.join(ROOT, "app.html"), "\"/app\" serves the mobile app");
assert(file("/app.html")?.filePath === path.join(ROOT, "app.html"), "\"/app.html\" serves the same mobile app");
assert(file("/app?source=pwa")?.filePath === path.join(ROOT, "app.html"), "a query string does not break the lookup");
assert(file("/app")?.contentType.startsWith("text/html"), "the app is sent as HTML");
assert(file("/sw.js")?.contentType.startsWith("text/javascript"), "the service worker is sent as JavaScript (browsers refuse it otherwise)");
assert(file("/app.webmanifest")?.contentType.startsWith("application/manifest+json"), "the manifest has the manifest content type");
assert(file("/icon-192.png")?.contentType === "image/png", "icons are sent as PNG");
assert(file("/font-cyrillic.woff2")?.contentType === "font/woff2", "fonts are sent as WOFF2");

// --- Everything else stays private ---
assert(file("/aipilot.db") === null, "the SQLite database cannot be downloaded");
assert(file("/server.js") === null, "source code is not served");
assert(file("/package.json") === null, "package.json is not served");
assert(file("/../../../etc/passwd") === null, "\"../\" cannot climb out of the folder");
assert(file("/app/../server.js") === null, "\"../\" after an allowed name is refused too");
assert(file("/%2e%2e/%2e%2e/etc/passwd") === null, "encoded dots are refused");
assert(file("/../../../proc/self/environ") === null, "environment variables (tokens, keys) cannot be read");
assert(file("/__proto__") === null && file("/constructor") === null, "object internals are not mistaken for files");
assert(file(undefined) === null, "a missing URL is refused");

// --- Every allowed file really lives inside the root folder ---
const allInside = Object.keys(PUBLIC_FILES).every((url) => {
  const resolved = file(url).filePath;
  return path.dirname(resolved) === ROOT;
});
assert(allInside, "every allowed file sits directly in the server folder");

console.log("\nAll static-file tests finished.");
