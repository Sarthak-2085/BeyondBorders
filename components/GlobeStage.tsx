"use client";
import dynamic from "next/dynamic";
import { useState, useRef, useEffect, useCallback } from "react";
import { Minus, Plus, Pause, Play, Move, LocateFixed } from "lucide-react";
import FallbackGlobe from "./GlobeFallback";
export type View = { lat: number; lon: number; zoom: number };
export type GlobeProps = {
  view: View;
  paused: boolean;
  dragging: boolean;
  onView: (p: View) => void;
  onSelect: (c: string, origin?: string) => void;
  onReady?: () => void;
};
const Earth = dynamic(() => import("./GlobeThree"), { ssr: false });
export const initialView: View = { lat: 19, lon: 38, zoom: 1 };
export default function GlobeStage() {
  const [view, setView] = useState(initialView),
    [paused, setPaused] = useState(false),
    [canGL, setGL] = useState(false),
    [ready, setReady] = useState(false),
    [dragging, setDragging] = useState(false);
  const down = useRef<{ x: number; y: number; v: View } | null>(null);
  const moved = useRef(false);
  const globe = useRef<HTMLDivElement>(null);
  const pointerCount = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      setPaused(true);
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      if (gl) {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        setGL(true);
      }
    } catch {}
  }, []);
  useEffect(() => {
    const el = globe.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setView((v) => ({
        ...v,
        zoom: Math.max(0.7, Math.min(1.2, v.zoom - e.deltaY * 0.002)),
      }));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const onReady = useCallback(() => setReady(true), []);
  const select = useCallback((c: string, origin = "IND") => {
    if (!moved.current)
      window.location.assign(
        "/explore/?destination=" +
          encodeURIComponent(c === origin ? "GBR" : c) +
          "&origin=" +
          encodeURIComponent(origin),
      );
  }, []);
  const change = (dz: number) =>
    setView((v) => ({ ...v, zoom: Math.min(1.2, Math.max(0.7, v.zoom + dz)) }));
  const props = {
    view,
    paused,
    dragging,
    onView: setView,
    onSelect: select,
    onReady,
  };
  return (
    <div className="globe-stage">
      <div className="plot-lines" aria-hidden="true">
        <svg viewBox="0 0 600 600">
          <g fill="none" stroke="currentColor">
            <circle cx="300" cy="300" r="275" strokeDasharray="2 7" />
            <circle cx="300" cy="300" r="255" />
            <path d="M12 300h576M300 12v576" strokeDasharray="3 7" />
            {Array.from({ length: 72 }, (_, i) => (
              <path
                key={i}
                d={i % 6 === 0 ? "M300 17v9" : "M300 19v4"}
                transform={"rotate(" + i * 5 + " 300 300)"}
              />
            ))}
          </g>
        </svg>
      </div>
      <span className="plot-degree north">60° N</span>
      <span className="plot-degree east">90° E</span>
      <div
        className="globe-viewport"
        role="group"
        aria-label="Interactive Earth. Drag to rotate, or use the arrow keys."
        ref={globe}
        tabIndex={0}
        onDoubleClick={() => setView(initialView)}
        onKeyDown={(e) => {
          const d: Record<string, [number, number]> = {
            ArrowLeft: [0, -8],
            ArrowRight: [0, 8],
            ArrowDown: [-6, 0],
            ArrowUp: [6, 0],
          };
          if (d[e.key]) {
            e.preventDefault();
            setPaused(true);
            setView((v) => ({
              ...v,
              lat: Math.min(75, Math.max(-75, v.lat + d[e.key][0])),
              lon: v.lon + d[e.key][1],
            }));
          }
        }}
        onPointerDown={(e) => {
          down.current = { x: e.clientX, y: e.clientY, v: view };
          moved.current = false;
          pointerCount.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          pinch.current = 0;
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (!down.current || !pointerCount.current.has(e.pointerId)) return;
          pointerCount.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const pts = [...pointerCount.current.values()];
          if (pts.length === 2) {
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            if (pinch.current) change((dist - pinch.current) * 0.003);
            pinch.current = dist;
            moved.current = true;
            return;
          }
          const dx = e.clientX - down.current.x,
            dy = e.clientY - down.current.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) {
            moved.current = true;
            setPaused(true);
            e.currentTarget.setPointerCapture(e.pointerId);
            setView({
              ...down.current.v,
              lon: down.current.v.lon - dx * 0.3,
              lat: Math.min(75, Math.max(-75, down.current.v.lat + dy * 0.22)),
            });
          }
        }}
        onPointerUp={(e) => {
          pointerCount.current.delete(e.pointerId);
          down.current = null;
          setDragging(false);
        }}
        onPointerCancel={(e) => {
          pointerCount.current.delete(e.pointerId);
          down.current = null;
          setDragging(false);
        }}
      >
        {!ready && <FallbackGlobe {...props} animate={!canGL} />}
        {canGL && (
          <Earth
            {...props}
            onFailure={() => {
              setGL(false);
              setReady(false);
            }}
          />
        )}
      </div>
      <div className="globe-controls">
        <span className="drag-hint">
          <Move size={14} />
          Drag to rotate
        </span>
        <div>
          <button
            aria-label={
              paused ? "Resume globe rotation" : "Pause globe rotation"
            }
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            aria-label="Zoom out"
            onClick={() => change(-0.1)}
            disabled={view.zoom <= 0.7}
          >
            <Minus size={16} />
          </button>
          <button
            aria-label="Zoom in"
            onClick={() => change(0.1)}
            disabled={view.zoom >= 1.2}
          >
            <Plus size={16} />
          </button>
          <button
            aria-label="Reset globe view"
            onClick={() => {
              setView(initialView);
              setPaused(true);
            }}
          >
            <LocateFixed size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
