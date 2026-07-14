import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export const POST: RequestHandler = async (event): Promise<Response> => {
    let adminExists = false;
    try {
        const result = db.prepare("SELECT id FROM user LIMIT 1").get();
        if (result) adminExists = true;
    } catch {
        // Table may not exist yet — treat as no admin
    }
    return new Response(JSON.stringify({ adminExists: adminExists }), {
        status: 200,
        headers: {
            "content-type": "application/json"
        }
    });
}
