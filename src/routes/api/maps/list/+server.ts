import type { RequestHandler } from '@sveltejs/kit';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const GET: RequestHandler = async () => {
    try {
        const uploadsDir = join(process.cwd(), 'static', 'uploads', 'maps');
        
        if (!existsSync(uploadsDir)) {
            return new Response(JSON.stringify([]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const files = await readdir(uploadsDir);
        const layers = files.map(file => ({
            name: file,
            url: `/uploads/maps/${file}`,
            uploadDate: new Date().toISOString()
        }));

        return new Response(JSON.stringify(layers), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('Error listing maps:', err);
        return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
