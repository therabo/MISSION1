import { WebMapTileServiceImageryProvider, WebMercatorTilingScheme } from 'cesium';

/** Fixed, historical NASA GIBS layers. Dates are image acquisition composites, not scene time. */
export const DAY_IMAGERY = {
  strategy: 'NASA_GIBS_TILED',
  layer: 'BlueMarble_NextGeneration',
  tileMatrixSetID: 'GoogleMapsCompatible_Level8',
  maximumLevel: 8,
  format: 'image/jpeg',
  extension: 'jpeg',
  credit: 'Earth day imagery: NASA Blue Marble: Next Generation (August 2004)',
} as const;

export const NIGHT_IMAGERY = {
  strategy: 'NASA_GIBS_TILED',
  layer: 'VIIRS_Black_Marble',
  date: '2016-01-01',
  tileMatrixSetID: 'GoogleMapsCompatible_Level8',
  maximumLevel: 8,
  format: 'image/png',
  extension: 'png',
  dayAlpha: 0,
  nightAlpha: 1,
  credit: 'Earth night imagery: NASA Black Marble 2016 historical composite',
} as const;

type GibsLayer = typeof DAY_IMAGERY | typeof NIGHT_IMAGERY;

export function gibsTileUrl(layer: GibsLayer): string {
  const date = 'date' in layer ? `${layer.date}/` : '';
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer.layer}/default/${date}${layer.tileMatrixSetID}/{TileMatrix}/{TileRow}/{TileCol}.${layer.extension}`;
}

export function gibsProbeUrl(layer: GibsLayer): string {
  return gibsTileUrl(layer).replace('{TileMatrix}/{TileRow}/{TileCol}', '2/1/2');
}

export function gibsProvider(layer: GibsLayer): WebMapTileServiceImageryProvider {
  return new WebMapTileServiceImageryProvider({
    url: gibsTileUrl(layer),
    layer: layer.layer,
    style: 'default',
    format: layer.format,
    tileMatrixSetID: layer.tileMatrixSetID,
    tilingScheme: new WebMercatorTilingScheme(),
    maximumLevel: layer.maximumLevel,
    credit: layer.credit,
  });
}

/** A real tile verifies connectivity, CORS and payload before the layer is shown. */
export async function gibsAvailable(layer: GibsLayer): Promise<boolean> {
  try {
    const response = await fetch(gibsProbeUrl(layer), { mode: 'cors', signal: AbortSignal.timeout(6000) });
    return response.ok && (response.headers.get('content-type') ?? '').startsWith('image/') &&
      (await response.blob()).size > 0;
  } catch {
    return false;
  }
}
