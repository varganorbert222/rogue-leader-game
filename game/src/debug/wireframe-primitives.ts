import { Color3, MeshBuilder, Matrix, Mesh, Vector3, VertexBuffer, type AbstractMesh, type LinesMesh, type Scene } from '@babylonjs/core';

export function buildSphereWireframeLines(
  center: Vector3,
  radius: number,
  segments = 24
): Vector3[][] {
  const lines: Vector3[][] = [];

  for (let ring = 0; ring < 3; ring++) {
    const points: Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const c = Math.cos(t);
      const s = Math.sin(t);
      if (ring === 0) {
        points.push(center.add(new Vector3(c * radius, 0, s * radius)));
      } else if (ring === 1) {
        points.push(center.add(new Vector3(c * radius, s * radius, 0)));
      } else {
        points.push(center.add(new Vector3(0, c * radius, s * radius)));
      }
    }
    for (let i = 0; i < points.length - 1; i++) {
      lines.push([points[i], points[i + 1]]);
    }
  }

  for (const lat of [-0.45, 0, 0.45]) {
    const y = center.y + lat * radius;
    const latRadius = Math.sqrt(Math.max(0, radius * radius - (lat * radius) ** 2));
    const points: Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      points.push(
        new Vector3(center.x + Math.cos(t) * latRadius, y, center.z + Math.sin(t) * latRadius)
      );
    }
    for (let i = 0; i < points.length - 1; i++) {
      lines.push([points[i], points[i + 1]]);
    }
  }

  return lines;
}

export function buildCubeWireframeLines(
  center: Vector3,
  halfExtents: Vector3
): Vector3[][] {
  const min = new Vector3(
    center.x - halfExtents.x,
    center.y - halfExtents.y,
    center.z - halfExtents.z
  );
  const max = new Vector3(
    center.x + halfExtents.x,
    center.y + halfExtents.y,
    center.z + halfExtents.z
  );
  const corners = [
    new Vector3(min.x, min.y, min.z),
    new Vector3(max.x, min.y, min.z),
    new Vector3(max.x, min.y, max.z),
    new Vector3(min.x, min.y, max.z),
    new Vector3(min.x, max.y, min.z),
    new Vector3(max.x, max.y, min.z),
    new Vector3(max.x, max.y, max.z),
    new Vector3(min.x, max.y, max.z),
  ];
  const edges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  return edges.map(([a, b]) => [corners[a], corners[b]]);
}

/** World-space triangle edges for an arbitrary mesh (used for collider debug). */
export function buildMeshWireframeLines(mesh: AbstractMesh): Vector3[][] {
  if (!(mesh instanceof Mesh) || mesh.isDisposed() || !mesh.isEnabled()) {
    return [];
  }

  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const indices = mesh.getIndices();
  if (!positions?.length || !indices?.length) {
    return [];
  }

  mesh.computeWorldMatrix(true);
  const worldMatrix = mesh.getWorldMatrix();
  const lines: Vector3[][] = [];
  const seen = new Set<string>();

  for (let i = 0; i < indices.length; i += 3) {
    const a = worldVertex(positions, indices[i], worldMatrix);
    const b = worldVertex(positions, indices[i + 1], worldMatrix);
    const c = worldVertex(positions, indices[i + 2], worldMatrix);
    pushUniqueEdge(lines, seen, a, b);
    pushUniqueEdge(lines, seen, b, c);
    pushUniqueEdge(lines, seen, c, a);
  }

  return lines;
}

function worldVertex(positions: Float32Array | number[], index: number, worldMatrix: Matrix): Vector3 {
  const local = new Vector3(
    positions[index * 3],
    positions[index * 3 + 1],
    positions[index * 3 + 2]
  );
  return Vector3.TransformCoordinates(local, worldMatrix);
}

function edgeKey(a: Vector3, b: Vector3): string {
  const ax = a.x.toFixed(3);
  const ay = a.y.toFixed(3);
  const az = a.z.toFixed(3);
  const bx = b.x.toFixed(3);
  const by = b.y.toFixed(3);
  const bz = b.z.toFixed(3);
  return ax < bx || (ax === bx && (ay < by || (ay === by && az <= bz)))
    ? `${ax},${ay},${az}|${bx},${by},${bz}`
    : `${bx},${by},${bz}|${ax},${ay},${az}`;
}

function pushUniqueEdge(lines: Vector3[][], seen: Set<string>, a: Vector3, b: Vector3): void {
  const key = edgeKey(a, b);
  if (seen.has(key)) return;
  seen.add(key);
  lines.push([a, b]);
}

export function addLineSystem(
  scene: Scene,
  name: string,
  lines: Vector3[][],
  color: Color3,
  meshes: LinesMesh[]
): void {
  if (lines.length === 0) return;
  const mesh = MeshBuilder.CreateLineSystem(name, { lines }, scene);
  mesh.color = color;
  mesh.isPickable = false;
  meshes.push(mesh);
}
