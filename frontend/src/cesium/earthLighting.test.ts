import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Globe } from 'cesium';
import { enableEarthLighting, NIGHT_LIGHTS } from './earthLighting';

function jpegSize(data: Buffer): [number, number] {
  if (data.readUInt16BE(0) !== 0xffd8) throw new Error('Not JPEG');
  let offset = 2;
  while (offset < data.length) {
    if (data[offset] !== 0xff) throw new Error('Invalid JPEG marker');
    const marker = data[offset + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return [data.readUInt16BE(offset + 7), data.readUInt16BE(offset + 5)];
    }
    offset += 2 + data.readUInt16BE(offset + 2);
  }
  throw new Error('JPEG dimensions missing');
}

describe('Earth solar lighting and historical night imagery', () => {
  it('enables scene-light globe and atmosphere shading at inspection altitude', () => {
    const globe = {} as Globe;
    enableEarthLighting(globe);
    expect(globe.enableLighting).toBe(true);
    expect(globe.dynamicAtmosphereLighting).toBe(true);
    expect(globe.dynamicAtmosphereLightingFromSun).toBe(true);
    expect(globe.lightingFadeInDistance).toBeLessThan(6_800_000);
  });

  it('pins an aligned NASA asset and applies it only to the night side', () => {
    const asset = readFileSync(join(process.cwd(), 'public', NIGHT_LIGHTS.url));
    expect(jpegSize(asset)).toEqual([NIGHT_LIGHTS.width, NIGHT_LIGHTS.height]);
    expect(createHash('sha256').update(asset).digest('hex')).toBe(NIGHT_LIGHTS.sha256);
    expect(NIGHT_LIGHTS.dayAlpha).toBe(0);
    expect(NIGHT_LIGHTS.nightAlpha).toBe(1);
    expect(NIGHT_LIGHTS.sourceYear).toBe(2016);
  });
});
