/**
 * App.jsx — Application Root
 *
 * The composition root of the entire frontend.
 * Wires together every top-level provider and the router.
 *
 * Layer order (outermost → innermost):
 *   BrowserRouter   — provides routing context to all NavLinks/Routes
 *   DocProvider     — provides shared generation state to all pages
 *   MainLayout      — renders Topbar + background glows + <main>
 *   Routes          — maps URL paths to page components
 *
 * This file should stay small (< 30 lines of JSX).
 * All logic lives in hooks. All layout lives in MainLayout.
 * All state lives in DocContext.
 *
 * Placement: src/App.jsx  (replaces the Vite default)
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DocProvider }  from "./context/DocContext";
import MainLayout       from "./components/layout/MainLayout";
import DashboardPage    from "./pages/DashboardPage";
import AboutPage        from "./pages/AboutPage";

export default function App() {
  
  return (
    <BrowserRouter>
      <DocProvider>
        <MainLayout>
          <Routes>
            {/* Main documentation generation interface */}
            <Route path="/"       element={<DashboardPage />} />

            {/* Product information and how-to page */}
            <Route path="/about"  element={<AboutPage />} />

            {/*
             * Catch-all — redirects any unknown path back to the
             * dashboard rather than showing a blank white screen.
             * Replace with a dedicated 404 page if needed later.
             */}
            <Route path="*"       element={<DashboardPage />} />
          </Routes>
        </MainLayout>
      </DocProvider>
    </BrowserRouter>
  );
}