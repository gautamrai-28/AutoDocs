/**
 * components/about/AdvantagesGrid.jsx
 *
 * Renders the "Why teams use AutoDocs" section as a
 * 3-column grid of impact metric cards.
 *
 * Each card shows a large impact number, a unit label,
 * a benefit title, and a supporting description.
 *
 * Fully presentational — hardcoded content, no props, no state.
 *
 * Placement: src/components/about/AdvantagesGrid.jsx
 */

const ADVANTAGES = [
  {
    metric:      "10×",
    unit:        "faster",
    title:       "Documentation speed",
    description: "Generate comprehensive docs in seconds vs. days of manual writing",
  },
  {
    metric:      "↓80%",
    unit:        "reduction",
    title:       "Onboarding time",
    description: "New engineers understand codebases faster with clear, consistent docs",
  },
  {
    metric:      "100%",
    unit:        "coverage",
    title:       "Repository coverage",
    description: "Every folder, key file, and entry point is documented automatically",
  },
  {
    metric:      "0",
    unit:        "config needed",
    title:       "Zero setup",
    description: "Paste a URL and click Generate — no config files or integrations required",
  },
  {
    metric:      "∞",
    unit:        "repositories",
    title:       "Any public repo",
    description: "Works with any language, framework, or repository structure on GitHub",
  },
  {
    metric:      "1",
    unit:        "click download",
    title:       "Instant export",
    description: "All docs packaged into a ready-to-commit ZIP in a single download",
  },
];

export default function AdvantagesGrid() {
  return (
    <div className="grid grid-cols-3 gap-[12px]">
      {ADVANTAGES.map((adv) => (
        <div
          key={adv.title}
          className="
            border border-gray-muted/70
            rounded-[12px]
            p-[18px]
            bg-white
            text-center
            transition-all duration-200
            hover:shadow-[0_4px_16px_rgba(74,74,74,0.07)]
            hover:-translate-y-[1px]
          "
          style={{ boxShadow: "0 1px 3px rgba(74,74,74,0.03)" }}
        >
          {/* Impact number */}
          <p
            className="text-[28px] font-light text-accent leading-none tracking-[-0.02em]"
            aria-label={`${adv.metric} ${adv.unit}`}
          >
            {adv.metric}
          </p>

          {/* Unit */}
          <p className="text-[10px] text-gray-muted mt-[3px] tracking-[0.04em]">
            {adv.unit}
          </p>

          {/* Title */}
          <p className="text-[11px] font-semibold text-dark mt-[10px]">
            {adv.title}
          </p>

          {/* Description */}
          <p className="text-[11px] text-accent mt-[4px] leading-[1.55]">
            {adv.description}
          </p>
        </div>
      ))}
    </div>
  );
}