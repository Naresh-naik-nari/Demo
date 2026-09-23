import type { RequestHandler } from '@sveltejs/kit';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const layerName = formData.get('layerName') as string;
        const opacity = parseFloat(formData.get('opacity') as string || '0.7');
        const format = formData.get('format') as string;

        if (!file) {
            return new Response('No file uploaded', { status: 400 });
        }

        // Create uploads directory if it doesn't exist
        const uploadsDir = join(process.cwd(), 'static', 'uploads', 'maps');
        if (!existsSync(uploadsDir)) {
            await mkdir(uploadsDir, { recursive: true });
        }

        // Save the file
        const fileExtension = file.name.split('.').pop();
        const sanitizedName = layerName.replace(/[^a-z0-9_-]/gi, '_');
        const filename = `${sanitizedName}_${Date.now()}.${fileExtension}`;
        const filepath = join(uploadsDir, filename);

        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filepath, buffer);

        // Detect format if auto
        let detectedFormat = format;
        if (format === 'auto') {
            detectedFormat = detectFormat(fileExtension || '');
        }

        // Process based on format
        const layerData = await processMapFile(filepath, detectedFormat, layerName);

        return new Response(JSON.stringify({
            success: true,
            layerName,
            type: detectedFormat,
            url: `/uploads/maps/${filename}`,
            ...layerData
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('Map upload error:', err);
        return new Response(`Upload failed: ${(err as Error).message}`, { status: 500 });
    }
};

function detectFormat(extension: string): string {
    const ext = extension.toLowerCase();
    const formatMap: Record<string, string> = {
        'tif': 'geotiff',
        'tiff': 'geotiff',
        'dt0': 'dted',
        'dt1': 'dted',
        'dt2': 'dted',
        'shp': 'shapefile',
        'dem': 'dem',
        'asc': 'dem',
        'kml': 'kml',
        'kmz': 'kml',
        'gpx': 'gpx',
        'json': 'geojson',
        'geojson': 'geojson',
        'mbtiles': 'mbtiles'
    };
    return formatMap[ext] || 'unknown';
}

async function processMapFile(filepath: string, format: string, layerName: string): Promise<any> {
    // For raster formats (GeoTIFF, DTED, DEM), we need to extract bounds
    // This is a placeholder - in production, you'd use gdal or similar
    // to extract actual geospatial metadata

    const result: any = {
        processed: true
    };

    switch (format) {
        case 'geotiff':
        case 'dted':
        case 'dem':
            // For raster files, we need bounds [south, west, north, east]
            // This is a placeholder - real implementation would use GDAL
            result.bounds = [
                [28.0, 77.0],  // Southwest corner (lat, lon)
                [29.0, 78.0]   // Northeast corner
            ];
            result.message = 'Raster layer uploaded. Bounds need to be configured.';
            break;

        case 'geojson':
        case 'kml':
        case 'gpx':
            // Vector formats - would parse and convert to GeoJSON
            result.message = 'Vector layer uploaded. Will be displayed as overlay.';
            break;

        case 'mbtiles':
            // Tile database
            result.message = 'MBTiles uploaded. Tile service ready.';
            break;

        case 'shapefile':
            result.message = 'Shapefile uploaded. Requires conversion to GeoJSON.';
            break;

        default:
            result.message = 'File uploaded but format processing not implemented yet.';
    }

    return result;
}
