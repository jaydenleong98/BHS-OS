import type { Metadata, Viewport } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "BHS OS",
  description: "Beyond Horizon Solutions — internal operating metrics",
};

// Everything here is behind auth and reads live data — nothing is prerenderable.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080b12",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware is what actually gates access; this call only decides whether to
  // paint the nav. If Supabase is unreachable, render the page rather than 500.
  let user: { email?: string } | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-ink antialiased">
        {user ? <Nav email={user.email ?? ""} /> : null}
        <main className={user ? "mx-auto max-w-[1600px] px-4 py-5 sm:px-6" : ""}>
          {children}
        </main>
      </body>
    </html>
  );
}
