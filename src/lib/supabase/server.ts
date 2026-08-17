import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { PREVIEW_MODE } from "@/lib/preview/flag";
import { createPreviewClient } from "@/lib/preview/store";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function createRealClient(cookieStore: CookieStore) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a server component, where cookies are read-only.
            // The middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    }
  );
}

type ServerClient = ReturnType<typeof createRealClient>;

/**
 * Supabase client for server components, server actions and route handlers.
 * Must be created per request — it reads the auth cookie off the incoming request.
 *
 * The return type is the real client's either way, so callers stay typed against
 * Supabase and never have to know preview mode exists.
 */
export async function createClient(): Promise<ServerClient> {
  // Preview mode swaps the whole client for an in-memory one; nothing downstream
  // knows the difference.
  if (PREVIEW_MODE) return createPreviewClient() as unknown as ServerClient;

  return createRealClient(await cookies());
}
