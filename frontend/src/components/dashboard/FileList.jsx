/**
 * components/dashboard/FileList.jsx
 *
 * Renders the list of key files identified by the backend,
 * each with a type badge and a language-specific icon.
 *
 * Fully presentational — receives files array as a prop.
 *
 * Placement: src/components/dashboard/FileList.jsx
 */

import { formatFileBadge, formatFileIcon } from "../../utils/formatters";

/**
 * @param {{
 *   files: Array<{
 *     name:  string,
 *     path?: string,
 *     role?: string   — "entry" | "core" | "config" | "ui" | "test" | "docs"
 *   }>
 * }} props
 */
export default function FileList({ files = [] }) {
  return (
    <div className="card-result p-[20px]">
      {/* Card header */}
      <div className="flex items-center gap-[10px] mb-[14px]">
        <div
          className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center text-[14px] text-accent flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(109,129,147,0.10), rgba(109,129,147,0.05))",
            border: "1px solid rgba(109,129,147,0.20)",
          }}
          aria-hidden="true"
        >
          <i className="ti ti-files" />
        </div>
        <div>
          <p className="text-[12px] font-semibold text-dark">Key files identified</p>
          <p className="text-[11px] text-accent mt-[1px]">Important files prioritized</p>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 ? (
        <ul className="list-none" role="list">
          {files.map((file, i) => {
            const name  = file.name  ?? file.path ?? `file-${i}`;
            const badge = formatFileBadge(name, file.role);
            const icon  = formatFileIcon(name);

            return (
              <li
                key={`${name}-${i}`}
                className="
                  flex items-center gap-[8px]
                  py-[7px]
                  border-b border-gray-muted/50
                  last:border-b-0
                  text-[11px] text-dark font-medium
                "
              >
                <i
                  className={`${icon} text-[13px] text-accent flex-shrink-0`}
                  aria-hidden="true"
                />
                <span className="truncate flex-1 min-w-0" title={name}>
                  {name}
                </span>
                <span className="badge flex-shrink-0">{badge}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[11px] text-gray-muted italic">No key files identified.</p>
      )}
    </div>
  );
}