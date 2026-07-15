import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export const POST: RequestHandler = async (): Promise<Response> => {
    let adminExists = false;
    try {
        const result = await db.execute("SELECT id FROM user LIMIT 1");
        if (result.rows.length > 0) adminExists = true;
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
