import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { attachConsole } from "@tauri-apps/plugin-log";
import { reportError } from "./components/ErrorBoundary";

attachConsole().catch((err) => {
  console.error("Failed to attach Tauri console logger:", err);
});

// Anything that escapes React still ends up in the app log.
window.addEventListener("error", (e) => reportError("window", e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => reportError("promise", e.reason));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
