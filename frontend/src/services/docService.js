/**
 * services/docService.js — Documentation API Functions
 *
 * The only file in the entire frontend that knows about the
 * backend's endpoint URLs and request/response shapes.
 *
 * Responsibilities:
 *   - Export named async functions for every backend operation
 *   - Handle binary (blob) responses for ZIP download
 *   - Trigger browser file download without leaving the page
 *   - Keep all API knowledge in one place — if the backend
 *     changes an endpoint, only this file needs updating
 *
 * How it connects:
 *   - Imports the Axios instance from api.js
 *   - Imported by useDocGeneration hook (not by components)
 *   - Components never call these functions directly
 *
 * Placement: src/services/docService.js
 */

import api from "./api";

// ---------------------------------------------------------------------------
// generateDocs
// ---------------------------------------------------------------------------

/**
 * Sends the repository URL and generation options to the backend.
 * Returns the full documentation result object on success.
 *
 * Expected request body:
 *   {
 *     repo_url: "https://github.com/owner/repo",
 *     options: {
 *       readme:  true,
 *       folders: true,
 *       files:   true
 *     }
 *   }
 *
 * Expected response shape (from FastAPI):
 *   {
 *     job_id:         "abc-123",          // used for ZIP download
 *     repo_name:      "owner/repo",
 *     file_count:     24,
 *     folder_count:   6,
 *     doc_count:      8,
 *     folder_tree:    { ... },           // nested object for FolderTree
 *     key_files:      [ ... ],            // array for FileList
 *     readme_preview: "# Repo\n...",  // markdown string for preview/truncation fallback
 *     readme_content: "# Repo\n...",  // full README markdown string
 *   }
 *
 * @param {string} repoUrl   — full GitHub repository URL
 * @param {object} options   — { readme: bool, folders: bool, files: bool }
 * @returns {Promise<object>} — the docs result object
 * @throws {Error}           — normalised by the api.js interceptor
 */
export async function generateDocs(repoUrl, options = {}) {
  const response = await api.post("/api/generate", {
    repo_url: repoUrl,
    options: {
      readme:  options.readme  ?? true,
      folders: options.folders ?? true,
      files:   options.files   ?? true,
    },
  });

  return response.data;
}

// ---------------------------------------------------------------------------
// getJobStatus
// ---------------------------------------------------------------------------

/**
 * Polls the backend for the current status of an async job.
 * Used by useDocGeneration when the backend processes the
 * repository asynchronously (returns a job_id immediately,
 * then the frontend polls until done).
 *
 * Expected response shape:
 *   {
 *     job_id:  "abc-123",
 *     status:  "pending" | "processing" | "done" | "error",
 *     step:    2,            // current pipeline step index (0–4)
 *     result:  { ... }      // present when status === "done"
 *     error:   "..."        // present when status === "error"
 *   }
 *
 * @param {string} jobId
 * @returns {Promise<object>}
 * @throws {Error}
 */
export async function getJobStatus(jobId) {
  const response = await api.get(`/api/status/${jobId}`);
  return response.data;
}

// ---------------------------------------------------------------------------
// downloadZip
// ---------------------------------------------------------------------------

/**
 * Fetches the generated ZIP archive as a binary blob and
 * triggers an immediate browser download without navigating away.
 *
 * Why responseType "blob":
 *   The response is binary (a ZIP file), not JSON. Without
 *   setting responseType, Axios would try to parse it as text
 *   and produce a corrupted download.
 *
 * @param {string} jobId      — returned by generateDocs / getJobStatus
 * @param {string} [filename] — default download filename
 * @returns {Promise<void>}   — resolves when download is triggered
 * @throws {Error}
 */
export async function downloadZip(jobId, filename = "documentation-bundle.zip") {
  const response = await api.get(`/api/download/${jobId}`, {
    responseType: "blob",
  });

  // Create a temporary object URL pointing to the blob
  const url = URL.createObjectURL(
    new Blob([response.data], { type: "application/zip" })
  );

  // Programmatically click a hidden anchor to trigger download
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Clean up — revoke the object URL to free memory
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// validateRepoUrl  (lightweight backend validation)
// ---------------------------------------------------------------------------

/**
 * Optional: asks the backend to check if a GitHub URL is
 * accessible before kicking off the full generation.
 * Provides faster feedback for private / non-existent repos.
 *
 * This is a nice-to-have and can be called onBlur on the
 * URL input field. Safe to skip in MVP — validators.js
 * handles client-side format validation already.
 *
 * Expected response: { valid: bool, message: string }
 *
 * @param {string} repoUrl
 * @returns {Promise<{ valid: boolean, message: string }>}
 * @throws {Error}
 */
export async function validateRepoUrl(repoUrl) {
  const response = await api.post("/api/validate", { repo_url: repoUrl });
  return response.data;
}