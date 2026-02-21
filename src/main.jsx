import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AgentProvider } from "./agents/agentContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AgentProvider>
      <App />
    </AgentProvider>
  </StrictMode>
);
