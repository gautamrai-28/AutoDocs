/**
 * utils/formatters.js — Display Formatting Utilities
 *
 * Pure functions that convert raw data values into
 * human-readable strings for display in the UI.
 *
 * "Pure" means: same input → same output, no side effects,
 * no imports from the rest of the app, no state access.
 *
 * How it connects:
 *   - ResultsPanel uses formatFileCount, formatFolderCount
 *   - DownloadBar uses formatZipFilename
 *   - FileList uses formatFileExtension, formatFileBadge
 *   - Any component can import individual named exports
 *
 * Placement: src/utils/formatters.js
 */

// ---------------------------------------------------------------------------
// Repository / URL formatting
// ---------------------------------------------------------------------------

/**
 * formatRepoName
 *
 * Extracts a clean "owner/repo" display name from a GitHub URL.
 * Falls back to the raw URL if parsing fails.
 *
 * @param {string} url
 * @returns {string}
 *
 * @example
 * formatRepoName("https://github.com/facebook/react") // "facebook/react"
 * formatRepoName("https://github.com/owner/repo.git") // "owner/repo"
 */
export function formatRepoName(url) {
  if (!url || typeof url !== "string") return url ?? "";

  try {
    const { pathname } = new URL(url.trim());
    // pathname is "/owner/repo" or "/owner/repo.git"
    const parts = pathname.replace(/\.git$/, "").split("/").filter(Boolean);
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  } catch {
    // URL constructor throws on invalid input — fall through
  }

  return url;
}

/**
 * formatZipFilename
 *
 * Produces the default download filename for a repository's
 * generated documentation ZIP.
 *
 * @param {string} repoUrl
 * @returns {string}
 *
 * @example
 * formatZipFilename("https://github.com/facebook/react")
 * // "react-docs.zip"
 */
export function formatZipFilename(repoUrl) {
  try {
    const { pathname } = new URL((repoUrl ?? "").trim());
    const parts = pathname.replace(/\.git$/, "").split("/").filter(Boolean);
    if (parts.length >= 2) return `${parts[1]}-docs.zip`;
  } catch {
    // fall through
  }
  return "documentation-bundle.zip";
}

// ---------------------------------------------------------------------------
// Number / count formatting
// ---------------------------------------------------------------------------

/**
 * formatFileCount
 *
 * @param {number} n
 * @returns {string}
 *
 * @example
 * formatFileCount(1)  // "1 file"
 * formatFileCount(24) // "24 files"
 */
export function formatFileCount(n) {
  const count = Number(n) || 0;
  return `${count} ${count === 1 ? "file" : "files"}`;
}

/**
 * formatFolderCount
 *
 * @param {number} n
 * @returns {string}
 *
 * @example
 * formatFolderCount(6) // "6 folders"
 */
export function formatFolderCount(n) {
  const count = Number(n) || 0;
  return `${count} ${count === 1 ? "folder" : "folders"}`;
}

/**
 * formatDocCount
 *
 * @param {number} n
 * @returns {string}
 *
 * @example
 * formatDocCount(8) // "8 docs"
 */
export function formatDocCount(n) {
  const count = Number(n) || 0;
  return `${count} ${count === 1 ? "doc" : "docs"}`;
}

/**
 * formatFileSize
 *
 * Converts a byte count to a human-readable string.
 * Used in the DownloadBar to show ZIP file size.
 *
 * @param {number} bytes
 * @returns {string}
 *
 * @example
 * formatFileSize(0)          // "0 B"
 * formatFileSize(1024)       // "1.0 KB"
 * formatFileSize(1536000)    // "1.5 MB"
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const clamped = Math.min(index, units.length - 1);
  const value = bytes / Math.pow(1024, clamped);

  return `${value.toFixed(clamped === 0 ? 0 : 1)} ${units[clamped]}`;
}

// ---------------------------------------------------------------------------
// File metadata formatting
// ---------------------------------------------------------------------------

/**
 * formatFileExtension
 *
 * Returns the lowercase extension of a filename, without the dot.
 * Returns "" for files without extensions.
 *
 * @param {string} filename
 * @returns {string}
 *
 * @example
 * formatFileExtension("main.py")          // "py"
 * formatFileExtension("App.jsx")          // "jsx"
 * formatFileExtension("Makefile")         // ""
 * formatFileExtension("archive.tar.gz")   // "gz"
 */
