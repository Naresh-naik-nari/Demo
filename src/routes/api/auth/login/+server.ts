import { lucia } from "$lib/server/auth";
import { verify } from "@node-rs/argon2";
import { db } from "$lib/server/db";
import type { RequestHandler } from '@sveltejs/kit';
import type { DatabaseUser } from "$lib/server/db";

export const POST: RequestHandler = async (event): Promise<Response> => {
    try {
        const headers = event.request.headers;
        const username = headers.get("username");
        const password = headers.get("password");

        if (
            typeof username !== "string" ||
            username.length < 3 ||
            username.length > 31
        ) {
            return new Response(JSON.stringify({ message: "Invalid username" }), {
                status: 400,
                headers: { "content-type": "application/json" }
            });
        }
        if (typeof password !== "string" || password.length < 6 || password.length > 255) {
            return new Response(JSON.stringify({ message: "Invalid password" }), {
                status: 400,
                headers: { "content-type": "application/json" }
            });
        }

        const result = await db.execute({
            sql: "SELECT * FROM user WHERE username = ?",
            args: [username]
        });
        const existingUser = result.rows[0] as unknown as DatabaseUser | undefined;

        if (!existingUser) {
            return new Response(JSON.stringify({ message: "Incorrect username or password" }), {
                status: 400,
                headers: { "content-type": "application/json" }
            });
        }

        const validPassword = await verify(existingUser.password_hash, password, {
            memoryCost: 19456,
            timeCost: 2,
            outputLen: 32,
            parallelism: 1
        });
        if (!validPassword) {
            return new Response(JSON.stringify({ message: "Incorrect username or password" }), {
                status: 400,
                headers: { "content-type": "application/json" }
            });
        }

        const session = await lucia.createSession(existingUser.id, {});
        const sessionCookie = lucia.createSessionCookie(session.id);
        event.cookies.set(sessionCookie.name, sessionCookie.value, {
            path: ".",
            ...sessionCookie.attributes
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ message: e.message }), {
            status: 500,
            headers: { "content-type": "application/json" }
        });
    }

    return new Response(JSON.stringify({ message: "Success" }), {
        status: 200,
        headers: { "content-type": "application/json" }
    });
}
