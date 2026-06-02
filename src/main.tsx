import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { WakeGate } from "@/components/WakeGate";
import "@/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <WakeGate />
  </StrictMode>,
);
