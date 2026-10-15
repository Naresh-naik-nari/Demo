/**
 * @file +server.ts
 * @route POST /api/auth/register
 * @description Creates a new user account from JSON body credentials, hashes the
 * password with Argon2id, and creates a Lucia session on success.
 *
 * Credentials are accepted in the JSON body (not HTTP headers) to prevent
 * them from appearing in proxy / CDN access logs.
 */

import { lucia } from '$lib/server/auth';
import { generateId } from 'lucia';
import { hash } from '@node-rs/argon2';
import { db } from '$lib/server/db';
import type { RequestHandler } from '@sveltejs/kit';

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

        const passwordHash = await hash(password, {
            memoryCost: 19456,
            timeCost: 2,
            outputLen: 32,
            parallelism: 1,
        });
        const userId = generateId(15);

        await db.execute({
            sql: 'INSERT INTO user (id, username, password_hash) VALUES(?, ?, ?)',
            args: [userId, username, passwordHash],
        });

        const session = await lucia.createSession(userId, {});
        const sessionCookie = lucia.createSessionCookie(session.id);
        event.cookies.set(sessionCookie.name, sessionCookie.value, {
            path: '.',
            ...sessionCookie.attributes,
        });

        return json({ message: 'Success' });
    } catch (e: unknown) {
        // Unique constraint = username already taken
        if (e instanceof Error && e.message.includes('UNIQUE constraint failed')) {
            return json({ message: 'Username already taken' }, 400);
        }
        const message = e instanceof Error ? e.message : 'Internal server error';
        console.error('[auth/register]', e);
        return json({ message }, 500);
    }
};
