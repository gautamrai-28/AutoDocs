/**
 * components/layout/Topbar.jsx — Application Navigation Bar
 *
 * The persistent dark top bar rendered on every page.
 * Contains the logo (links to /) and the two nav items.
 *
 * Responsibilities:
 *   - Render the AutoDocs logo with gradient icon
 *   - Render Dashboard and About nav links
 *   - Apply active styling to the current route automatically
 *   - Never hold state or make API calls
 *
 * How it connects:
 *   - Imported exclusively by MainLayout
 *   - Uses NavLink from react-router-dom for active detection
 *   - Reads no context — fully stateless
 *
 * Placement: src/components/layout/Topbar.jsx
 */

import { NavLink } from "react-router-dom";

// Nav items defined as data so the JSX stays clean
// and adding a third page means editing one array, not the markup.
const NAV_ITEMS = [
  { label: "Dashboard", to: "/",      end: true  },
  { label: "About",     to: "/about", end: false },
];

export default function Topbar() {
  return (
    <header
      style={{ zIndex: "var(--z-topbar)" }}
      className="
        relative w-full h-[52px]
        bg-dark
        flex items-center justify-between
        px-8
      "
    >
      {/* ── Logo ─────────────────────────────────────────────── */}
      <NavLink
        to="/"
        className="flex items-center gap-[9px] no-underline group"
        aria-label="AutoDocs — go to dashboard"
      >
        {/* Gradient icon mark */}
        <span
          className="
            w-7 h-7 rounded-[7px]
            flex items-center justify-center
            text-white text-[13px]
            transition-opacity duration-150
            group-hover:opacity-90
          "
          style={{
            background: "linear-gradient(135deg, #6D8193, #4a6070)",
            boxShadow: "0 2px 8px rgba(109,129,147,0.4)",
          }}
          aria-hidden="true"
        >
          <i className="ti ti-file-code" />
        </span>

        {/* Wordmark */}
        <span className="text-white text-[13px] font-semibold tracking-[0.02em]">
          AutoDocs
        </span>
      </NavLink>

      {/* ── Navigation links ─────────────────────────────────── */}
      <nav className="flex items-center gap-1" aria-label="Main navigation">
        {NAV_ITEMS.map(({ label, to, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `
              text-[12px] font-normal tracking-[0.03em]
              px-[14px] py-[6px] rounded-[7px]
              border transition-all duration-150
              no-underline
              ${
                isActive
                  ? "text-white bg-white/10 border-white/[0.12]"
                  : "text-gray-muted bg-transparent border-transparent hover:text-white hover:bg-white/[0.07]"
              }
            `}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}