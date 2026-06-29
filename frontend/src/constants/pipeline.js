/**
 * pipeline.js — AutoDocs Pipeline Step Definitions
 *
 * Single source of truth for the 5-stage documentation
 * generation pipeline. Both PipelineTracker (UI) and
 * useDocGeneration (logic) import from here so the step
 * labels, icons, and progress values are never duplicated.
 *
 * Shape of each step:
 *   id          — unique string key, also used as React key prop
 *   index       — numeric position (0–4), drives active/done logic
 *   label       — short display label shown under the step icon
 *   description — longer status message shown in the progress area
 *   icon        — Tabler icon class name (ti-{name})
 *   progressPct — progress bar fill (%) when this step is active
 *   duration    — approximate real-world time in ms (used for
 *                 optimistic UI step advancement in the hook)
 */

export const PIPELINE_STEPS = [
  {
    id: "clone",
    index: 0,
    label: "Clone repo",
    description: "Cloning repository from GitHub...",
    icon: "ti-git-branch",
    progressPct: 15,
    duration: 4000,
  },
  {
    id: "scan",
    index: 1,
    label: "Scan files",
    description: "Scanning folders and identifying key files...",
    icon: "ti-scan",
    progressPct: 35,
    duration: 3000,
  },
  {
    id: "analyse",
    index: 2,
    label: "AI analysis",
    description: "Sending code to AI for analysis...",
    icon: "ti-cpu",
    progressPct: 60,
    duration: 12000,
  },
  {
    id: "generate",
    index: 3,
    label: "Generate docs",
    description: "Generating markdown documentation...",
    icon: "ti-markdown",
    progressPct: 82,
    duration: 6000,
  },
  {
    id: "package",
    index: 4,
    label: "Package ZIP",
    description: "Packaging all files into a ZIP archive...",
    icon: "ti-package",
    progressPct: 96,
    duration: 2000,
  },
];

/**
 * PIPELINE_STATUS
 * String constants for the generation state machine.
 * Used by DocContext reducer and useDocGeneration hook
 * to avoid raw string comparisons scattered across files.
 *
 *   idle     — initial state, no generation started
 *   loading  — generation is in progress
 *   done     — generation completed successfully
 *   error    — generation failed, error message available
 */
export const PIPELINE_STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  DONE: "done",
  ERROR: "error",
};

/**
 * TOTAL_STEPS
 * Derived constant — avoids magic number 5 in components.
 * Used in PipelineTracker to render the correct number of
 * step cards and in useDocGeneration to detect completion.
 */
export const TOTAL_STEPS = PIPELINE_STEPS.length;

/**
 * getStepByIndex
 * Utility — safely retrieves a step object by its numeric index.
 * Prevents out-of-bounds access in the hook during step iteration.
 *
 * @param {number} index
 * @returns {object|null}
 */
export function getStepByIndex(index) {
  return PIPELINE_STEPS[index] ?? null;
}

/**
 * getProgressForStep
 * Returns the progress bar percentage for a given step index.
 * Returns 0 for idle, 100 for completed (past last step).
 *
 * @param {number} currentStep  — index of the currently active step
 * @param {string} status       — value from PIPELINE_STATUS
 * @returns {number}            — integer 0–100
 */
export function getProgressForStep(currentStep, status) {
  if (status === PIPELINE_STATUS.IDLE) return 0;
  if (status === PIPELINE_STATUS.DONE) return 100;
  if (status === PIPELINE_STATUS.ERROR) return getStepByIndex(currentStep)?.progressPct ?? 0;
  return getStepByIndex(currentStep)?.progressPct ?? 0;
}