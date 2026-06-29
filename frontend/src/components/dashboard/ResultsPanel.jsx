/**
 * components/dashboard/ResultsPanel.jsx
 *
 * Orchestrates all result sub-components into a single
 * results section. Rendered by DashboardPage when
 * status === "done".
 *
 * Composes:
 *   - 3-column stat boxes (files / folders / docs)
 *   - FolderTree + FileList in a 2-column grid
 *   - ReadmePreview spanning full width
 *
 * Placement: src/components/dashboard/ResultsPanel.jsx
 */

import FolderTree    from "./FolderTree";
import FileList      from "./FileList";
import ReadmePreview from "./ReadmePreview";

/**
 * @param {{
 *   docs: {
 *     repo_name?:      string,
 *     file_count?:     number,
 *     folder_count?:   number,
 *     doc_count?:      number,
 *     folder_tree?:    object | string[],
 *     key_files?:      Array<{ name: string, role?: string }>,
 *     readme_preview?: string,
 *   },
 *   elapsedMs?: number
 * }} props
 */
export default function ResultsPanel({ docs, elapsedMs }) {
  if (!docs) return null;

  const {
    file_count   = 0,
    folder_count = 0,
    doc_count    = 0,
    folder_tree  = {},
    key_files    = [],
    readme_preview = "",
    readme_content = "",
  } = docs;

  return (
    <section aria-label="Generated documentation results">

      {/* ── Section label ─────────────────────────────────── */}
      <div className="flex items-center justify-between mb-[14px]">
        <p className="label-upper opacity-40">Generated documentation</p>
        {elapsedMs > 0 && (
          <p className="text-[10px] text-gray-muted">
            Generated in{" "}
            <span className="text-accent font-medium">
              {(elapsedMs / 1000).toFixed(1)}s
            </span>
          </p>
        )}
      </div>
      <hr className="section-divider" />

      {/* ── Stat boxes ────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-[10px] mb-[20px] fade-up">
        <StatBox value={file_count}   label="Files scanned"   />
        <StatBox value={folder_count} label="Folders mapped"  />
        <StatBox value={doc_count}    label="Docs generated"  />
      </div>

      {/* ── Two-column card grid ──────────────────────────── */}
      <div className="grid grid-cols-2 gap-[14px] mb-[20px]">
        <div className="fade-up fade-up-delay-1">
          <FolderTree
            folderTree={folder_tree}
            folderCount={folder_count}
          />
        </div>
        <div className="fade-up fade-up-delay-2">
          <FileList files={key_files} />
        </div>

        {/* Generated README spans both columns */}
        <div className="col-span-2 fade-up fade-up-delay-3">
          <ReadmePreview content={readme_content || readme_preview} />
        </div>
      </div>

    </section>
  );
}

// ─── StatBox sub-component ────────────────────────────────────────────────

/**
 * Individual stat box — a number with a label beneath it.
 * Internal to ResultsPanel; not exported.
 */
function StatBox({ value, label }) {
  return (
    <div className="stat-box">
      <p
        className="text-[30px] font-light text-dark leading-none tracking-[-0.03em]"
        aria-label={`${value} ${label}`}
      >
        {value}
      </p>
      <p className="text-[11px] text-accent font-medium mt-[6px]">{label}</p>
    </div>
  );
}