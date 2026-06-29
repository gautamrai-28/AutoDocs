/**
 * components/dashboard/DownloadBar.jsx
 *
 * The dark download strip rendered at the bottom of the
 * results section when documentation generation is complete.
 *
 * Responsibilities:
 *   - Display the ZIP filename and doc count metadata
 *   - Trigger the ZIP download via docService.downloadZip()
 *   - Manage its own local downloading state (spinner on click)
 *   - Show a success state after the download is triggered
 *
 * Placement: src/components/dashboard/DownloadBar.jsx
 */

import { useState } from "react";
import { downloadZip } from "../../services/docService";
import { formatZipFilename } from "../../utils/formatters";

/**
 * @param {{
 *   jobId:      string   — returned by the backend, needed for /api/download/:jobId
 *   repoUrl:    string   — used to derive a friendly filename
 *   docCount?:  number   — shown in the subtitle
 * }} props
 */
export default function DownloadBar({ jobId, repoUrl, docCount = 0 }) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded,  setDownloaded]  = useState(false);
  const [dlError,     setDlError]     = useState(null);

  const filename = formatZipFilename(repoUrl);

  async function handleDownload() {
    if (downloading || downloaded) return;

    setDownloading(true);
    setDlError(null);

    try {
      await downloadZip(jobId, filename);
      setDownloaded(true);
    } catch (err) {
      setDlError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="dl-bar fade-up fade-up-delay-4">

      {/* ── Icon ─────────────────────────────────────────── */}
      <div className="dl-icon-wrap flex-shrink-0" aria-hidden="true">
        <i className={`ti ${downloaded ? "ti-circle-check" : "ti-package"} text-[18px]`} />
      </div>

      {/* ── File metadata ─────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-white font-semibold truncate">
          {filename}
        </p>
        <p className="text-[11px] text-gray-muted mt-[3px]">
          {docCount > 0
            ? `${docCount} markdown ${docCount === 1 ? "file" : "files"} · README, folder summaries, file explanations`
            : "README, folder summaries, file explanations"}
        </p>

        {/* Download error */}
        {dlError && (
          <p className="text-[11px] text-red-400 mt-[4px] flex items-center gap-[5px]">
            <i className="ti ti-alert-circle text-[12px]" aria-hidden="true" />
            {dlError}
          </p>
        )}
      </div>

      {/* ── Download button ──────────────────────────────── */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className={`btn-download flex-shrink-0 ${downloading ? "opacity-70 pointer-events-none" : ""}`}
        aria-label={
          downloaded  ? "Documentation downloaded"    :
          downloading ? "Downloading…"                :
                        "Download documentation ZIP"
        }
      >
        {downloading ? (
          <>
            <span
              className="inline-block w-[13px] h-[13px] rounded-full border-2 border-white/30 border-t-white flex-shrink-0"
              style={{ animation: "spin 0.75s linear infinite" }}
              aria-hidden="true"
            />
            Downloading
          </>
        ) : downloaded ? (
          <>
            <i className="ti ti-circle-check text-[14px]" aria-hidden="true" />
            Downloaded
          </>
        ) : (
          <>
            <i className="ti ti-download text-[14px]" aria-hidden="true" />
            Download ZIP
          </>
        )}
      </button>
    </div>
  );
}