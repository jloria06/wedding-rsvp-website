import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";

const publicApp = lazy(() => import("./App"));
const adminApp = lazy(() =>
  import("./admin/AdminApp").then((module) => ({ default: module.AdminApp })),
);

const queryClient = new QueryClient();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<main aria-busy="true">Loading...</main>}>
          {window.location.pathname.startsWith("/admin") ? (
            createElement(adminApp)
          ) : (
            createElement(publicApp)
          )}
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
