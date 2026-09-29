#!/usr/bin/env node
// Research-only decoder for POSITION data in a Draco-compressed glTF 2 GLB.
// Usage: node research-decode-igoal-draco.cjs input.glb output-directory draco3d-module-path
// Install draco3d in an isolated temporary directory; do not commit decoded binaries.
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const [input, outputDir, modulePath] = process.argv.slice(2);
  if (!input || !outputDir || !modulePath) throw new Error('Expected GLB, output directory, draco3d module path');
  const draco = require(path.resolve(modulePath));
  const module = await draco.createDecoderModule();
  const data = fs.readFileSync(input);
  if (data.toString('ascii', 0, 4) !== 'glTF' || data.readUInt32LE(4) !== 2) throw new Error('Not glTF 2 GLB');
  const jsonLength = data.readUInt32LE(12);
  const gltf = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8'));
  const binStart = 20 + jsonLength + 8;
  fs.mkdirSync(outputDir, {recursive: true});
  let decoded = 0;
  for (let index = 0; index < gltf.nodes.length; index++) {
    const node = gltf.nodes[index];
    if (node.mesh === undefined) continue;
    const arrays = [];
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const ext = primitive.extensions?.KHR_draco_mesh_compression;
      if (!ext) continue;
      const view = gltf.bufferViews[ext.bufferView];
      const bytes = data.subarray(binStart + (view.byteOffset || 0), binStart + (view.byteOffset || 0) + view.byteLength);
      const buffer = new module.DecoderBuffer();
      buffer.Init(new Int8Array(bytes), bytes.length);
      const decoder = new module.Decoder();
      if (decoder.GetEncodedGeometryType(buffer) !== module.TRIANGULAR_MESH) throw new Error(`Not triangular mesh at node ${index}`);
      const mesh = new module.Mesh();
      const status = decoder.DecodeBufferToMesh(buffer, mesh);
      if (!status.ok()) throw new Error(`Draco decode failed at node ${index}: ${status.error_msg()}`);
      const attribute = decoder.GetAttributeByUniqueId(mesh, ext.attributes.POSITION);
      if (attribute.num_components() !== 3) throw new Error(`Not VEC3 at node ${index}`);
      const values = new module.DracoFloat32Array();
      if (!decoder.GetAttributeFloatForAllPoints(mesh, attribute, values)) throw new Error(`POSITION decode failed at node ${index}`);
      const floats = new Float32Array(values.size());
      for (let j = 0; j < floats.length; j++) floats[j] = values.GetValue(j);
      arrays.push(Buffer.from(floats.buffer));
      module.destroy(values); module.destroy(mesh); module.destroy(decoder); module.destroy(buffer);
    }
    if (arrays.length) {
      fs.writeFileSync(path.join(outputDir, `${index}.bin`), Buffer.concat(arrays));
      decoded++;
    }
  }
  console.log(JSON.stringify({input, nodes: gltf.nodes.length, decodedDirectMeshes: decoded, outputDir}));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
