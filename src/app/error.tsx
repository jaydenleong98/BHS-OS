"use client";

import { useEffect } from "react";

/**
 * Catches an unexpected throw in any page so a transient Supabase or render
 * error shows something recoverable instead of a stack trace.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6">
        <h1 className="text-sm font-semibold tracking-tight text-ink">Something broke</h1>
        <p className="mt-1.5 text-xs text-ink-muted">
          This page failed to render. Nothing was saved or changed.
        </p>
        {error.message ? (
          <p className="mt-3 rounded border border-line bg-surface-2 px-2.5 py-2 font-mono text-[11px] break-words text-ink-faint">
            {error.message}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-bright"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
