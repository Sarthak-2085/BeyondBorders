"use client";
import { useEffect, useRef, useState } from "react";
import {
  geoNaturalEarth1,
  geoPath,
  geoCentroid,
  geoInterpolate,
  geoArea,
} from "d3-geo";
import type { FeatureCollection, Feature, Geometry, Position } from "geojson";
import { regions } from "@/lib/routes";
import "maplibre-gl/dist/maplibre-gl.css";
type MapProps = {
  origin: string;
  destination: string;
  onSelect: (code: string) => void;
};
export default function RouteMap({ origin, destination, onSelect }: MapProps) {
  const el = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<FeatureCollection | null>(null),
    [failed, setFailed] = useState(false),
    [ready, setReady] = useState(false);
  const callback = useRef(onSelect);
  callback.current = onSelect;
  const map = useRef<import("maplibre-gl").Map | null>(null);
  const [mapReady, setMapReady] = useState(0);
  useEffect(() => {
    let active = true;
    fetch("/geo/countries.geojson")
      .then((r) => r.json())
      .then((g) => {
        if (active) setGeo(g);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!geo || !el.current) return;
    let active = true;
    let observer: ResizeObserver | undefined;
    import("maplibre-gl")
      .then((m) => {
        if (!active || !el.current) return;
        const gl = new m.Map({
          container: el.current,
          style: {
            version: 8,
            sources: { land: { type: "geojson", data: geo } },
            layers: [
              {
                id: "sea",
                type: "background",
                paint: { "background-color": "#d9dfd1" },
              },
              {
                id: "land",
                source: "land",
                type: "fill",
                paint: { "fill-color": "#e8ddc4" },
              },
              {
                id: "border",
                source: "land",
                type: "line",
                paint: { "line-color": "#989781", "line-width": 0.6 },
              },
            ],
          },
          center: [19, 23],
          zoom: 1.05,
          minZoom: 0,
          maxZoom: 7,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          renderWorldCopies: false,
        });
        gl.scrollZoom.disable();
        map.current = gl;
        gl.addControl(
          new m.NavigationControl({ showCompass: false }),
          "top-right",
        );
        gl.on("load", () => {
          if (!active) return;
          setReady(true);
          setMapReady((v) => v + 1);
          gl.on("click", "land", (e) => {
            const c = e.features?.[0]?.properties?.iso3;
            if (c) callback.current(c);
          });
        });
        gl.on("error", () => {
          if (active) setFailed(true);
        });
        observer = new ResizeObserver(() => gl.resize());
        observer.observe(el.current);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, [geo]);
  function point(code: string): [number, number] | undefined {
    const known = regions[code];
    if (known) return [known[1], known[0]];
    const f = geo?.features.find((f) => f.properties?.iso3 === code);
    if (!f) return;
    const center = geoCentroid(f);
    return geoArea(f) > 2 * Math.PI
      ? [((center[0] + 360) % 360) - 180, -center[1]]
      : center;
  }
  const a = point(origin),
    b = point(destination);
  const pair = a && b ? geoInterpolate(a, b) : null;
  const coords = pair ? Array.from({ length: 81 }, (_, i) => pair(i / 80)) : [];
  const segments: Position[][] = [];
  coords.forEach((p, i) => {
    if (!i || Math.abs(p[0] - coords[i - 1][0]) > 180) segments.push([]);
    segments.at(-1)!.push(p);
  });
  const line = {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "MultiLineString" as const,
      coordinates: segments.filter((seg) => seg.length > 1),
    },
  };
  useEffect(() => {
    const gl = map.current;
    if (!gl?.isStyleLoaded()) return;
    gl.setPaintProperty("land", "fill-color", [
      "match",
      ["get", "iso3"],
      origin,
      "#8d9b80",
      destination,
      "#bc7955",
      "#e8ddc4",
    ]);
    const route = gl.getSource("corridor") as
      | import("maplibre-gl").GeoJSONSource
      | undefined;
    if (route) route.setData(line);
    else {
      gl.addSource("corridor", { type: "geojson", data: line });
      gl.addLayer({
        id: "route",
        type: "line",
        source: "corridor",
        paint: { "line-color": "#875035", "line-width": 2.5 },
      });
    }
    const pts: FeatureCollection = {
      type: "FeatureCollection",
      features: [a, b]
        .filter(Boolean)
        .map((p) => ({
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: p! },
        })),
    };
    const dots = gl.getSource("dots") as
      | import("maplibre-gl").GeoJSONSource
      | undefined;
    if (dots) dots.setData(pts);
    else {
      gl.addSource("dots", { type: "geojson", data: pts });
      gl.addLayer({
        id: "markers",
        type: "circle",
        source: "dots",
        paint: {
          "circle-radius": 5,
          "circle-color": "#783e23",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#f5e6cc",
        },
      });
    }
  }, [origin, destination, mapReady]);
  const proj = geoNaturalEarth1().scale(130).translate([366, 180]);
  const path = geoPath(proj);
  return (
    <div className="map-plate">
      <div
        className="map-surface"
        ref={el}
        style={{ visibility: failed || !ready ? "hidden" : "visible" }}
      />
      {(!ready || failed) && (
        <svg
          viewBox="0 0 732 360"
          role="img"
          aria-label="World map showing the selected countries"
        >
          {geo?.features.map((f, i) => {
            let geometry = f.geometry;
            if (geoArea(f) > 2 * Math.PI) {
              if (geometry.type === "Polygon")
                geometry = {
                  ...geometry,
                  coordinates: geometry.coordinates.map((r) =>
                    r.slice().reverse(),
                  ),
                };
              if (geometry.type === "MultiPolygon")
                geometry = {
                  ...geometry,
                  coordinates: geometry.coordinates.map((p) =>
                    p.map((r) => r.slice().reverse()),
                  ),
                };
            }
            const c = f.properties?.iso3;
            return (
              <path
                key={i}
                d={path(geometry) || ""}
                fill={
                  c === destination
                    ? "#bc7955"
                    : c === origin
                      ? "#8d9b80"
                      : "#e8ddc4"
                }
                stroke="#968e7d"
                strokeWidth=".55"
                onClick={() => callback.current(c)}
              />
            );
          })}
          {pair && (
            <path
              d={path(line) || ""}
              stroke="#a95132"
              strokeWidth="2.5"
              fill="none"
            />
          )}
          {[a, b].map((p, i) => {
            const q = p && proj(p);
            return q ? (
              <circle key={i} cx={q[0]} cy={q[1]} r="4" fill="#ad5432" />
            ) : null;
          })}
        </svg>
      )}
      <span className="map-credit">Natural Earth · public domain</span>
    </div>
  );
}
