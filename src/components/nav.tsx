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
      {/* Height is fixed at h-12 rather than left to the tallest child, because
          the dashboard's sticky filter row offsets against it (top-[49px] =
          48px + the 1px border). */}
      <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-1 px-4 sm:px-6">
        <Link
          href="/dashboard"
          className="mr-2 shrink-0 text-sm font-semibold tracking-tight text-ink sm:mr-4"
        >
          BHS<span className="text-accent-bright"> OS</span>
        </Link>

        <nav className="flex h-full items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={[
                  // Tighter on phones: brand + three links + sign out overflow
                  // a 390px viewport at desktop padding.
                  "relative flex h-full items-center px-2 text-[13px] transition-colors sm:px-3 sm:text-sm",
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

        <div className="ml-auto flex shrink-0 items-center gap-3 pl-2">
          <span className="hidden text-xs text-ink-faint sm:inline">{email}</span>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md border border-line px-2 py-1.5 text-[11px] whitespace-nowrap text-ink-muted transition-colors hover:border-line-strong hover:text-ink sm:px-2.5 sm:text-xs"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
