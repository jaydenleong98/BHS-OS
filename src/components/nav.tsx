"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/entry", label: "Entry" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
];

export function Nav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center gap-1 px-4 sm:px-6">
        <Link
          href="/dashboard"
          className="mr-4 shrink-0 py-3 text-sm font-semibold tracking-tight text-ink"
        >
          BHS<span className="text-accent-bright"> OS</span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative px-3 py-3 text-sm transition-colors",
                  active ? "text-ink" : "text-ink-muted hover:text-ink",
                ].join(" ")}
              >
                {link.label}
                {active ? (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent-bright" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-xs text-ink-faint sm:inline">{email}</span>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