export function formatFileExtension(filename) {
  if (!filename || typeof filename !== "string") return "";
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/**
 * formatFileBadge
 *
 * Maps a filename to one of the badge labels used in FileList:
 *   "entry" | "core" | "config" | "ui" | "test" | "docs" | "other"
 *
 * These labels are displayed as coloured badges next to filenames
 * in the ResultsPanel's FileList component.
 *
 * Logic is intentionally simple for MVP — can be made smarter
 * (e.g. AST-based) in a future iteration.
 *
 * @param {string} filename
 * @param {string} [role] — optional role from the API response
 * @returns {string}
 */
export function formatFileBadge(filename, role) {
  // Trust the API's role field if present
  const knownRoles = ["entry", "core", "config", "ui", "test", "docs"];
  if (role && knownRoles.includes(role.toLowerCase())) {
    return role.toLowerCase();
  }

  const name = (filename ?? "").toLowerCase();
  const ext  = formatFileExtension(name);

  // Entry points
  if (["main.py", "app.py", "index.js", "index.jsx", "main.jsx", "main.js"].includes(name)) {
    return "entry";
  }

  // Config / infra files
  if (
    ["requirements.txt", "package.json", "pyproject.toml", "setup.py",
     "dockerfile", ".env", "vite.config.js", "tsconfig.json"].includes(name) ||
    name.endsWith(".config.js") ||
    name.endsWith(".config.ts")
  ) {
    return "config";
  }

  // Test files
  if (name.includes("test") || name.includes("spec") || ext === "test") {
    return "test";
  }

  // Documentation files
  if (name === "readme.md" || name.startsWith("readme") || ext === "md") {
    return "docs";
  }

  // UI / component files
  if (["jsx", "tsx", "vue", "svelte"].includes(ext)) {
    return "ui";
  }

  return "core";
}

/**
 * formatFileIcon
 *
 * Maps a filename/extension to a Tabler icon class name.
 * Used in FileList to show a relevant icon per file type.
 *
 * @param {string} filename
 * @returns {string} — Tabler icon class, e.g. "ti-brand-python"
 */
export function formatFileIcon(filename) {
  const ext  = formatFileExtension(filename ?? "");
  const name = (filename ?? "").toLowerCase();

  const map = {
    py:    "ti-brand-python",
    js:    "ti-brand-javascript",
    jsx:   "ti-brand-react",
    ts:    "ti-brand-typescript",
    tsx:   "ti-brand-react",
    html:  "ti-brand-html5",
    css:   "ti-brand-css3",
    md:    "ti-markdown",
    json:  "ti-braces",
    toml:  "ti-settings",
    yaml:  "ti-settings",
    yml:   "ti-settings",
    sh:    "ti-terminal",
    bash:  "ti-terminal",
    txt:   "ti-file-text",
    env:   "ti-lock",
    sql:   "ti-database",
    go:    "ti-brand-golang",
    rs:    "ti-brand-rust",
    java:  "ti-coffee",
    rb:    "ti-brand-ruby",
    php:   "ti-brand-php",
  };

  if (name === "dockerfile") return "ti-brand-docker";
  if (name === "makefile")   return "ti-settings";

  return map[ext] ?? "ti-file-code";
}

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

/**
 * truncateText
 *
 * Truncates a string to maxLength characters, appending "…"
 * if the string was shortened. Useful for long file paths
 * or README previews in constrained card layouts.
 *
 * @param {string}  text
 * @param {number}  maxLength
 * @returns {string}
 *
 * @example
 * truncateText("This is a very long string", 15) // "This is a very…"
 * truncateText("Short", 15)                       // "Short"
 */
export function truncateText(text, maxLength = 80) {
  if (!text || typeof text !== "string") return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

/**
 * formatElapsedTime
 *
 * Converts elapsed milliseconds into a human-readable string.
 * Used in the results panel to show how long generation took.
 *
 * @param {number} ms
 * @returns {string}
 *
 * @example
 * formatElapsedTime(1500)   // "1.5s"
 * formatElapsedTime(62000)  // "1m 2s"
 */
export function formatElapsedTime(ms) {
  if (!ms || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${(ms / 1000).toFixed(1)}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}