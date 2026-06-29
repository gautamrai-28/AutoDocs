/**
 * components/about/FeatureGrid.jsx
 *
 * Renders the "Features" section as a 2×2 card grid.
 * Each card has a gradient icon, a title, and a description.
 *
 * Fully presentational — hardcoded content, no props, no state.
 *
 * Placement: src/components/about/FeatureGrid.jsx
 */

const FEATURES = [
  {
    icon: "ti-file-text",
    title: "README generation",
    description:
      "A complete, professional README.md including project overview, feature list, installation guide, and usage instructions — written by AI from your actual code, not templates.",
  },
  {
    icon: "ti-folder",
    title: "Folder summaries",
    description:
      "Each directory gets its own summary document explaining the folder's role, what it contains, and how it fits into the overall architecture of the project.",
  },
  {
    icon: "ti-code",
    title: "AI file explanations",
    description:
      "Every important source file is explained in clear technical language — what it does, how it works, and why it matters — without requiring the reader to read the code directly.",
  },
  {
    icon: "ti-package",
    title: "ZIP download",
    description:
      "All generated documentation is bundled into a single ZIP archive, making it trivial to add docs to any repository or share with your team in seconds.",
  },
];

export default function FeatureGrid() {
  return (
    <div className="grid grid-cols-2 gap-[14px]">
      {FEATURES.map((feature) => (
        <div
          key={feature.title}
          className="
            card-result p-[22px]
            transition-all duration-200
          "
        >
          {/* Icon */}
          <div
            className="
              w-[36px] h-[36px] rounded-[10px]
              flex items-center justify-center
              text-[17px] text-accent
              mb-[14px]
              flex-shrink-0
            "
            style={{
              background:
                "linear-gradient(135deg, rgba(109,129,147,0.12), rgba(74,222,128,0.08))",
              border: "1px solid rgba(109,129,147,0.20)",
            }}
            aria-hidden="true"
          >
            <i className={`ti ${feature.icon}`} />
          </div>

          {/* Text */}
          <h3 className="text-[13px] font-semibold text-dark mb-[6px]">
            {feature.title}
          </h3>
          <p className="text-[12px] text-accent leading-[1.7]">
            {feature.description}
          </p>
        </div>
      ))}
    </div>
  );
}