/**
 * context/DocContext.jsx — Global Documentation Generation State
 *
 * Provides shared state to the entire component tree so that
 * DashboardPage, its children (UrlInputCard, PipelineTracker,
 * ResultsPanel, DownloadBar), and the useDocGeneration hook
 * all read from and write to the same single source of truth.
 *
 * Architecture decisions:
 *   - useReducer instead of useState: state transitions are
 *     explicit named actions, making bugs easy to trace.
 *   - Context instead of prop drilling: avoids threading
 *     6+ props through every level of the dashboard tree.
 *   - No Redux: the state shape is simple enough that
 *     Context + useReducer is the right tool at MVP scale.
 *
 * Exports:
 *   DocProvider    — wraps App so all pages share the context
 *   useDocContext  — hook for any component to read/dispatch
 *
 * Placement: src/context/DocContext.jsx
 */

import { createContext, useContext, useReducer, useCallback } from "react";
import { PIPELINE_STATUS } from "../constants/pipeline";

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

/**
 * The complete shape of the generation state.
 * Every field has a defined initial value — no undefined.
 */
const initialState = {
  /** The GitHub URL currently typed in the input card */
  repoUrl: "",

  /**
   * Current lifecycle status.
   * One of: "idle" | "loading" | "done" | "error"
   * Use PIPELINE_STATUS constants, not raw strings.
   */
  status: PIPELINE_STATUS.IDLE,

  /**
   * Index of the currently active pipeline step (0–4).
   * -1 when idle or done.
   * Drives PipelineTracker's active/done visual state.
   */
  currentStep: -1,

  /**
   * Full API response from the backend when generation
   * completes. null until status === "done".
   *
   * Shape (mirrors FastAPI response):
   * {
   *   job_id:         string,
   *   repo_name:      string,
   *   file_count:     number,
   *   folder_count:   number,
   *   doc_count:      number,
   *   folder_tree:    object,
   *   key_files:      array,
   *   readme_preview: string,
   *   readme_content: string,
   * }
   */
  generatedDocs: null,

  /**
   * Error message string when status === "error".
   * null otherwise.
   */
  error: null,

  /**
   * Which doc types the user has selected via the Chip toggles.
   * Passed as the options argument to generateDocs().
   */
  options: {
    readme:  true,
    folders: true,
    files:   true,
  },
};

// ---------------------------------------------------------------------------
// Action Types
// ---------------------------------------------------------------------------

/**
 * All possible state transitions as string constants.
 * Prevents typos in dispatch({ type: "..." }) calls.
 */
