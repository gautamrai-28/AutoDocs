/**
 * components/layout/MainLayout.jsx — Application Shell
 *
 * The structural wrapper rendered around every page.
 * Composes Topbar + background decorations + {children}.
 *
 * Responsibilities:
 *   - Render the Topbar once (not per-page)
 *   - Render the two fixed background radial glow overlays
 *   - Provide a full-height white page surface beneath the topbar
 *   - Pass children through so pages render inside the shell
 *
 * How it connects:
 *   - Imported by App.jsx and wraps the <Routes> block
 *   - All page components (DashboardPage, AboutPage) become
 *     children of this layout automatically
 *   - Does not read context, hold state, or make API calls
 *
 * Placement: src/components/layout/MainLayout.jsx
 */

import Topbar from "./Topbar";

/**
 * @param {{ children: React.ReactNode }} props
 */
export default function MainLayout({ children }) {
  return (
    /*
     * Root container — full viewport height, white background.
     * overflow-x-hidden prevents the fixed radial glows from
     * creating a horizontal scrollbar on narrow viewports.
     */
    <div className="relative min-h-screen bg-white overflow-x-hidden">

      {/* ── Background radial glows ──────────────────────────
          Fixed position so they stay in the corners even
          when the page scrolls. pointer-events-none ensures
          they never intercept clicks or hover events.
          Classes are defined in index.css @layer components.
      ─────────────────────────────────────────────────────── */}
      <div className="bg-radial-accent" aria-hidden="true" />
      <div className="bg-radial-green"  aria-hidden="true" />

      {/* ── Top navigation bar ───────────────────────────────
          Sits above the page content at z-topbar (10).
          Defined in @theme as --z-topbar: 10.
      ─────────────────────────────────────────────────────── */}
      <Topbar />

      {/* ── Page content ─────────────────────────────────────
          Sits above the background glows (z-content = 1)
          but below the topbar (z-topbar = 10).
          Each page sets its own max-width and padding.
      ─────────────────────────────────────────────────────── */}
      <main
        className="relative"
        style={{ zIndex: "var(--z-content)" }}
      >
        {children}
      </main>

    </div>
  );
}