/**
 * @file +layout.server.ts
 * @description Root layout server load function — enforces authentication on
 * all protected routes.
 *
 * Public routes (login, register) are explicitly allowed through.
 * Every other route requires a valid Lucia session cookie; unauthenticated
 * requests are redirected to `/login`.
 *
 * This is the authoritative server-side guard. The client-side `loggedInStore`
 * in `authStore.ts` is only used for immediate UI reactions (nav hide/show)
 * and must NOT be relied upon for security.
 */

import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/** Routes that do not require authentication. */
const PUBLIC_ROUTES = new Set(['/login', '/register']);

export const load: LayoutServerLoad = async ({ url, locals }) => {
    const { pathname } = url;

    // Allow public routes and API routes through without a session check.
    // API routes (/api/*) have their own auth requirements where needed.
    const isPublic = PUBLIC_ROUTES.has(pathname) || pathname.startsWith('/api/');

    if (!isPublic && !locals.user) {
        // Not authenticated — redirect to login, preserving the intended destination
        // so the login page can redirect back after a successful login.
        throw redirect(302, `/login`);
    }

    // Pass the authenticated user to the layout and all child routes.
    // Components can access this via `export let data` or `$page.data.user`.
    return {
        user: locals.user
            ? {
                  id: locals.user.id,
                  username: (locals.user as any).username ?? null,
              }
            : null,
    };
};
