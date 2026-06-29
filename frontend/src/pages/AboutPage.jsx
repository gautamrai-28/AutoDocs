/**
 * pages/AboutPage.jsx
 * UI Polish Pass: hero gets a decorative icon cluster and
 * stat strip, Section wrapper gets stronger heading contrast,
 * "What is AutoDocs" gets icon-decorated highlight boxes.
 */

import WorkflowTimeline from "../components/about/WorkflowTimeline";
import FeatureGrid      from "../components/about/FeatureGrid";
import AdvantagesGrid   from "../components/about/AdvantagesGrid";
import HowToUseList     from "../components/about/HowToUseList";

function Section({ tag, heading, lead, children }) {
  return (
    <section className="mb-[56px]">
      <div className="flex items-center gap-[8px] mb-[16px]">
        <span className="text-[10px] font-bold tracking-[0.12em] uppercase whitespace-nowrap" style={{ color: "#4ade80" }}>
          {tag}
        </span>
        <div
          className="flex-1 h-[1px]"
          style={{ background: "linear-gradient(90deg, rgba(74,222,128,0.30), transparent)" }}
          aria-hidden="true"
        />
      </div>
      <h2 className="text-[24px] font-semibold text-dark tracking-[-0.02em] mb-[10px] leading-[1.2]">
        {heading}
      </h2>
      {lead && (
        <p className="text-[13px] leading-[1.75] mb-[24px] max-w-[560px]" style={{ color: "#4A4A4A", opacity: 0.68 }}>
          {lead}
        </p>
      )}
      {children}
    </section>
  );
}

const HERO_STATS = [
  { icon: "ti-files",   value: "100%", label: "Coverage"  },
  { icon: "ti-bolt",    value: "10×",  label: "Faster"    },
  { icon: "ti-code",    value: "Any",  label: "Language"  },
];

export default function AboutPage() {
  return (
    <div className="max-w-[820px] mx-auto px-8 pt-[52px] pb-[64px]">

      {/* ── Hero ─────────────────────────────────────────── */}
      <header className="text-center mb-[64px]">
        {/* Pill tag */}
        <div className="inline-flex items-center gap-[7px] mb-[22px] px-[16px] py-[7px] rounded-full"
          style={{ background: "rgba(109,129,147,0.07)", border: "1px solid rgba(109,129,147,0.20)" }}
        >
          <i className="ti ti-sparkles text-[12px]" style={{ color: "#6D8193" }} aria-hidden="true" />
          <span className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ color: "#6D8193" }}>
            Open Source · AI-Powered
          </span>
        </div>

        <h1 className="text-[40px] font-light text-dark tracking-[-0.025em] leading-[1.15] mb-[16px]">
          Meet{" "}
          <strong
            className="font-semibold"
            style={{
              background: "linear-gradient(135deg, #6D8193, #4a6070)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            AutoDocs
          </strong>
        </h1>

        <p className="text-[15px] leading-[1.72] max-w-[560px] mx-auto mb-[36px]" style={{ color: "#4A4A4A", opacity: 0.68 }}>
          The autonomous documentation engine that reads your codebase,
          understands it, and writes comprehensive developer documentation —
          in seconds, not days.
        </p>

        {/* Hero stat strip */}
        <div className="inline-flex items-center gap-0 rounded-[12px] overflow-hidden border border-gray-muted/60" style={{ boxShadow: "0 1px 4px rgba(74,74,74,0.05)" }}>
          {HERO_STATS.map((s, i) => (
            <div
              key={s.label}
              className={`flex items-center gap-[8px] px-[20px] py-[12px] ${i < HERO_STATS.length - 1 ? "border-r border-gray-muted/60" : ""}`}
            >
              <i className={`ti ${s.icon} text-[14px]`} style={{ color: "#6D8193" }} aria-hidden="true" />
              <div className="text-left">
                <p className="text-[13px] font-semibold text-dark leading-none">{s.value}</p>
                <p className="text-[10px] mt-[2px]" style={{ color: "#4A4A4A", opacity: 0.50 }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* ── What is AutoDocs ──────────────────────────────── */}
      <Section tag="What is AutoDocs" heading="Documentation that writes itself" lead={null}>
        <div className="flex flex-col gap-[12px]">
          <div
            className="flex gap-[14px] p-[16px_18px] rounded-[12px]"
            style={{ background: "rgba(109,129,147,0.05)", border: "1px solid rgba(109,129,147,0.14)" }}
          >
            <i className="ti ti-robot text-[18px] flex-shrink-0 mt-[1px]" style={{ color: "#6D8193" }} aria-hidden="true" />
            <p className="text-[13px] leading-[1.75]" style={{ color: "#4A4A4A", opacity: 0.72 }}>
              AutoDocs is an AI-powered developer productivity tool that eliminates one of the most
              time-consuming parts of software development — writing documentation. By combining
              repository analysis with large language models, AutoDocs reads your code, understands
              its structure, and produces professional-grade documentation automatically.
            </p>
          </div>
          <div
            className="flex gap-[14px] p-[16px_18px] rounded-[12px]"
            style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.15)" }}
          >
            <i className="ti ti-users text-[18px] flex-shrink-0 mt-[1px]" style={{ color: "#4ade80" }} aria-hidden="true" />
            <p className="text-[13px] leading-[1.75]" style={{ color: "#4A4A4A", opacity: 0.72 }}>
              Whether you're onboarding new engineers, open-sourcing a project, or simply trying to
              understand a codebase you didn't write — AutoDocs turns hours of manual work into a
              single click.
            </p>
          </div>
        </div>
      </Section>

      {/* ── How it works ──────────────────────────────────── */}
      <Section
        tag="How it works"
        heading="Six steps from repo to docs"
        lead="AutoDocs runs a fully automated pipeline from URL to downloadable documentation. Here's exactly what happens under the hood."
      >
        <WorkflowTimeline />
      </Section>

      {/* ── Features ──────────────────────────────────────── */}
      <Section
        tag="Features"
        heading="Everything your codebase needs"
        lead="AutoDocs generates four types of documentation in a single run — all tailored to the specific repository."
      >
        <FeatureGrid />
      </Section>

      {/* ── Advantages ────────────────────────────────────── */}
      <Section
        tag="Advantages"
        heading="Why teams use AutoDocs"
        lead="Real impact numbers for the most common documentation pain points."
      >
        <AdvantagesGrid />
      </Section>

      {/* ── How to use ────────────────────────────────────── */}
      <Section tag="How to use" heading="Up and running in 30 seconds" lead={null}>
        <HowToUseList />
      </Section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer
        className="flex items-center justify-between pt-[24px] mt-[8px]"
        style={{ borderTop: "1px solid #CBCBCB" }}
      >
        <p className="text-[12px]" style={{ color: "#000000", opacity: 0.5 }}>
          Developed by <span className="font-semibold" style={{ opacity: 1, color: "#030303" }}>Gautam</span>
        </p>

        <a
          href="https://github.com/gautamrai-28"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-[6px] text-[12px] no-underline transition-colors duration-150"
          style={{ color: "#000000" }}
          onMouseEnter={e => e.currentTarget.style.color = "#000000"}
          onMouseLeave={e => e.currentTarget.style.color = "#000000".opacity = 0.5 ? "#6D8193" : "#000000"}
          aria-label="Visit Gautam's GitHub profile"
        >
          <i className="ti ti-brand-github text-[15px]" aria-hidden="true" />
          Github
        </a>
      </footer>

    </div>
  );
}