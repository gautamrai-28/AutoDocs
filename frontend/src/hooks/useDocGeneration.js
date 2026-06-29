/**
 * hooks/useDocGeneration.js — Documentation Generation Hook
 *
 * The single most important logic file in the frontend.
 * Orchestrates the entire generation lifecycle end-to-end:
 *   1. Validates the URL client-side
 *   2. Dispatches state transitions via DocContext
 *   3. Calls the backend via docService
 *   4. Advances the pipeline step indicators
 *   5. Handles success and error states
 *   6. Exposes a clean API surface to DashboardPage
 *
 * This hook is the ONLY consumer of docService — components
 * never call API functions directly. This separation means:
 *   - The API layer can change without touching any component
 *   - The hook can be tested with a mocked docService
 *   - DashboardPage stays under 60 lines
 *
 * What it returns:
 *   status         — "idle" | "loading" | "done" | "error"
 *   currentStep    — active pipeline step index (0–4), -1 otherwise
 *   generatedDocs  — full API response object when done, null otherwise
 *   error          — error message string when failed, null otherwise
 *   repoUrl        — current URL input value (from context)
 *   options        — current chip toggle selections (from context)
 *   elapsedMs      — generation time in ms (available when done)
 *   onGenerate     — call this to kick off generation
 *   onReset        — call this to return to idle state
 *
 * Placement: src/hooks/useDocGeneration.js
 */

import { useRef, useCallback } from "react";
import { useDocContext } from "../context/DocContext";
import { generateDocs, getJobStatus } from "../services/docService";
import { validateGithubUrl } from "../utils/validators";
import {
  PIPELINE_STEPS,
  PIPELINE_STATUS,
  TOTAL_STEPS,
  getStepByIndex,
} from "../constants/pipeline";

// ---------------------------------------------------------------------------
// Strategy constants
// ---------------------------------------------------------------------------

/**
 * USE_POLLING
 *
 * Toggle between two generation strategies:
 *
 *   false (default for MVP):
 *     The backend processes synchronously and returns the
 *     full docs result in the POST /api/generate response.
 *     The hook uses optimistic step advancement — it advances
 *     the UI through steps using each step's .duration value
 *     while waiting for the single API call to resolve.
 *
 *   true (for async backend):
 *     The POST /api/generate returns immediately with a job_id.
 *     The hook polls GET /api/status/:jobId at POLL_INTERVAL_MS
 *     until the backend reports "done" or "error", and uses
 *     the step index from the poll response to drive the UI.
 *
 * Switch this to true when the backend is updated to use
 * background tasks (e.g. FastAPI BackgroundTasks or Celery).
 */
const USE_POLLING = false;

/** How often to poll the backend in async mode (milliseconds) */
const POLL_INTERVAL_MS = 2_000;

