"use client";

import { useEffect } from "react";
import { installGlobalErrorHandlers } from "@/lib/errorReporter";

// Tiny client component whose only job is to install window-level error
// handlers exactly once on mount. Rendered from the root layout.
export function ErrorReporterMount() {
  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);
  return null;
}
