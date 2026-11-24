import type { FeatureCollection, Position } from "geojson";
let boundaries: Promise<FeatureCollection> | undefined;
export async function countryAt(lat: number, lon: number) {
  boundaries ??= fetch("/geo/countries.geojson")
    .then((r) => r.json())
    .catch((e) => {
      boundaries = undefined;
      throw e;
    });
  const g = await boundaries;
  function inside(ring: Position[]) {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[i],
        [x2, y2] = ring[j];
      if (
        y1 > lat !== y2 > lat &&
        lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1
      )
        hit = !hit;
    }
    return hit;
  }
  for (const f of g.features) {
    const polys =
      f.geometry.type === "MultiPolygon"
        ? f.geometry.coordinates
        : f.geometry.type === "Polygon"
          ? [f.geometry.coordinates]
          : [];
    if (polys.some((p) => inside(p[0]) && !p.slice(1).some(inside)))
      return f.properties?.iso3 as string;
  }
}
