import { ArcType, Cartesian3, ComponentDatatype, GeometryAttribute, PolylineGeometry, PolylineMaterialAppearance } from 'cesium';

/** Retained native source vertices plus constant adjacent endpoints per segment.
 * Only presentation attributes are added; positions, indices and epochs stay exact.
 */
export function trajectoryGeometry(positions: Cartesian3[], width: number) {
  const geometry = PolylineGeometry.createGeometry(new PolylineGeometry({
    positions, width, arcType: ArcType.NONE, vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
  }))!;
  const vertices = geometry.attributes.position!.values!.length / 3;
  if (vertices !== 4 * (positions.length - 1)) throw new Error('Unexpected retained polyline segment layout');
  for (const [name, offset] of [['before', -1], ['after', 2]] as const) {
    const attributes = geometry.attributes as unknown as Record<string, GeometryAttribute>;
    const high = new Float32Array(vertices * 3), low = new Float32Array(vertices * 3);
    for (let segment = 0; segment < positions.length - 1; segment++) {
      const point = positions[Math.max(0, Math.min(positions.length - 1, segment + offset))];
      // The pinned relative-to-eye encoding splits each metre component at
      // 65536, matching the retained native relative-to-eye attributes.
      const h = [point.x, point.y, point.z].map(x => Math.sign(x) * Math.floor(Math.abs(x) / 65536) * 65536);
      const l = [point.x - h[0], point.y - h[1], point.z - h[2]];
      for (let k = 0; k < 4; k++) {
        const at = (segment * 4 + k) * 3;
        high.set(h, at);
        low.set(l, at);
      }
    }
    attributes[`${name}High`] = new GeometryAttribute({ componentDatatype: ComponentDatatype.FLOAT, componentsPerAttribute: 3, values: high });
    attributes[`${name}Low`] = new GeometryAttribute({ componentDatatype: ComponentDatatype.FLOAT, componentsPerAttribute: 3, values: low });
  }
  return geometry;
}
