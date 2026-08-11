"use client";

import { useEffect } from "react";
import { toast } from "react-toastify";

/**
 * App-wide safety net: surfaces any error that reaches the browser's
 * top-level handlers as a toast, so a bug nobody wrapped in a try/catch
 * still tells the user something went wrong instead of failing silently.
 * Errors already caught and reported locally (e.g. a form's own
 * toast.error calls) never reach these listeners, so nothing
 * double-toasts.
 */
export default function GlobalErrorToaster() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      toast.error(event.error?.message || event.message || "Something went wrong.");
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message =
        reason instanceof Error ? reason.message : String(reason ?? "Something went wrong.");
      toast.error(message);
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
