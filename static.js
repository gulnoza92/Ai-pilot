/**
 * AI Pilot — public static files
 * ------------------------------------------------------------
 * Only the files listed here can be downloaded from the server. Everything
 * else (the SQLite database, source code, anything outside this folder) is
 * answered with 404. An allowlist cannot be bypassed with "../" in the URL,
 * which the previous `path.join(__dirname, req.url)` approach allowed.
 *
 * Pure logic, no HTTP — easy to test (static.test.js).
 */

const path = require("path");

const HTML = "text/html; charset=utf-8";
const PNG = "image/png";
const WOFF2 = "font/woff2";

// URL path -> [file in this folder, Content-Type, Cache-Control]
const PUBLIC_FILES = {
  "/": ["index.html", HTML, "no-cache"],
  "/index.html": ["index.html", HTML, "no-cache"],

  // Mobile app (PWA)
  "/app": ["app.html", HTML, "no-cache"],
  "/app.html": ["app.html", HTML, "no-cache"],
  "/app.webmanifest": ["app.webmanifest", "application/manifest+json; charset=utf-8", "no-cache"],
  "/sw.js": ["sw.js", "text/javascript; charset=utf-8", "no-cache"],
  "/icon-192.png": ["icon-192.png", PNG, "public, max-age=86400"],
  "/icon-512.png": ["icon-512.png", PNG, "public, max-age=86400"],
  "/icon-maskable-512.png": ["icon-maskable-512.png", PNG, "public, max-age=86400"],
  "/apple-touch-icon.png": ["apple-touch-icon.png", PNG, "public, max-age=86400"],
  "/font-latin.woff2": ["font-latin.woff2", WOFF2, "public, max-age=604800"],
  "/font-cyrillic.woff2": ["font-cyrillic.woff2", WOFF2, "public, max-age=604800"],
};

/**
 * @param {string} rawUrl  req.url, e.g. "/app?source=pwa"
 * @param {string} rootDir folder the public files live in
 * @returns {{filePath: string, contentType: string, cacheControl: string} | null}
 */
function resolvePublicFile(rawUrl, rootDir) {
  if (typeof rawUrl !== "string") return null;
  const pathname = rawUrl.split(/[?#]/)[0];
  if (!Object.prototype.hasOwnProperty.call(PUBLIC_FILES, pathname)) return null;
  const [file, contentType, cacheControl] = PUBLIC_FILES[pathname];
  return { filePath: path.join(rootDir, file), contentType, cacheControl };
}

module.exports = { resolvePublicFile, PUBLIC_FILES };