/** Max time to wait before declaring a timeout (milliseconds) */
const MAX_POLL_DURATION_MS = 180_000; // 3 minutes

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDocGeneration() {
  const {
    // State reads
    repoUrl,
    status,
    currentStep,
    generatedDocs,
    error,
    options,
    // Stable dispatchers from DocContext
    startGeneration,
    setStep,
    setDone,
    setError,
    reset,
  } = useDocContext();

  /**
   * elapsedMsRef tracks how long the generation took.
   * We use a ref (not state) because we don't need a
   * re-render when it updates — we only read it at the
   * moment setDone is called.
   */
  const elapsedMsRef  = useRef(0);
  const startTimeRef  = useRef(null);

  /**
   * pollTimerRef holds the setInterval ID in polling mode
   * so we can cancel it on error or unmount.
   */
  const pollTimerRef  = useRef(null);

  /**
   * abortControllerRef allows us to cancel the in-flight
   * Axios request if the component unmounts mid-generation.
   * (Future enhancement — Axios cancel token wiring goes here)
   */
  const abortControllerRef = useRef(null);

  // ---------------------------------------------------------------------------
  // Optimistic step advancement (synchronous backend strategy)
  // ---------------------------------------------------------------------------

  /**
   * advanceStepsOptimistically
   *
   * Simulates realistic pipeline progress in the UI while a
   * single long-running API call is in flight.
   *
   * Works by chaining setTimeout calls, one per step, using
   * each step's .duration value as the delay. The actual API
   * response resolves the final state — this only drives the
   * visual progress indicators.
   *
   * Returns a cleanup function that cancels pending timers
   * if the API resolves early or the component unmounts.
   *
   * @returns {() => void} cancel function
   */
  function advanceStepsOptimistically() {
    const timers = [];
    let cumulativeDelay = 0;

    // Advance through steps 0 → TOTAL_STEPS - 1
    // Note: we don't advance past the last step here —
    // setDone() handles the final transition.
    for (let i = 0; i < TOTAL_STEPS; i++) {
      const step = getStepByIndex(i);
      if (!step) continue;

      const delay = cumulativeDelay;
      const stepIndex = i;

      const timer = setTimeout(() => {
        setStep(stepIndex);
      }, delay);

      timers.push(timer);
      cumulativeDelay += step.duration;
    }

    return () => timers.forEach(clearTimeout);
  }

  // ---------------------------------------------------------------------------
  // Polling strategy (async backend)
  // ---------------------------------------------------------------------------

  /**
   * pollUntilDone
   *
   * Polls GET /api/status/:jobId every POLL_INTERVAL_MS.
   * Reads the step index from the response to keep the UI
   * in sync with actual backend progress.
   *
   * Stops when:
   *   - status === "done"  → dispatches setDone
   *   - status === "error" → dispatches setError
   *   - MAX_POLL_DURATION_MS exceeded → dispatches setError
   *
   * @param {string} jobId
   */
  async function pollUntilDone(jobId) {
    const pollStart = Date.now();

    pollTimerRef.current = setInterval(async () => {
      try {
        // Timeout guard
        if (Date.now() - pollStart > MAX_POLL_DURATION_MS) {
          clearInterval(pollTimerRef.current);
          setError(
            "Documentation generation timed out. The repository may be too large. Please try again."
          );
          return;
        }

        const statusResponse = await getJobStatus(jobId);

        // Sync UI step with backend's reported step
        if (typeof statusResponse.step === "number") {
          setStep(statusResponse.step);
        }

        if (statusResponse.status === "done") {
          clearInterval(pollTimerRef.current);
          elapsedMsRef.current = Date.now() - startTimeRef.current;
          setDone(statusResponse.result);
        } else if (statusResponse.status === "error") {
          clearInterval(pollTimerRef.current);
          setError(statusResponse.error ?? "An error occurred during generation.");
        }
        // "pending" | "processing" → keep polling
      } catch (err) {
        clearInterval(pollTimerRef.current);
        setError(err.message);
      }
    }, POLL_INTERVAL_MS);
  }

  // ---------------------------------------------------------------------------
  // onGenerate — the main trigger
  // ---------------------------------------------------------------------------

  /**
   * onGenerate
   *
   * Called by UrlInputCard when the user clicks "Generate".
   * Validates the URL, kicks off the appropriate strategy,
   * and manages all state transitions.
   *
   * DashboardPage never needs to know which strategy is
   * active — it just calls onGenerate().
   */
  const onGenerate = useCallback(async () => {
    // ── Guard: don't start if already loading ──────────────────
    if (status === PIPELINE_STATUS.LOADING) return;

    // ── Guard: validate URL before hitting the network ─────────
    const validation = validateGithubUrl(repoUrl);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    // ── Transition to loading state ─────────────────────────────
    startGeneration(); // dispatches START_GENERATION → resets all fields
    startTimeRef.current = Date.now();

    try {
      if (USE_POLLING) {
        // ── Async (polling) strategy ──────────────────────────────
        // POST immediately returns a job_id
        const initialResponse = await generateDocs(repoUrl, options);
        const { job_id } = initialResponse;

        if (!job_id) {
          throw new Error("Backend did not return a job ID. Check the API response format.");
        }

        // Start polling — UI advances with backend step reports
        await pollUntilDone(job_id);

      } else {
        // ── Synchronous strategy (default MVP) ───────────────────
        // Start optimistic UI advancement in parallel with the API call
        const cancelOptimisticSteps = advanceStepsOptimistically();

        // Single blocking POST — resolves with full docs result
        const docsResult = await generateDocs(repoUrl, options);

        // API resolved — cancel any pending optimistic timers
        cancelOptimisticSteps();

        elapsedMsRef.current = Date.now() - startTimeRef.current;

        // Transition to done state with the API result
        setDone(docsResult);
      }

    } catch (err) {
      // Cancel any pending timers on error
      clearInterval(pollTimerRef.current);

      // The error message was already normalised by api.js interceptor
      setError(err.message);
    }
  }, [repoUrl, options, status, startGeneration, setStep, setDone, setError]);

  // ---------------------------------------------------------------------------
  // onReset — returns to idle, preserving URL
  // ---------------------------------------------------------------------------

  const onReset = useCallback(() => {
    clearInterval(pollTimerRef.current);
    reset();
  }, [reset]);

  // ---------------------------------------------------------------------------
  // Return surface
  // ---------------------------------------------------------------------------

  return {
    // State — read directly from context
    status,
    currentStep,
    generatedDocs,
    error,
    repoUrl,
    options,

    // Derived convenience booleans — keeps conditionals in components clean
    isIdle:    status === PIPELINE_STATUS.IDLE,
    isLoading: status === PIPELINE_STATUS.LOADING,
    isDone:    status === PIPELINE_STATUS.DONE,
    isError:   status === PIPELINE_STATUS.ERROR,

    // How long generation took (only meaningful when isDone)
    elapsedMs: elapsedMsRef.current,

    // Actions
    onGenerate,
    onReset,
  };
}