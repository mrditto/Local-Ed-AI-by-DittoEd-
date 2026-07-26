import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyTextSize, loadPersonalization } from "./config/personalization";
import "./styles/globals.css";

// Applied before the first render so there's no flash of the wrong text size.
applyTextSize(loadPersonalization().textSize);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
