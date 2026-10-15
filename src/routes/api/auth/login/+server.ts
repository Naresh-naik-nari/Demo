/**
 * @file +server.ts
 * @route POST /api/auth/login
 * @description Authenticates a user with username/password from the JSON request
 * body and creates a Lucia session cookie on success.
 *
 * Credentials are accepted in the JSON body (not HTTP headers) to prevent
 * them from appearing in proxy / CDN access logs.
 */

import { lucia } from '$lib/server/auth';
import { verify } from '@node-rs/argon2';
import { db } from '$lib/server/db';
import type { RequestHandler } from '@sveltejs/kit';
import type { DatabaseUser } from '$lib/server/db';

export const POST: RequestHandler = async (event): Promise<Response> => {
    const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
            status,
            headers: { 'content-type': 'application/json' },
        });

    try {
        const body = await event.request.json();
        const { username, password } = body as { username?: string; password?: string };

        if (
            typeof username !== 'string' ||
            username.length < 3 ||
            username.length > 31
        ) {
            return json({ message: 'Invalid username' }, 400);
        }
        if (typeof password !== 'string' || password.length < 6 || password.length > 255) {
            return json({ message: 'Invalid password' }, 400);
        }

        const result = await db.execute({
            sql: 'SELECT * FROM user WHERE username = ?',
            args: [username],
        });
        const existingUser = result.rows[0] as unknown as DatabaseUser | undefined;

        if (!existingUser) {
            return json({ message: 'Incorrect username or password' }, 400);
        }

        const validPassword = await verify(existingUser.password_hash, password, {
            memoryCost: 19456,
            timeCost: 2,
            outputLen: 32,
            parallelism: 1,
        });

        if (!validPassword) {
            return json({ message: 'Incorrect username or password' }, 400);
        }

        const session = await lucia.createSession(existingUser.id, {});
        const sessionCookie = lucia.createSessionCookie(session.id);
        event.cookies.set(sessionCookie.name, sessionCookie.value, {
            path: '.',
            ...sessionCookie.attributes,
        });

        return json({ message: 'Success' });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        console.error('[auth/login]', e);
        return json({ message }, 500);
    }
};
