import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { attachConsole } from "@tauri-apps/plugin-log";

attachConsole().catch((err) => {
  console.error("Failed to attach Tauri console logger:", err);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
