import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { attachConsole, info } from "@tauri-apps/plugin-log";
import { reportError } from "./components/ErrorBoundary";

attachConsole().catch((err) => {
  console.error("Failed to attach Tauri console logger:", err);
});

// The window has WebView2 zoom control on so trackpad pinch is delivered to the
// page (as Ctrl+wheel). Block the browser's own page zoom everywhere; the schema
// canvas listens for the same events and zooms itself.
let ctrlWheelLogged = false;
window.addEventListener("wheel", (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  if (!ctrlWheelLogged) {
    ctrlWheelLogged = true;
    const t = e.target as HTMLElement;
    info(`app: ctrl-wheel received (deltaY=${e.deltaY}, over canvas=${!!t.closest?.(".react-flow")})`).catch(() => {});
  }
}, { passive: false, capture: true });
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && ["=", "+", "-", "0"].includes(e.key)) e.preventDefault();
}, { capture: true });

// Anything that escapes React still ends up in the app log.
window.addEventListener("error", (e) => reportError("window", e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => reportError("promise", e.reason));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
