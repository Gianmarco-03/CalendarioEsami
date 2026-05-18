import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { QuicklogApp } from "./quicklog";
import { ThemeProvider } from "./theme";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./index.css";

const label = (() => {
  try { return getCurrentWebviewWindow().label; } catch { return "main"; }
})();

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

if (label === "quicklog") {
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <QuicklogApp />
      </ThemeProvider>
    </React.StrictMode>,
  );
} else {
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </React.StrictMode>,
  );
}
