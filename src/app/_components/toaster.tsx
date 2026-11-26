"use client";

import { ToastContainer } from "react-toastify";

/**
 * The one toast container of the app (react-toastify, team rule point 0).
 * Warnings close after 6 s; errors are shown with `autoClose: false`.
 */
export function Toaster() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={6000}
      theme="dark"
      aria-label="Teavitused (Alt+T)"
      closeButton={({ closeToast }) => (
        <button
          type="button"
          onClick={() => closeToast()}
          aria-label="Sulge teavitus"
          className="self-start px-1 text-shell-muted hover:text-shell-ink"
        >
          ×
        </button>
      )}
    />
  );
}
