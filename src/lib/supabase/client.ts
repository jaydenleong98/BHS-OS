import { createBrowserClient } from "@supabase/ssr";
import { PREVIEW_MODE } from "@/lib/preview/flag";
import { createPreviewClient } from "@/lib/preview/store";

/** Supabase client for client components. Only used for sign-in / sign-out. */
export function createClient() {
  // In preview mode you are always signed in, so /login is unreachable — but a
  // real client here would throw on the missing env vars before we got there.
  if (PREVIEW_MODE) {
    return createPreviewClient() as unknown as ReturnType<typeof createBrowserClient>;
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
