/**
 * components/about/WorkflowTimeline.jsx
 *
 * Renders the "How AutoDocs Works" section as a vertical
 * numbered timeline. Each step has a gradient numbered
 * circle, a connecting line to the next step, a title,
 * and a description.
 *
 * Fully presentational — hardcoded content, no props, no state.
 *
 * Placement: src/components/about/WorkflowTimeline.jsx
 */

const STEPS = [
  {
    number: "01",
    title: "Paste your GitHub URL",
    description:
      "Enter any public GitHub repository URL into the dashboard input field. AutoDocs accepts any valid public github.com repository link.",
  },
  {
    number: "02",
    title: "Repository cloning",
    description:
      "The backend securely clones the repository using GitPython, creating a local snapshot for analysis without requiring any credentials.",
  },
  {
    number: "03",
    title: "Intelligent file scanning",
    description:
      "AutoDocs scans every folder and file, mapping the full directory structure and identifying key entry points, configuration files, and core source modules.",
  },
  {
    number: "04",
    title: "AI analysis LLM API",
    description:
      "Selected source files are sent to the LLM API with carefully engineered prompts. The model explains each file's purpose, logic, and role within the project architecture.",
  },
  {
    number: "05",
    title: "Documentation generation",
    description:
      "File explanations, folder summaries, and a professional README are compiled into clean, structured Markdown documents ready for any repository.",
  },
  {
    number: "06",
    title: "ZIP export",
    description:
      "All generated Markdown files are packaged into a single downloadable ZIP archive. Commit them directly into your repository's /docs folder in one step.",
  },
];

export default function WorkflowTimeline() {
  return (
    <div className="flex flex-col gap-0">
      {STEPS.map((step, i) => {
        const isLast = i === STEPS.length - 1;

        return (
          <div key={step.number} className="flex gap-[20px]">

            {/* ── Left column: number + connector line ─────── */}
            <div className="flex flex-col items-center flex-shrink-0">
              {/* Numbered circle */}
              <div
                className="
                  w-[36px] h-[36px] rounded-full
                  flex items-center justify-center
                  text-white text-[12px] font-bold
                  flex-shrink-0
                  relative z-[1]
                "
                style={{
                  background: "linear-gradient(135deg, #6D8193, #4a6070)",
                  boxShadow: "0 2px 8px rgba(109,129,147,0.30)",
                }}
                aria-hidden="true"
              >
                {step.number}
              </div>

              {/* Connector line — hidden on last step */}
              {!isLast && (
                <div
                  className="w-[1px] flex-1 mt-[6px]"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(109,129,147,0.30), transparent)",
                    minHeight: "32px",
                  }}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* ── Right column: content ─────────────────────── */}
            <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-[28px]"} pt-[6px]`}>
              <h3 className="text-[13px] font-semibold text-dark mb-[5px] leading-tight">
                {step.title}
              </h3>
              <p className="text-[12px] text-accent leading-[1.7]">
                {step.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}