/**
 * main.jsx — Vite Entry Point
 *
 * The single file Vite uses as the JavaScript entry point
 * (referenced in index.html as type="module" src="/src/main.jsx").
 *
 * Responsibilities:
 *   - Import the global Tailwind v4 stylesheet
 *   - Mount the React application to the #root DOM node
 *   - Wrap in StrictMode to surface potential issues early
 *
 * Nothing else belongs here. Providers, routing, and layout
 * all live in App.jsx — this file just boots the engine.
 *
 * Placement: src/main.jsx  (replaces the Vite default)
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import "./assets/index.css";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);