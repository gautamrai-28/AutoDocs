/**
 * components/dashboard/ReadmePreview.jsx
 *
 * Renders the AI-generated README.md content in a full-width card.
 * The raw markdown is shown as plain text so the user can review the
 * entire generated README without relying on the ZIP download.
 *
 * Placement: src/components/dashboard/ReadmePreview.jsx
 */

/**
 * @param {{
 *   content: string   — raw markdown string from the API
 * }} props
 */
export default function ReadmePreview({ content = "" }) {
  return (
    <div className="card-result p-[20px] col-span-2">

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
          <i className="ti ti-file-description" />
        </div>
        <div>
          <p className="text-[12px] font-semibold text-dark">Generated README</p>
          <p className="text-[11px] text-accent mt-[1px]">
            AI-generated from repository analysis
          </p>
        </div>
      </div>

      <div
        className="
          relative
          border border-gray-muted/70
          rounded-[10px]
          bg-white
          p-[16px_18px]
          max-h-[650px]
          overflow-y-auto
        "
        // style={{ "max-height": "500px",
        //          "overflow-y": "auto" }}
      >
        {content ? (
          <pre
            className="
              text-[12px] leading-[1.8] text-dark
              whitespace-pre-wrap break-words
              font-[Helvetica,Arial,sans-serif]
              m-0
            "
            aria-label="README content preview"
          >
            {content}
          </pre>
        ) : (
          <p className="text-[12px] text-gray-muted italic">
            README content not available.
          </p>
        )}

      </div>
    </div>
  );
}