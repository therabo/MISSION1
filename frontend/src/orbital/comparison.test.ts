import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Cesium checks these constructors when inferring vector uniform types in Node.
beforeAll(() => {
  for (const name of ['HTMLCanvasElement', 'HTMLImageElement', 'ImageBitmap', 'OffscreenCanvas']) vi.stubGlobal(name, class {});
});
afterAll(() => vi.unstubAllGlobals());
import { parseComparison } from './comparison';
import { Cartesian3, GeometryInstance, JulianDate, PolylineGeometry } from 'cesium';
import { OEM_DASH, PRIMARY_TRAIL, createPrimaryTrail, oemMaterial, oppositeSideDistance, primaryOpacity, primaryPositions, updateTrailFade } from '../cesium/trajectoryRendering';

/** Synthetic test-only positions; no values in this test represent ISS observations. */
function fixture(available: boolean) {
  const center = Date.parse('2026-09-30T10:30:00Z');
  const period = 5580;
  const samples = Array.from({ length: 181 }, (_, index) => {
    const phase = (index - 90) / 180 * 2 * Math.PI;
    return {
      time: new Date(center + Math.round((index - 90) * period / 180 * 1000)).toISOString(),
      xMeters: 6_800_000 * Math.cos(phase),
      yMeters: 6_800_000 * Math.sin(phase),
      zMeters: 100_000,
    };
  });
  return {
    generatedAt: new Date(center).toISOString(),
    primary: {
      classification: 'COMPUTED_FROM_ORBITAL_ELEMENTS', frame: 'ITRF_2020_IERS_2010', positionUnit: 'm',
      orbitalPeriodSeconds: period, currentSampleIndex: 90,
      source: { provider: 'CELESTRAK_GP', elementEpoch: new Date(center - 3600_000).toISOString(), elementSha256: 'a'.repeat(64) },
      samples,
    },
    oem: {
      classification: 'SOURCE_PROVIDED_PREDICTED_EPHEMERIS',
      sampleMethod: 'CUBIC_HERMITE_FROM_SOURCE_POSITION_VELOCITY', sourceFrame: 'EME2000',
      frame: 'ITRF_2020_IERS_2010', positionUnit: 'm',
      availability: available ? 'AVAILABLE' : 'UNAVAILABLE', reason: available ? 'NONE' : 'NO_VALID_OEM_FILE',
      source: available ? {
        creationDate: new Date(center - 86400_000).toISOString(),
        startTime: new Date(center - 86400_000).toISOString(), stopTime: new Date(center + 86400_000).toISOString(),
        retrievedAt: new Date(center).toISOString(), httpLastModified: null, sha256: 'b'.repeat(64),
        sourceUrl: 'https://nasa-public-data.s3.amazonaws.com/iss-coords/current/ISS_OEM/ISS.OEM_J2K_EPH.xml',
      } : null,
      samples: available ? samples.slice(5, 176) : [],
    },
  };
}

describe('comparison product contract', () => {
  it('requires a complete centered propagated revolution and distinct OEM lineage', () => {
    const result = parseComparison(fixture(true));
    expect(result.primary.samples).toHaveLength(181);
    expect(result.primary.samples[90].time).toBe(result.generatedAt);
    expect(Date.parse(result.primary.samples[0].time)).toBe(Date.parse(result.generatedAt) - result.primary.orbitalPeriodSeconds * 500);
    expect(Date.parse(result.primary.samples[180].time)).toBe(Date.parse(result.generatedAt) + result.primary.orbitalPeriodSeconds * 500);
    expect(new Set(result.primary.samples.map((point) => point.time)).size).toBe(181);
    expect(primaryPositions(result).map((position) => position.x)).toEqual(result.primary.samples.map((sample) => sample.xMeters));
    expect(result.oem.samples).toHaveLength(171);
    expect(result.oem.classification).not.toBe(result.primary.classification);
  });
  it('rejects duplicate epochs and an irregular interior time grid', () => {
    const duplicate = fixture(true);
    duplicate.primary.samples[50].time = duplicate.primary.samples[49].time;
    expect(() => parseComparison(duplicate)).toThrow('out of order');
    const irregular = fixture(true);
    irregular.primary.samples[50].time = new Date(Date.parse(irregular.primary.samples[50].time) + 10).toISOString();
    expect(() => parseComparison(irregular)).toThrow('Irregular full-orbit sampling');
  });
  it('preserves primary path when OEM is unavailable', () => {
    const result = parseComparison(fixture(false));
    expect(result.primary.samples).toHaveLength(181);
    expect(result.oem.availability).toBe('UNAVAILABLE');
    expect(result.oem.samples).toHaveLength(0);
  });
  it('rejects mixed or misframed predictions', () => {
    const wrong = fixture(true);
    wrong.oem.sourceFrame = 'TEME';
    expect(() => parseComparison(wrong)).toThrow();
    const missing = fixture(true);
    missing.primary.samples.pop();
    expect(() => parseComparison(missing)).toThrow();
    const asymmetric = fixture(true);
    asymmetric.primary.samples[0].time = new Date(Date.parse(asymmetric.generatedAt) - asymmetric.primary.orbitalPeriodSeconds * 400).toISOString();
    expect(() => parseComparison(asymmetric)).toThrow();
  });
});

