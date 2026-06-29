/**
 * components/dashboard/PipelineTracker.jsx
 *
 * Renders the 5-step horizontal pipeline visualization.
 * Each step card transitions through three visual states:
 *   idle   — muted icon ring, faded label
 *   active — gradient icon ring, glowing card border, accent label
 *   done   — dark solid icon ring, full-opacity label
 *
 * Fully presentational — receives currentStep as a prop
 * and derives all visual state from it. Zero side effects.
 *
 * How it connects:
 *   - Imported by DashboardPage
 *   - currentStep comes from useDocGeneration hook
 *   - Step definitions come from constants/pipeline.js
 *
 * Placement: src/components/dashboard/PipelineTracker.jsx
 */

import { PIPELINE_STEPS } from "../../constants/pipeline";

/**
 * @param {{ currentStep: number }} props
 *   currentStep — index of the currently active step (0–4).
 *                 -1 means no step is active (idle / done / error).
 */
export default function PipelineTracker({ currentStep }) {
  return (
    <section aria-label="Documentation generation pipeline" className="mb-[26px]">

      {/* ── Section label ────────────────────────────────── */}
      <div className="flex items-center gap-0 mb-[14px]">
        <p className="label-upper opacity-40 flex-1">Processing pipeline</p>
      </div>
      <hr className="section-divider" />

      {/* ── Step grid ────────────────────────────────────── */}
      <div
        className="grid gap-[8px]"
        style={{ gridTemplateColumns: `repeat(${PIPELINE_STEPS.length}, 1fr)` }}
      >
        {PIPELINE_STEPS.map((step) => {
          const isActive = step.index === currentStep;
          const isDone   = step.index <  currentStep;

          return (
            <div
              key={step.id}
              className={`step-card ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
              aria-current={isActive ? "step" : undefined}
              title={step.description}
            >
              {/* Icon ring */}
              <div className="step-icon-ring" aria-hidden="true">
                {isDone ? (
                  /* Checkmark when step is complete */
                  <i className="ti ti-check text-[14px]" />
                ) : (
                  <i
                    className={`${step.icon} text-[14px] ${
                      isActive
                        ? "animate-[spin_1.2s_ease-in-out_1]"  // single rotation on activate
                        : ""
                    }`}
                  />
                )}
              </div>

              {/* Label */}
              <p className="step-label">{step.label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}