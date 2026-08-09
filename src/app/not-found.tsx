import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="text-center">
        <p className="text-sm font-semibold tracking-tight text-ink">Page not found</p>
        <p className="mt-1 text-xs text-ink-muted">
          There are only three pages here: Entry, Dashboard and Clients.
        </p>
        <Link
          href="/entry"
          className="mt-4 inline-block rounded-md border border-line px-3 py-2 text-sm text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          Go to Daily Entry
        </Link>
      </div>
    </div>
  );
}