describe('moving full-orbit fade', () => {
  const period = 5580;
  const now = Date.parse('2026-09-30T10:30:00Z');
  it('is symmetric about the ISS and reaches minimum on the opposite side', () => {
    expect(primaryOpacity(now, now, period)).toBeCloseTo(PRIMARY_TRAIL.maximumAlpha);
    expect(primaryOpacity(now - period * 250, now, period)).toBeCloseTo(primaryOpacity(now + period * 250, now, period));
    expect(primaryOpacity(now + period * 500, now, period)).toBeCloseTo(PRIMARY_TRAIL.minimumAlpha);
    const alphas = Array.from({length: 101}, (_, index) => primaryOpacity(now + index * period * 5, now, period));
    expect(alphas.every((alpha) => alpha >= PRIMARY_TRAIL.minimumAlpha && alpha <= PRIMARY_TRAIL.maximumAlpha)).toBe(true);
    expect(alphas.every((alpha, index) => index === 0 || alpha <= alphas[index - 1])).toBe(true);
  });
  it('tracks scene time using orbital phase rather than a fixed sample index', () => {
    expect(oppositeSideDistance(now + 30_000, now + 30_000, period)).toBe(0);
    expect(primaryOpacity(now + 30_000, now + 30_000, period)).toBeGreaterThan(primaryOpacity(now, now + 30_000, period));
  });
});

it('uses a shared physical path with a soft primary halo and uniform OEM dashes', () => {
  expect(PRIMARY_TRAIL.layers[0].width).toBeGreaterThan(PRIMARY_TRAIL.layers[1].width);
  expect(PRIMARY_TRAIL.layers.every((layer) => layer.glowPower > 0)).toBe(true);
  const material = oemMaterial();
  const time = JulianDate.fromIso8601('2026-09-30T10:30:00Z');
  expect(material.getType(time)).toBe('PolylineDash');
  const atStart = material.getValue(time);
  const atLater = material.getValue(JulianDate.addSeconds(time, 2700, new JulianDate()));
  expect(atStart).toEqual(atLater);
  expect(atStart.color.alpha).toBe(OEM_DASH.alpha);
  expect(atStart.gapColor.alpha).toBe(0);
  expect(atStart.dashLength).toBe(OEM_DASH.dashLength);
  expect(OEM_DASH.dashLength).toBeGreaterThan(32);
  expect(OEM_DASH.dashPattern).toBe(0x000f);
  expect(OEM_DASH.alpha).toBeGreaterThan(0);
});


it('uses identical unclosed centerlines, deterministic materials, and uniform-only fade updates', () => {
  const response = parseComparison(fixture(true));
  const now = Date.parse(response.generatedAt);
  const trail = createPrimaryTrail(response, now);
  const vertices = trail.layers.map(({ primitive }) => {
    const instance = primitive.geometryInstances as GeometryInstance;
    const geometry = PolylineGeometry.createGeometry(instance.geometry as unknown as PolylineGeometry)!;
    return Array.from(geometry.attributes.position!.values!);
  });
  expect(vertices[0]).toEqual(vertices[1]);
  expect(trail.positions).toHaveLength(181);
  expect(trail.positions[0]).toEqual(new Cartesian3(response.primary.samples[0].xMeters,
    response.primary.samples[0].yMeters, response.primary.samples[0].zMeters));
  expect(trail.positions[180]).toEqual(new Cartesian3(response.primary.samples[180].xMeters,
    response.primary.samples[180].yMeters, response.primary.samples[180].zMeters));
  const primitives = trail.layers.map((layer) => layer.primitive);
  for (const [index, layer] of trail.layers.entries()) {
    expect(layer.material.uniforms.minimumAlpha).toBe(PRIMARY_TRAIL.minimumAlpha * PRIMARY_TRAIL.layers[index].alphaScale);
    expect(layer.material.materials.edgeGlow.uniforms.glowPower).toBe(PRIMARY_TRAIL.layers[index].glowPower);
    expect(layer.material.materials.phaseFade.uniforms.time.x).toBe(0.5);
  }
  updateTrailFade(trail, now + 30_000);
  expect(trail.layers.map((layer) => layer.primitive)).toEqual(primitives);
  expect(trail.layers.every((layer) => layer.material.materials.phaseFade.uniforms.time.x ===
    0.5 + 30 / response.primary.orbitalPeriodSeconds)).toBe(true);
  for (const layer of trail.layers) { layer.primitive.destroy(); layer.material.destroy(); }
});
