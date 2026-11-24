"use client";
import { useEffect, useRef, useState } from "react";
import { countryAt } from "@/lib/geohit";
import { arc, cities, rad, routes, unit } from "@/lib/globe";
import type { GlobeProps } from "./GlobeStage";
export default function FallbackGlobe({
  view,
  paused,
  animate,
  onSelect,
}: GlobeProps & { animate: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tex, setTex] = useState<ImageData | null>(null);
  const [angle, setAngle] = useState(0);
  const segments = useRef<{ x: number; y: number; o: string; d: string }[]>([]);
  const labels = useRef<{ x: number; y: number; country: string }[]>([]);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        setTex(ctx.getImageData(0, 0, c.width, c.height));
      }
    };
    img.src = "/geo/earth-atlas.webp";
  }, []);
  useEffect(() => {
    if (animate && !paused) {
      const i = window.setInterval(() => {
        if (
          ref.current &&
          ref.current.getBoundingClientRect().bottom > 0 &&
          document.visibilityState === "visible"
        )
          setAngle((a) => a + 0.24);
      }, 450);
      return () => clearInterval(i);
    }
  }, [paused, animate]);
  useEffect(() => {
    const canvas = ref.current,
      ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !tex) return;
    const n = 660,
      c = n / 2,
      r = n * 0.435 * view.zoom;
    canvas.width = n;
    canvas.height = n;
    const out = ctx.createImageData(n, n);
    const lon = (view.lon + angle) * rad,
      lat = view.lat * rad,
      sl = Math.sin(lat),
      cl = Math.cos(lat),
      slo = Math.sin(lon),
      clo = Math.cos(lon);
    for (let y = 0; y < n; y++) {
      const sy = (c - y) / r;
      for (let x = 0; x < n; x++) {
        const sx = (x - c) / r,
          sq = sx * sx + sy * sy;
        if (sq > 1) continue;
        const sz = Math.sqrt(1 - sq),
          iy = sy * cl + sz * sl,
          iz = sz * cl - sy * sl;
        const u = ((Math.atan2(sx, iz) + lon) / (Math.PI * 2) + 1.5) % 1;
        const v = 0.5 - Math.asin(Math.min(1, Math.max(-1, iy))) / Math.PI;
        const idx =
          (Math.min(tex.height - 1, Math.floor(v * tex.height)) * tex.width +
            Math.floor(u * tex.width)) *
          4;
        const j = (y * n + x) * 4,
          light = 0.65 + 0.53 * Math.max(0, -sx * 0.49 + sy * 0.52 + sz * 0.7);
        for (let k = 0; k < 3; k++) out.data[j + k] = tex.data[idx + k] * light;
        out.data[j + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
    function proj(p: number[]) {
      const xx = p[0] * clo - p[2] * slo,
        zz = p[0] * slo + p[2] * clo;
      return [c + xx * r, c - (p[1] * cl - zz * sl) * r, p[1] * sl + zz * cl];
    }
    segments.current = [];
    routes.forEach(([a, b], ix) => {
      ctx.strokeStyle = ix % 3 === 0 ? "#e8b26f" : "#e9c79b";
      ctx.lineWidth = 1.65;
      ctx.beginPath();
      let prev = false;
      for (let i = 0; i <= 72; i++) {
        const p = proj(arc(a, b, i / 72)),
          ok = p[2] > 0.01;
        if (ok) {
          segments.current.push({
            x: p[0],
            y: p[1],
            o: cities[a].country,
            d: cities[b].country,
          });
          if (prev) ctx.lineTo(p[0], p[1]);
          else ctx.moveTo(p[0], p[1]);
        }
        prev = ok;
      }
      ctx.stroke();
      const v = proj(arc(a, b, (angle * 0.15 + ix * 0.217) % 1));
      if (v[2] > 0.01) {
        ctx.fillStyle = "#fff5db";
        ctx.beginPath();
        ctx.arc(v[0], v[1], 2.5, 0, 7);
        ctx.fill();
      }
    });
    labels.current = [];
    cities.forEach((city, i) => {
      const p = proj(unit(city.lat, city.lon));
      if (p[2] < 0.1) return;
      ctx.fillStyle = "#fff1d0";
      ctx.beginPath();
      ctx.arc(p[0], p[1], 3, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "#dc8c53";
      ctx.beginPath();
      ctx.arc(p[0], p[1], 5.7, 0, 7);
      ctx.stroke();
      if (!city.label || p[2] < 0.26) return;
      const name = city.name.toUpperCase(),
        ly = i === 0 ? 3 : -13;
      ctx.font = "500 12px monospace";
      const width = ctx.measureText(name).width + 14;
      ctx.fillStyle = "#202922";
      ctx.fillRect(p[0] + 6, p[1] + ly - 5, width, 21);
      ctx.fillStyle = "#f5e9c9";
      ctx.fillText(name, p[0] + 13, p[1] + ly + 10);
      labels.current.push({
        x: p[0] + 6 + width / 2,
        y: p[1] + ly + 4,
        country: city.country,
      });
    });
  }, [tex, angle, view]);
  return (
    <canvas
      className="globe-fallback"
      ref={ref}
      onClick={(e) => {
        const b = e.currentTarget.getBoundingClientRect(),
          x = ((e.clientX - b.left) / b.width) * 660,
          y = ((e.clientY - b.top) / b.height) * 660;
        const label = labels.current.find(
          (p) => Math.abs(p.x - x) < 45 && Math.abs(p.y - y) < 16,
        );
        if (label) {
          onSelect(label.country);
          return;
        }
        const edge = segments.current.find(
          (p) => Math.hypot(p.x - x, p.y - y) < 4,
        );
        if (edge) {
          onSelect(edge.d, edge.o);
          return;
        }
        const r = 660 * 0.435 * view.zoom,
          sx = (x - 330) / r,
          sy = (330 - y) / r;
        if (sx * sx + sy * sy > 1) return;
        const sz = Math.sqrt(1 - sx * sx - sy * sy),
          lat = view.lat * rad;
        const phi = Math.asin(sy * Math.cos(lat) + sz * Math.sin(lat)) / rad;
        const lambda =
          ((Math.atan2(sx, sz * Math.cos(lat) - sy * Math.sin(lat)) / rad +
            view.lon +
            angle +
            540) %
            360) -
          180;
        countryAt(phi, lambda)
          .then((iso) => {
            if (iso) onSelect(iso);
          })
          .catch(() => {});
      }}
      aria-label="Textured interactive globe with international routes"
    />
  );
}
