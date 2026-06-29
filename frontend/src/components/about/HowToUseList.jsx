/**
 * components/about/HowToUseList.jsx
 *
 * Renders the "How To Use" section as a vertical list of
 * step cards — each with an icon, a title, and instructions.
 *
 * The CTA button at the bottom navigates to the dashboard
 * using React Router's useNavigate hook.
 *
 * Placement: src/components/about/HowToUseList.jsx
 */

import { useNavigate } from "react-router-dom";

const HOW_TO_STEPS = [
  {
    icon:        "ti-clipboard",
    title:       "Copy a GitHub repository URL",
    description:
      "Navigate to any public GitHub repository and copy its URL from the browser address bar. It should look like: https://github.com/owner/repository",
  },
  {
    icon:        "ti-cursor-text",
    title:       "Paste it into AutoDocs",
    description:
      "Paste the URL into the repository input field on the Dashboard. Use the option chips to select which documentation types you want — README, folder summaries, and file explanations are all on by default.",
  },
  {
    icon:        "ti-player-play",
    title:       "Click Generate",
    description:
      "AutoDocs will clone the repo, scan it, and send the code to AI for analysis. Watch the pipeline tracker advance through each stage. The process typically takes 15–60 seconds depending on repository size.",
  },
  {
    icon:        "ti-download",
    title:       "Download your documentation",
    description:
      "Once generation is complete, click the Download ZIP button to save all generated Markdown files. Commit them directly to your repository's /docs folder — your codebase is now documented.",
  },
];

export default function HowToUseList() {
  const navigate = useNavigate();

  return (
    <div>
      {/* Steps */}
      <div className="flex flex-col gap-[12px] mb-[32px]">
        {HOW_TO_STEPS.map((step, i) => (
          <div
            key={step.title}
            className="
              flex items-start gap-[14px]
              border border-gray-muted/70
              rounded-[12px]
              p-[16px_18px]
              bg-white
              transition-all duration-200
              hover:border-accent/40
              hover:shadow-[0_3px_12px_rgba(109,129,147,0.08)]
            "
            style={{ boxShadow: "0 1px 3px rgba(74,74,74,0.03)" }}
          >
            {/* Icon */}
            <div
              className="
                w-[34px] h-[34px] rounded-[8px]
                flex items-center justify-center
                text-[15px] text-accent
                flex-shrink-0
              "
              style={{
                background:
                  "linear-gradient(135deg, rgba(109,129,147,0.10), rgba(74,222,128,0.06))",
                border: "1px solid rgba(109,129,147,0.20)",
              }}
              aria-hidden="true"
            >
              <i className={`ti ${step.icon}`} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0 pt-[1px]">
              <div className="flex items-center gap-[8px] mb-[4px]">
                {/* Step number badge */}
                <span
                  className="
                    text-[9px] font-bold text-accent
                    border border-accent/30
                    rounded-full
                    px-[6px] py-[1px]
                    tracking-[0.06em]
                    flex-shrink-0
                  "
                  style={{ background: "rgba(109,129,147,0.06)" }}
                  aria-hidden="true"
                >
                  STEP {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-[12px] font-semibold text-dark leading-tight">
                  {step.title}
                </h3>
              </div>
              <p className="text-[12px] text-accent leading-[1.65]">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div
        className="
          text-center
          pt-[28px]
          border-t border-gray-muted/50
        "
      >
        <p className="text-[12px] text-gray-muted mb-[16px]">
          Ready to document your first repository?
        </p>
        <button
          onClick={() => navigate("/")}
          className="btn-primary"
          aria-label="Go to the dashboard to generate documentation"
        >
          <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}