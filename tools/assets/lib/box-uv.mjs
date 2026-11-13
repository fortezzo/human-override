// Box-projected UVs for meshes that have no usable texture layout.
//
// Every triangle is projected along whichever world axis its face points
// down most directly, so a tiling texture lands on it at a constant scale
// with no stretching. Vertices on the seam between two projection directions
// are duplicated so each side keeps its own UV.

/**
 * @param {import('@gltf-transform/core').Document} doc
 * @param {import('@gltf-transform/core').Mesh} mesh
 * @param {number} tile  size in metres that one repeat of the texture covers
 */
export function addBoxUvs(doc, mesh, tile) {
  const buffer = doc.getRoot().listBuffers()[0];

  for (const prim of mesh.listPrimitives()) {
    const position = prim.getAttribute('POSITION');
    const indices = prim.getIndices();
    const pos = position.getArray();
    const idx = indices.getArray();

    // Copy every attribute except the old UVs.
    const semantics = prim.listSemantics().filter((s) => s !== 'TEXCOORD_0');
    const sources = semantics.map((s) => {
      const acc = prim.getAttribute(s);
      return { semantic: s, acc, array: acc.getArray(), size: acc.getElementSize(), out: [] };
    });

    const remap = new Map(); // "vertex:axis" -> new index
    const uvs = [];
    const newIndices = new Uint32Array(idx.length);
    let count = 0;

    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3;
      const b = idx[t + 1] * 3;
      const c = idx[t + 2] * 3;
      const ux = pos[b] - pos[a];
      const uy = pos[b + 1] - pos[a + 1];
      const uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a];
      const vy = pos[c + 1] - pos[a + 1];
      const vz = pos[c + 2] - pos[a + 2];
      const nx = Math.abs(uy * vz - uz * vy);
      const ny = Math.abs(uz * vx - ux * vz);
      const nz = Math.abs(ux * vy - uy * vx);
      const axis = nx >= ny && nx >= nz ? 0 : ny >= nz ? 1 : 2;

      for (let k = 0; k < 3; k++) {
        const v = idx[t + k];
        const key = v * 3 + axis;
        let n = remap.get(key);
        if (n === undefined) {
          n = count++;
          remap.set(key, n);
          for (const src of sources) {
            for (let e = 0; e < src.size; e++) src.out.push(src.array[v * src.size + e]);
          }
          const x = pos[v * 3];
          const y = pos[v * 3 + 1];
          const z = pos[v * 3 + 2];
          if (axis === 0) uvs.push(z / tile, y / tile);
          else if (axis === 1) uvs.push(x / tile, z / tile);
          else uvs.push(x / tile, y / tile);
        }
        newIndices[t + k] = n;
      }
    }

    for (const src of sources) {
      const ArrayType = src.array.constructor;
      const acc = doc
        .createAccessor()
        .setType(src.acc.getType())
        .setNormalized(src.acc.getNormalized())
        .setArray(new ArrayType(src.out))
        .setBuffer(buffer);
      prim.setAttribute(src.semantic, acc);
    }
    prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uvs)).setBuffer(buffer));
    prim.setIndices(
      doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(count > 65535 ? newIndices : new Uint16Array(newIndices))
        .setBuffer(buffer),
    );
  }
}
