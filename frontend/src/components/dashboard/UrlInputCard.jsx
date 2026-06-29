/**
 * components/dashboard/UrlInputCard.jsx
 *
 * The primary input surface on the Dashboard.
 * Handles URL entry, generation option toggles,
 * inline validation feedback, and the progress
 * bar + status line that appear during generation.
 *
 * Smart/dumb split:
 *   - "Smart" for its own local URL string state
 *   - Reads repoUrl / options / status from context
 *     via useDocContext so it stays in sync with the hook
 *   - Calls onGenerate / onReset passed down from DashboardPage
 *
 * Placement: src/components/dashboard/UrlInputCard.jsx
 */

import { useState, useEffect } from "react";
import { useDocContext }      from "../../context/DocContext";
import { validateGithubUrl }  from "../../utils/validators";
import {
  PIPELINE_STATUS,
  PIPELINE_STEPS,
  getProgressForStep,
} from "../../constants/pipeline";

// ─── Chip option definitions ──────────────────────────────────────────────
const OPTION_CHIPS = [
  { key: "readme",  label: " 📖README"               },
  { key: "folders", label: "  📂Folder summaries"         },
  { key: "files",   label: " 📄File explanations"          },
];

// ─── Component ────────────────────────────────────────────────────────────

/**
 * @param {{
 *   onGenerate: () => void,
 *   onReset:    () => void,
 * }} props
 */
export default function UrlInputCard({ onGenerate, onReset }) {
  const {
    repoUrl,
    setUrl,
    options,
    setOption,
    status,
    currentStep,
    error,
  } = useDocContext();

  // Local validation message — only shown after the user
  // has interacted with the input (not on initial render).
  const [touched,         setTouched]         = useState(false);
  const [validationMsg,   setValidationMsg]    = useState("");

  const isLoading = status === PIPELINE_STATUS.LOADING;
  const isDone    = status === PIPELINE_STATUS.DONE;
  const isError   = status === PIPELINE_STATUS.ERROR;

  // Re-validate whenever the URL changes (only after first touch)
  useEffect(() => {
    if (!touched) return;
    const result = validateGithubUrl(repoUrl);
    setValidationMsg(result.valid ? "" : result.message);
  }, [repoUrl, touched]);

  // ── Handlers ────────────────────────────────────────────────

  function handleUrlChange(e) {
    setTouched(true);
    setUrl(e.target.value);
  }

  function handleSubmit() {
    setTouched(true);
    const result = validateGithubUrl(repoUrl);
    if (!result.valid) {
      setValidationMsg(result.message);
      return;
    }
    onGenerate();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleSubmit();
  }

  function handleReset() {
    setTouched(false);
    setValidationMsg("");
    onReset();
  }

  // ── Derived UI values ────────────────────────────────────────

  const urlIsValid    = validateGithubUrl(repoUrl).valid;
  const showValidErr  = touched && validationMsg && !isLoading;
  const progressPct   = getProgressForStep(currentStep, status);

  // Status line text shown below the progress bar
  function getStatusText() {
    if (isError)   return error ?? "Generation failed.";
    if (isDone)    return "Documentation ready.";
    if (isLoading && currentStep >= 0) {
      return PIPELINE_STEPS[currentStep]?.description ?? "Processing…";
    }
    return "";
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="card-base p-[26px_28px] mb-[22px]">

      {/* ── Section label ─────────────────────────────────── */}
      <p className="label-accent flex items-center gap-[6px] mb-[14px]">
        <i className="ti ti-brand-github text-[13px]" aria-hidden="true" />
        Repository URL
      </p>

      {/* ── URL input row ─────────────────────────────────── */}
      <div className="flex gap-[10px] items-stretch">

        {/* Input wrapper */}
        <div className={`input-wrap flex-1 ${showValidErr ? "border-red-400!" : ""}`}>
          <i
            className="ti ti-link text-[15px] text-gray-muted flex-shrink-0"
            aria-hidden="true"
          />
          <input
            type="text"
            value={repoUrl}
            onChange={handleUrlChange}
            onKeyDown={handleKeyDown}
            placeholder="https://github.com/owner/repository"
            className="input-field"
            disabled={isLoading}
            aria-label="GitHub repository URL"
            aria-invalid={showValidErr ? "true" : "false"}
            aria-describedby={showValidErr ? "url-error" : undefined}
            autoComplete="off"
            spellCheck="false"
          />
          {/* Clear button — only when there is a URL and not loading */}
          {repoUrl && !isLoading && (
            <button
              onClick={() => { setUrl(""); setTouched(false); setValidationMsg(""); }}
              className="text-gray-muted hover:text-dark transition-colors duration-150 flex-shrink-0 p-[2px]"
              aria-label="Clear URL"
            >
              <i className="ti ti-x text-[14px]" />
            </button>
          )}
        </div>

        {/* Generate / Reset button */}
        {isDone || isError ? (
          <button
            onClick={handleReset}
            className="btn-primary"
            aria-label="Reset and try another repository"
          >
            <i className="ti ti-refresh text-[14px]" aria-hidden="true" />
            New repo
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isLoading || (touched && !urlIsValid)}
            className={`btn-primary ${isLoading ? "loading" : ""}`}
            aria-label={isLoading ? "Generating documentation…" : "Generate documentation"}
          >
            {isLoading ? (
              <>
                {/* Inline CSS spinner — no extra component needed here */}
                <span
                  className="inline-block w-[13px] h-[13px] rounded-full border-2 border-white/30 border-t-white flex-shrink-0"
                  style={{ animation: "spin 0.75s linear infinite" }}
                  aria-hidden="true"
                />
                Running
              </>
            ) : (
              <>
                Generate
                <i className="ti ti-arrow-right text-[14px]" aria-hidden="true" />
              </>
            )}
          </button>
        )}
      </div>

      {/* ── Inline validation error ───────────────────────── */}
      {showValidErr && (
        <p
          id="url-error"
          role="alert"
          className="text-[11px] text-red-500 mt-[8px] flex items-center gap-[5px]"
        >
          <i className="ti ti-alert-circle text-[12px]" aria-hidden="true" />
          {validationMsg}
        </p>
      )}

      {/* ── Option chips ──────────────────────────────────── */}
      <div className="flex flex-wrap gap-[7px] mt-[16px]">
        {OPTION_CHIPS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setOption(key, !options[key])}
            disabled={isLoading}
            aria-pressed={options[key]}
            className={`chip ${options[key] ? "active" : ""} ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
          >
            <i className={`${icon} text-[12px]`} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Progress bar + status (visible while loading or done) ── */}
      {(isLoading || isDone || isError) && (
        <div className="mt-[20px]">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${isDone ? 100 : isError ? progressPct : progressPct}%` }}
              role="progressbar"
              aria-valuenow={isDone ? 100 : progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Documentation generation progress"
            />
          </div>

          {/* Status row */}
          <div className="flex items-center gap-[8px] mt-[10px]">
            {isLoading && <span className="status-dot" aria-hidden="true" />}
            {isError   && <i className="ti ti-alert-circle text-[13px] text-red-400" aria-hidden="true" />}
            {isDone    && <i className="ti ti-circle-check text-[13px] text-green-400" aria-hidden="true" />}
            <span
              className={`text-[12px] font-medium ${
                isError ? "text-red-400" : isDone ? "text-dark" : "text-accent"
              }`}
            >
              {getStatusText()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
} 