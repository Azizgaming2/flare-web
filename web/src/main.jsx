import React from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { TextZoom } from "@capacitor/text-zoom";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "@fontsource-variable/source-serif-4";
import "./index.css";
import "./redesign.css";

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add("native");
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  TextZoom.set({ value: 1 }).catch(() => {});

  const applyScale = () => {
    const width = Math.min(window.innerWidth, window.innerHeight);
    const scale = Math.min(1, Math.max(0.8, width / 390));
    document.documentElement.style.fontSize = `${16 * scale}px`;
  };
  applyScale();
  window.addEventListener("resize", applyScale);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);