import type { RequestHandler } from '@sveltejs/kit';
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = join(process.cwd(), 'tile-cache');

function getDirectorySize(dirPath: string): number {
    if (!existsSync(dirPath)) return 0;
    
    let totalSize = 0;
    const files = readdirSync(dirPath, { withFileTypes: true });
    
    for (const file of files) {
        const filePath = join(dirPath, file.name);
        if (file.isDirectory()) {
            totalSize += getDirectorySize(filePath);
        } else {
            totalSize += statSync(filePath).size;
        }
    }
    
    return totalSize;
}

function countTiles(dirPath: string): number {
    if (!existsSync(dirPath)) return 0;
    
    let count = 0;
    const files = readdirSync(dirPath, { withFileTypes: true });
    
    for (const file of files) {
        const filePath = join(dirPath, file.name);
        if (file.isDirectory()) {
            count += countTiles(filePath);
        } else if (file.name.endsWith('.png') || file.name.endsWith('.jpg')) {
            count++;
        }
    }
    
    return count;
}

export const GET: RequestHandler = async (): Promise<Response> => {
    try {
        const osmPath = CACHE_DIR;
        const googlePath = join(CACHE_DIR, 'google');
        
        const osmSize = getDirectorySize(osmPath) - getDirectorySize(googlePath); // Exclude google subdirectory
        const googleSize = getDirectorySize(googlePath);
        const totalSize = osmSize + googleSize;
        
        const osmTiles = countTiles(osmPath) - countTiles(googlePath);
        const googleTiles = countTiles(googlePath);
        const totalTiles = osmTiles + googleTiles;
        
        return new Response(JSON.stringify({
            totalSize,
            totalTiles,
            osm: {
                size: osmSize,
                tiles: osmTiles
            },
            google: {
                size: googleSize,
                tiles: googleTiles
            },
            humanReadable: {
                totalSize: formatBytes(totalSize),
                osmSize: formatBytes(osmSize),
                googleSize: formatBytes(googleSize)
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
