import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ErrorBoundary } from "./app/components/ErrorBoundary";
import { logTerminal } from "./lib/terminalLog";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

// 전역 에러 핸들러 — 캐치 안 된 throw / promise rejection 도 터미널에 기록.
window.addEventListener("error", (e) => {
  console.error("[window.onerror]", e.error ?? e.message);
  logTerminal({
    kind: "error",
    text: `🚨 전역 에러: ${e.message}`,
    detail: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined,
  });
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("[unhandledrejection]", e.reason);
  const reason = e.reason;
  const msg =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "알 수 없는 거부";
  logTerminal({
    kind: "error",
    text: `🚨 처리 안 된 거부: ${msg}`,
    detail: reason instanceof Error ? reason.stack : undefined,
  });
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
