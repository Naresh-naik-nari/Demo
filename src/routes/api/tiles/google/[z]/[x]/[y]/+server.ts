import type { RequestHandler } from '@sveltejs/kit';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = join(process.cwd(), 'tile-cache', 'google');

// Transparent 256x256 PNG placeholder for offline/error tiles
const EMPTY_TILE = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAGElEQVR4nGNgYGBg' +
    'JBgFgx8AAP//AwAI/AL+hc2rNAAAAABJRU5ErkJggg==',
    'base64'
);

// Google Maps satellite tile subdomains
const SUBDOMAINS = ['mt0', 'mt1', 'mt2', 'mt3'];

export const GET: RequestHandler = async ({ params }): Promise<Response> => {
    const { z, x, y } = params;

    const zi = parseInt(z), xi = parseInt(x), yi = parseInt(y.replace('.png', ''));
    if (isNaN(zi) || isNaN(xi) || isNaN(yi) || zi < 0 || zi > 20) {
        return new Response('Invalid tile coordinates', { status: 400 });
    }

    const cacheFile = join(CACHE_DIR, z, x, `${yi}.jpg`);
    const cacheDir  = join(CACHE_DIR, z, x);

    // Serve cached tile immediately
    if (existsSync(cacheFile)) {
        const data = readFileSync(cacheFile);
        return new Response(data, {
            status: 200,
            headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=604800' }
        });
    }

    // Try each Google Maps subdomain in order
    for (const subdomain of SUBDOMAINS) {
        const url = `https://${subdomain}.google.com/vt/lyrs=s&x=${xi}&y=${yi}&z=${zi}`;
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'image/jpeg,image/*',
                    'Referer': 'https://www.google.com/maps',
                },
                signal: AbortSignal.timeout(8000),
            });

            if (!res.ok) continue; // try next subdomain

            const buffer = Buffer.from(await res.arrayBuffer());

            // Validate it looks like a real image (JPEG magic bytes FF D8, or PNG 89 50)
            if (buffer.length > 4 && (
                (buffer[0] === 0xFF && buffer[1] === 0xD8) ||  // JPEG
                (buffer[0] === 0x89 && buffer[1] === 0x50)     // PNG
            )) {
                const isJpeg = buffer[0] === 0xFF;
                const ext = isJpeg ? 'jpg' : 'png';
                const actualCacheFile = join(CACHE_DIR, z, x, `${yi}.${ext}`);

                try {
                    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
                    writeFileSync(actualCacheFile, buffer);
                } catch { /* cache write failure is non-fatal */ }

                return new Response(buffer, {
                    status: 200,
                    headers: {
                        'Content-Type': isJpeg ? 'image/jpeg' : 'image/png',
                        'Cache-Control': 'public, max-age=604800'
                    }
                });
            }
        } catch { /* timeout or network error — try next subdomain */ }
    }

    // All sources failed (offline) — return transparent placeholder
    return new Response(EMPTY_TILE, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }
    });
};
