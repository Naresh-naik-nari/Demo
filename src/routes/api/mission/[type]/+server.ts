import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export const POST: RequestHandler = async (event): Promise<Response> => {
    switch (event.params.type) {
        case 'save':
            try {
                let title = event.request.headers.get('title');
                let actions = event.request.headers.get('actions');
                db.prepare("INSERT INTO mission (id, title, actions, isLoaded) VALUES (?, ?, ?, ?)").run(
                    Math.random().toString(36).replace('0.', ''), title, actions, 0
                );
                return new Response("Success", { status: 200 });
            } catch (err) {
                console.error(err);
                return new Response(`Error: ${(err as Error).stack}`, { status: 500 });
            }
        case 'load':
            try {
                let title = event.request.headers.get('title');
                db.prepare("UPDATE mission SET isLoaded = 1 WHERE title = ?").run(title);
                return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
            } catch (err) {
                console.error(err);
                return new Response(`Error: ${(err as Error).stack}`, { status: 500 });
            }
        case 'unload':
            try {
                db.prepare("UPDATE mission SET isLoaded = 0").run();
                return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
            } catch (err) {
                console.error(err);
                return new Response(`Error: ${(err as Error).stack}`, { status: 500 });
            }
        case 'checkExists':
            try {
                let title = event.request.headers.get('title');
                let rows = db.prepare("SELECT * FROM mission WHERE title = ?").all(title);
                return new Response(JSON.stringify(rows.length > 0 ? rows : {}), { status: 200, headers: { "content-type": "application/json" } });
            } catch (err) {
                console.error(err);
                return new Response(`Error: ${(err as Error).stack}`, { status: 500 });
            }
        case 'update':
            try {
                let title = event.request.headers.get('title');
                let actions = event.request.headers.get('actions');
                db.prepare("UPDATE mission SET actions = ? WHERE title = ?").run(actions, title);
                return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
            } catch (err) {
                console.error(err);
                return new Response(`Error: ${(err as Error).stack}`, { status: 500 });
            }
        case 'list':
            try {
                let rows = db.prepare("SELECT * FROM mission").all();
                return new Response(JSON.stringify(rows.length > 0 ? rows : {}), { status: 200, headers: { "content-type": "application/json" } });
            } catch (err) {
                console.error(err);
                return new Response(`Error: ${(err as Error).stack}`, { status: 500 });
            }
        case 'delete':
            try {
                let title = event.request.headers.get('title');
                db.prepare("DELETE FROM mission WHERE title = ?").run(title);
                return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
            } catch (err) {
                console.error(err);
                return new Response(`Error: ${(err as Error).stack}`, { status: 500 });
            }
        default:
            return new Response(`Invalid request type: ${event.params.type}`, { status: 400 });
    };
};