export const DOC_ACTIONS = {
  /** User changed the URL input field */
  SET_URL: "SET_URL",

  /** User toggled a generation option chip */
  SET_OPTION: "SET_OPTION",

  /** Generation started — move to loading state */
  START_GENERATION: "START_GENERATION",

  /** Pipeline advanced to the next step */
  SET_STEP: "SET_STEP",

  /** Generation completed successfully */
  SET_DONE: "SET_DONE",

  /** Generation failed with an error message */
  SET_ERROR: "SET_ERROR",

  /** User resets to try a new repository */
  RESET: "RESET",
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Pure function: (state, action) → newState.
 * All state logic lives here — no setState scattered
 * across multiple components or the hook.
 */
function docReducer(state, action) {
  switch (action.type) {

    case DOC_ACTIONS.SET_URL:
      return {
        ...state,
        repoUrl: action.payload,
        // Clear any previous error when the user types a new URL
        error: state.error ? null : state.error,
      };

    case DOC_ACTIONS.SET_OPTION:
      return {
        ...state,
        options: {
          ...state.options,
          [action.payload.key]: action.payload.value,
        },
      };

    case DOC_ACTIONS.START_GENERATION:
      return {
        ...state,
        status:       PIPELINE_STATUS.LOADING,
        currentStep:  0,
        generatedDocs: null,
        error:        null,
      };

    case DOC_ACTIONS.SET_STEP:
      return {
        ...state,
        currentStep: action.payload, // numeric step index 0–4
      };

    case DOC_ACTIONS.SET_DONE:
      return {
        ...state,
        status:        PIPELINE_STATUS.DONE,
        currentStep:   -1,
        generatedDocs: action.payload, // full API response object
        error:         null,
      };

    case DOC_ACTIONS.SET_ERROR:
      return {
        ...state,
        status:      PIPELINE_STATUS.ERROR,
        currentStep: -1,
        error:       action.payload, // error message string
      };

    case DOC_ACTIONS.RESET:
      return {
        ...initialState,
        // Preserve the URL and options so the user doesn't have
        // to re-enter them if they just want to retry
        repoUrl: state.repoUrl,
        options: state.options,
      };

    default:
      // Unrecognised action — return state unchanged and warn
      if (import.meta.env.DEV) {
        console.warn(`[DocContext] Unknown action type: "${action.type}"`);
      }
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * The context object. Never imported directly by components —
 * they use the useDocContext() hook below instead.
 */
const DocContext = createContext(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * DocProvider
 *
 * Wraps the application (in App.jsx) so every page and
 * component can access the shared state.
 *
 * Also pre-builds stable dispatch helpers and exposes them
 * alongside raw dispatch — this keeps action creation logic
 * out of components and hooks.
 *
 * @param {{ children: React.ReactNode }} props
 */
export function DocProvider({ children }) {
  const [state, dispatch] = useReducer(docReducer, initialState);

  // ------------------------------------------------------------------
  // Stable action dispatchers
  // Pre-built so components don't construct action objects themselves.
  // useCallback ensures referential stability across renders.
  // ------------------------------------------------------------------

  /** Update the repo URL as the user types */
  const setUrl = useCallback((url) => {
    dispatch({ type: DOC_ACTIONS.SET_URL, payload: url });
  }, []);

  /** Toggle a generation option chip */
  const setOption = useCallback((key, value) => {
    dispatch({ type: DOC_ACTIONS.SET_OPTION, payload: { key, value } });
  }, []);

  /** Called by useDocGeneration when generation starts */
  const startGeneration = useCallback(() => {
    dispatch({ type: DOC_ACTIONS.START_GENERATION });
  }, []);

  /** Called by useDocGeneration as each pipeline step activates */
  const setStep = useCallback((stepIndex) => {
    dispatch({ type: DOC_ACTIONS.SET_STEP, payload: stepIndex });
  }, []);

  /** Called by useDocGeneration when the API returns success */
  const setDone = useCallback((docsResult) => {
    dispatch({ type: DOC_ACTIONS.SET_DONE, payload: docsResult });
  }, []);

  /** Called by useDocGeneration when the API returns an error */
  const setError = useCallback((message) => {
    dispatch({ type: DOC_ACTIONS.SET_ERROR, payload: message });
  }, []);

  /** Resets to idle, preserving URL and options for easy retry */
  const reset = useCallback(() => {
    dispatch({ type: DOC_ACTIONS.RESET });
  }, []);

  // ------------------------------------------------------------------
  // Context value
  // Spread state so consumers can destructure fields directly:
  //   const { status, repoUrl, generatedDocs } = useDocContext();
  // ------------------------------------------------------------------

  const value = {
    // All state fields
    ...state,

    // Stable action helpers
    setUrl,
    setOption,
    startGeneration,
    setStep,
    setDone,
    setError,
    reset,

    // Raw dispatch exposed for advanced use cases in the hook
    dispatch,
  };

  return (
    <DocContext.Provider value={value}>
      {children}
    </DocContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

/**
 * useDocContext
 *
 * The only correct way to consume the DocContext.
 * Throws a clear error if used outside the DocProvider
 * (e.g. a component placed above App.jsx's provider) —
 * much clearer than a confusing "Cannot read properties
 * of null" runtime error.
 *
 * Usage in any component or hook:
 *   const { status, repoUrl, setUrl, generatedDocs } = useDocContext();
 *
 * @returns {object} full context value
 */
export function useDocContext() {
  const context = useContext(DocContext);

  if (context === null) {
    throw new Error(
      "useDocContext must be used inside a <DocProvider>. " +
      "Make sure DocProvider wraps your App in main.jsx or App.jsx."
    );
  }

  return context;
}