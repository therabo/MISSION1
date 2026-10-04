import { ImageryLayer, SingleTileImageryProvider, TileMapServiceImageryProvider,
  WebMapTileServiceImageryProvider, WebMercatorTilingScheme, buildModuleUrl, type TileProviderError, type Viewer } from 'cesium';
import { NIGHT_LIGHTS } from './earthLighting';

/** Keep dim clusters and bright city cores distinct; no synthetic emission/glow. */
export const NIGHT_PRESENTATION = { brightness: 1.15, contrast: 1, gamma: 1 } as const;

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

/** Cesium 1.145 shares its error counter across tiles. Track real tile failures
 * independently so success on another tile cannot restart an endless retry.
 */
export function installGibsRetries(provider: WebMapTileServiceImageryProvider): () => void {
  const attempts = new Map<string, number>();
  const tileKey = (x: number, y: number, level: number) => `${level}/${x}/${y}`;
  const original = provider.requestImage;
  provider.requestImage = function (x, y, level, request) {
    return original.call(this, x, y, level, request)?.then(image => {
      if (image) attempts.delete(tileKey(x, y, level));
      return image;
    });
  };
  const remove = provider.errorEvent.addEventListener((error: TileProviderError) => {
    if (!Number.isInteger(error.x) || !Number.isInteger(error.y) || !Number.isInteger(error.level)) {
      error.retry = false;
      return;
    }
    const key = tileKey(error.x, error.y, error.level);
    const count = attempts.get(key) ?? 0;
    error.retry = count < 2;
    attempts.set(key, count + 1);
    // Bound outage bookkeeping over long global navigation. Evicted imagery
    // already has Cesium's FAILED state; a later new request is a new load.
    if (attempts.size > 1024) attempts.delete(attempts.keys().next().value!);
  });
  return () => { remove(); provider.requestImage = original; attempts.clear(); };
}

/** Independent progressive sources, with local imagery beneath their tiles.
 * Disposing while a probe/decode is pending prevents late insertion into a
 * destroyed scene. The Viewer owns destruction of all inserted layers.
 */
export function installEarthImagery(viewer: Viewer, failed: (message: string) => void): () => void {
  let disposed = false;
  const active = () => !disposed && !viewer.isDestroyed();
  const layers = viewer.imageryLayers;
  let localNight: ImageryLayer | undefined;
  let tiledNight: ImageryLayer | undefined;
  const disposeRetries: Array<() => void> = [];
  const nightOptions = { ...NIGHT_PRESENTATION, dayAlpha: NIGHT_IMAGERY.dayAlpha, nightAlpha: NIGHT_IMAGERY.nightAlpha };

  void TileMapServiceImageryProvider.fromUrl(buildModuleUrl('Assets/Textures/NaturalEarthII')).then(provider => {
    if (active()) layers.add(new ImageryLayer(provider), 0);
  }).catch(() => { if (active()) failed('Local Earth imagery is unavailable.'); });

  void SingleTileImageryProvider.fromUrl(NIGHT_LIGHTS.url, {
    credit: 'Earth night-lights fallback: NASA Black Marble, 2016',
  }).then(provider => {
    if (!active()) return;
    localNight = new ImageryLayer(provider, nightOptions);
    // A late local decode belongs below, never above the finer night tiles.
    layers.add(localNight, tiledNight ? layers.indexOf(tiledNight) : layers.length);
  }).catch(() => { if (active()) failed('Local Earth night-lights imagery is unavailable.'); });

  for (const source of [DAY_IMAGERY, NIGHT_IMAGERY]) {
    void gibsAvailable(source).then(available => {
      if (!active() || !available) return;
      const provider = gibsProvider(source);
      disposeRetries.push(installGibsRetries(provider));
      const night = source === NIGHT_IMAGERY;
      const layer = new ImageryLayer(provider, night ? nightOptions : {});
      // Cesium uses its highest supported anisotropy when no cap is supplied.
      if (night) { tiledNight = layer; layers.add(layer); }
      else layers.add(layer, localNight ? layers.indexOf(localNight) : tiledNight ? layers.indexOf(tiledNight) : layers.length);
    });
  }
  return () => { disposed = true; disposeRetries.forEach(dispose => dispose()); };
}
