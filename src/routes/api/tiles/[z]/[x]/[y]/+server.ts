import type { RequestHandler } from '@sveltejs/kit';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = join(process.cwd(), 'tile-cache');

// Transparent 256x256 PNG placeholder for offline/error tiles
const EMPTY_TILE = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAGElEQVR4nGNgYGBg' +
    'JBgFgx8AAP//AwAI/AL+hc2rNAAAAABJRU5ErkJggg==',
    'base64'
);

// Tile sources to try in order — all allow server-side proxying
const TILE_SOURCES = [
    // Wikimedia Maps — explicitly allows third-party usage with proper User-Agent
    (z: string, x: string, y: number) => `https://maps.wikimedia.org/osm-intl/${z}/${x}/${y}.png`,
    // CARTO (Positron) — free, no API key needed, permissive
    (z: string, x: string, y: number) => `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
    // Stadia Maps (OpenStreetMap-based) — free tier, server-side friendly
    (z: string, x: string, y: number) => `https://tiles.stadiamaps.com/tiles/osm_bright/${z}/${x}/${y}.png`,
];

export const GET: RequestHandler = async ({ params }): Promise<Response> => {
    const { z, x, y } = params;

    const zi = parseInt(z), xi = parseInt(x), yi = parseInt(y.replace('.png', ''));
    if (isNaN(zi) || isNaN(xi) || isNaN(yi) || zi < 0 || zi > 20) {
        return new Response('Invalid tile coordinates', { status: 400 });
    }

    const cacheFile = join(CACHE_DIR, z, x, `${yi}.png`);
    const cacheDir  = join(CACHE_DIR, z, x);

    // Serve cached tile immediately
    if (existsSync(cacheFile)) {
        const data = readFileSync(cacheFile);
        return new Response(data, {
            status: 200,
            headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800' }
        });
    }

    // Try each source in order
    for (const buildUrl of TILE_SOURCES) {
        const url = buildUrl(z, x, yi);
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'SidakGCS/1.0 drone-ground-control-station; contact@example.com',
                    'Accept': 'image/png,image/*',
                    // Do NOT forward Referer — this causes 403s from OSM-based servers
                },
                signal: AbortSignal.timeout(6000),
            });

            if (!res.ok) continue; // try next source

            const buffer = Buffer.from(await res.arrayBuffer());

            // Validate it's actually a PNG (starts with PNG magic bytes)
            if (buffer.length > 4 && buffer[0] === 0x89 && buffer[1] === 0x50) {
                try {
                    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
                    writeFileSync(cacheFile, buffer);
                } catch { /* cache write failure is non-fatal */ }

                return new Response(buffer, {
                    status: 200,
                    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800' }
                });
            }
        } catch { /* timeout or network error — try next source */ }
    }

    // All sources failed (offline) — return transparent placeholder
    return new Response(EMPTY_TILE, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }
    });
};
