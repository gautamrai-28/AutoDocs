/**
 * pages/DashboardPage.jsx — Main Generation Interface
 * UI Polish Pass: darker hero text, richer empty state with
 * decorated feature pills, stronger contrast throughout.
 */

import { useDocGeneration } from "../hooks/useDocGeneration";
import UrlInputCard         from "../components/dashboard/UrlInputCard";
import PipelineTracker      from "../components/dashboard/PipelineTracker";
import ResultsPanel         from "../components/dashboard/ResultsPanel";
import DownloadBar          from "../components/dashboard/DownloadBar";
import { useDocContext }    from "../context/DocContext";

export default function DashboardPage() {
  const {
    isIdle, isLoading, isDone,
    currentStep, generatedDocs, elapsedMs,
    onGenerate, onReset,
  } = useDocGeneration();

  const { repoUrl } = useDocContext();

  return (
    <div className="max-w-[820px] mx-auto px-8 pt-[52px] pb-[48px]">

      {/* ── Eyebrow ───────────────────────────────────────── */}
      <div className="flex items-center gap-[8px] mb-[20px]">
        <span className="eyebrow-dot" aria-hidden="true" />
        <span className="label-accent tracking-[0.08em]">AI-Powered Documentation</span>
      </div>

      {/* ── Hero ──────────────────────────────────────────── */}
      <h1 className="text-[38px] font-light leading-[1.15] tracking-[-0.025em] text-dark mb-4">
        Autonomous{" "}
        <strong
          className="font-semibold"
          style={{
            background: "linear-gradient(135deg, #6D8193, #4a6070)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Codebase Documenter
        </strong>
      </h1>

      <p className="text-[14px] leading-[1.75] max-w-[500px] mb-[40px] font-normal" style={{ color: "#4A4A4A", opacity: 0.72 }}>
        Paste a public GitHub repository URL. We'll clone it, scan it, and
        generate comprehensive AI-written documentation — packaged into a
        downloadable ZIP.
      </p>

      {/* ── URL Input Card ────────────────────────────────── */}
      <UrlInputCard onGenerate={onGenerate} onReset={onReset} />

      {/* ── Pipeline Tracker ──────────────────────────────── */}
      {isLoading && <PipelineTracker currentStep={currentStep} />}

      {/* ── Results ───────────────────────────────────────── */}
      {isDone && generatedDocs && (
        <>
          <ResultsPanel docs={generatedDocs} elapsedMs={elapsedMs} />
          <DownloadBar
            jobId={generatedDocs.job_id}
            repoUrl={repoUrl}
            docCount={generatedDocs.doc_count}
          />
        </>
      )}

      {/* ── Empty state ───────────────────────────────────── */}
      {isIdle && <EmptyState />}

    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────

const FEATURE_PILLS = [
  { icon: "ti-file-description", label: "AI README"          },
  { icon: "ti-folder-search",    label: "Folder summaries"   },
  { icon: "ti-code-asterisk",    label: "File explanations"  },
  { icon: "ti-file-zip",         label: "ZIP export"         },
];

function EmptyState() {
  return (
    <div className="text-center pt-[56px] pb-[40px]">
      {/* Icon cluster */}
      <div className="relative inline-flex items-center justify-center mb-[22px]">
        <div
          className="w-[64px] h-[64px] rounded-[18px] flex items-center justify-center text-[28px]"
          style={{
            background: "linear-gradient(135deg, rgba(109,129,147,0.10), rgba(74,222,128,0.06))",
            border: "1px solid rgba(109,129,147,0.18)",
            color: "#6D8193",
          }}
          aria-hidden="true"
        >
          <i className="ti ti-git-merge" />
        </div>
      </div>

      <h2 className="text-[22px] font-light text-dark mb-[10px] tracking-[-0.02em]">
        Ready to document
      </h2>
      <p className="text-[13px] leading-[1.7] mb-[28px]" style={{ color: "#4A4A4A", opacity: 0.6 }}>
        Paste any public GitHub repository URL above and click{" "}
        <span className="font-semibold" style={{ color: "#6D8193", opacity: 1 }}>Generate</span>{" "}
        to begin.
      </p>

      {/* Feature pills */}
      <div className="flex flex-wrap items-center justify-center gap-[8px]">
        {FEATURE_PILLS.map(({ icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-[6px] px-[12px] py-[6px] rounded-full text-[11px] font-medium"
            style={{
              background: "rgba(109,129,147,0.07)",
              border:     "1px solid rgba(109,129,147,0.18)",
              color:      "#4A4A4A",
            }}
          >
            <i className={`ti ${icon} text-[12px]`} style={{ color: "#6D8193" }} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}