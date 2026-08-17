/**
 * Preview mode: run the whole app against in-memory data, with auth bypassed
 * and no Supabase project behind it. For looking at the UI locally — never set
 * this in a deployed environment.
 *
 * Turn on with NEXT_PUBLIC_PREVIEW_DATA=1 in .env.local.
 *
 * It is a separate module (and a NEXT_PUBLIC_ var) so middleware, server
 * components and client components all read the same switch.
 */

const flagSet = process.env.NEXT_PUBLIC_PREVIEW_DATA === "1";

/**
 * Vercel sets VERCEL on the server and NEXT_PUBLIC_VERCEL_ENV everywhere,
 * including the client bundle. Both are checked so the guard below holds on
 * either side of the boundary.
 */
const onVercel =
  process.env.VERCEL === "1" || process.env.NEXT_PUBLIC_VERCEL_ENV !== undefined;

/**
 * On a deployment, preview mode is not a mode — it is an open door. It bypasses
 * middleware auth and serves the whole UI to anyone who loads the page.
 *
 * Failing the build is the point. A warning would scroll past; this stops the
 * deploy with the reason attached.
 */
if (flagSet && onVercel) {
  throw new Error(
    "NEXT_PUBLIC_PREVIEW_DATA is set on a Vercel deployment. Preview mode bypasses " +
      "authentication and serves in-memory data to anyone who loads the page. Remove the " +
      "variable from the project's Environment Variables and redeploy."
  );
}

/** Belt and braces: even if the throw above were ever stripped, this fails closed. */
export const PREVIEW_MODE = flagSet && !onVercel;
