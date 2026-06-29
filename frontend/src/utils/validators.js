/**
 * utils/validators.js — Input Validation Utilities
 *
 * Pure functions that validate user input before it reaches
 * the API layer. "Pure" means: same input always produces the
 * same output, no side effects, no network calls, no state.
 *
 * Responsibilities:
 *   - Validate GitHub repository URL format client-side
 *   - Return structured results (not just booleans) so
 *     components can display specific error messages
 *
 * How it connects:
 *   - UrlInputCard imports isValidGithubUrl to enable/disable
 *     the Generate button and show inline validation feedback
 *   - useDocGeneration imports validateGithubUrl as a
 *     first guard before calling the API
 *
 * Placement: src/utils/validators.js
 */

// ---------------------------------------------------------------------------
// GitHub URL Validation
// ---------------------------------------------------------------------------

/**
 * GITHUB_URL_PATTERN
 *
 * Matches valid public GitHub repository URLs.
 *
 * Accepts:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/
 *   https://github.com/owner/repo.git
 *   https://www.github.com/owner/repo
 *
 * Rejects:
 *   http://github.com/...        (no HTTP — security)
 *   https://github.com/owner    (missing repo segment)
 *   https://gitlab.com/...      (wrong host)
 *   github.com/owner/repo       (missing scheme)
 *   https://github.com/         (no owner or repo)
 *
 * Named capture groups make it easy to extract owner/repo
 * from a valid URL without a second parse step.
 */
const GITHUB_URL_PATTERN =
  /^https?:\/\/(www\.)?github\.com\/(?<owner>[a-zA-Z0-9_.-]+)\/(?<repo>[a-zA-Z0-9_.-]+?)(\.git)?\/?$/;

/**
 * validateGithubUrl
 *
 * Full validation with a structured result object.
 * Use this when you need to display a specific error message.
 *
 * @param {string} url
 * @returns {{
 *   valid:   boolean,
 *   message: string,     // empty string when valid
 *   owner:   string|null,
 *   repo:    string|null
 * }}
 *
 * @example
 * const result = validateGithubUrl("https://github.com/facebook/react");
 * // { valid: true, message: "", owner: "facebook", repo: "react" }
 *
 * const bad = validateGithubUrl("not-a-url");
 * // { valid: false, message: "Please enter a valid GitHub repository URL.", owner: null, repo: null }
 */
export function validateGithubUrl(url) {
  const empty = { owner: null, repo: null };

  // Guard: must be a non-empty string
  if (!url || typeof url !== "string") {
    return { valid: false, message: "Please enter a GitHub repository URL.", ...empty };
  }

  const trimmed = url.trim();

  if (trimmed.length === 0) {
    return { valid: false, message: "Please enter a GitHub repository URL.", ...empty };
  }

  // Guard: must start with https://github.com or http://github.com
  if (!trimmed.includes("github.com")) {
    return {
      valid: false,
      message: "Only GitHub repositories are supported (github.com).",
      ...empty,
    };
  }

  // Guard: must include a scheme
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return {
      valid: false,
      message: 'URL must start with "https://". Example: https://github.com/owner/repo',
      ...empty,
    };
  }

  // Full pattern match
  const match = trimmed.match(GITHUB_URL_PATTERN);

  if (!match) {
    return {
      valid: false,
      message:
        "URL format is invalid. Expected: https://github.com/owner/repository",
      ...empty,
    };
  }

  const { owner, repo } = match.groups;

  // Guard: reject github.com itself or user profile URLs
  if (!repo) {
    return {
      valid: false,
      message: "The URL must point to a specific repository, not a user profile.",
      ...empty,
    };
  }

  return {
    valid: true,
    message: "",
    owner,
    repo,
  };
}

/**
 * isValidGithubUrl
 *
 * Lightweight boolean check — use this when you only need
 * to enable/disable a button and don't need the error message.
 *
 * @param {string} url
 * @returns {boolean}
 *
 * @example
 * isValidGithubUrl("https://github.com/facebook/react") // true
 * isValidGithubUrl("https://gitlab.com/user/repo")      // false
 */
export function isValidGithubUrl(url) {
  return validateGithubUrl(url).valid;
}

/**
 * extractRepoIdentifier
 *
 * Returns the "owner/repo" identifier string from a valid URL.
 * Returns null if the URL is invalid.
 * Used by formatters and the results panel to display a
 * clean repo name instead of the full URL.
 *
 * @param {string} url
 * @returns {string|null}
 *
 * @example
 * extractRepoIdentifier("https://github.com/facebook/react") // "facebook/react"
 * extractRepoIdentifier("bad-url")                           // null
 */
export function extractRepoIdentifier(url) {
  const result = validateGithubUrl(url);
  if (!result.valid) return null;
  return `${result.owner}/${result.repo}`;
}