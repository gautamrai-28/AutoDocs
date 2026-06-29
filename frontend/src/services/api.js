/**
 * services/api.js — Configured Axios Instance
 *
 * Creates and exports ONE Axios instance used by the entire
 * application. No component or service ever imports raw axios
 * directly — they all import this instance instead.
 *
 * Responsibilities:
 *   - Set the backend base URL from the environment variable
 *   - Apply a generous timeout (AI generation is slow)
 *   - Set default Content-Type header
 *   - Intercept responses to normalise errors into a
 *     consistent shape before they reach any component
 *
 * Placement: src/services/api.js
 */

import axios from "axios";

// ---------------------------------------------------------------------------
// Instance
// ---------------------------------------------------------------------------

const api = axios.create({
  /**
   * VITE_API_URL must be defined in your .env file:
   *   VITE_API_URL=http://localhost:8000
   *
   * Vite exposes it via import.meta.env at build time.
   * Falls back to localhost:8000 so the app doesn't break
   * if .env is missing during initial development.
   */
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",

  /**
   * 120 seconds — AI doc generation can legitimately take
   * 30–90 seconds for large repositories. Standard 10s
   * timeouts will cause false failures.
   */
  timeout: 120_000,

  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ---------------------------------------------------------------------------
// Request interceptor
// ---------------------------------------------------------------------------

api.interceptors.request.use(
  (config) => {
    /**
     * Good place to attach an auth token later if the
     * backend ever adds authentication:
     *
     *   const token = localStorage.getItem("token");
     *   if (token) config.headers.Authorization = `Bearer ${token}`;
     *
     * For now, just return config unchanged.
     */
    return config;
  },
  (error) => {
    // Request failed before it was even sent (e.g. bad URL config)
    return Promise.reject(normaliseError(error));
  }
);

// ---------------------------------------------------------------------------
// Response interceptor
// ---------------------------------------------------------------------------

api.interceptors.response.use(
  /**
   * Success path — return the response unchanged.
   * Services destructure `response.data` themselves.
   */
  (response) => response,

  /**
   * Error path — convert every Axios error variant into
   * a plain Error object with a human-readable .message.
   *
   * This means callers only ever need to catch one shape:
   *   try { ... } catch (err) { err.message }
   *
   * Without this, components would have to inspect
   * err.response?.data?.detail vs err.message vs
   * err.code === 'ECONNABORTED' themselves.
   */
  (error) => {
    return Promise.reject(normaliseError(error));
  }
);

// ---------------------------------------------------------------------------
// Error normalisation helper
// ---------------------------------------------------------------------------

/**
 * normaliseError
 *
 * Converts an Axios error into a plain Error with a
 * message that is safe to display in the UI.
 *
 * Priority:
 *   1. Backend JSON detail field (FastAPI validation errors)
 *   2. Backend JSON message field (custom error responses)
 *   3. HTTP status text (e.g. "Not Found")
 *   4. Timeout message
 *   5. Network error (no response received)
 *   6. Original error message as fallback
 *
 * @param {import("axios").AxiosError} error
 * @returns {Error}
 */
function normaliseError(error) {
  let message = "An unexpected error occurred. Please try again.";

  if (error.response) {
    // Server responded with a non-2xx status
    const data = error.response.data;

    if (typeof data?.detail === "string") {
      // FastAPI's standard error format: { detail: "..." }
      message = data.detail;
    } else if (Array.isArray(data?.detail)) {
      // FastAPI validation error: { detail: [{ msg: "..." }] }
      message = data.detail.map((d) => d.msg).join(", ");
    } else if (typeof data?.message === "string") {
      // Custom backend error: { message: "..." }
      message = data.message;
    } else if (error.response.statusText) {
      message = `Server error: ${error.response.statusText} (${error.response.status})`;
    }
  } else if (error.code === "ECONNABORTED") {
    // Axios timeout
    message =
      "The request timed out. The repository may be too large or the server is busy. Please try again.";
  } else if (error.request) {
    // Request was made but no response received (backend is down)
    message =
      "Could not reach the server. Make sure the backend is running on " +
      (import.meta.env.VITE_API_URL ?? "http://localhost:8000");
  } else if (error.message) {
    message = error.message;
  }

  const normalisedError = new Error(message);
  // Preserve the original for debugging
  normalisedError.original = error;
  normalisedError.status = error.response?.status ?? null;

  return normalisedError;
}

export default api;