"use client";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import {
  Suspense,
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as T from "three";
import { countryAt } from "@/lib/geohit";
import { arc, cities, rad, routes, unit } from "@/lib/globe";
import type { GlobeProps } from "./GlobeStage";
function Line({
  points,
  color,
  opacity = 1,
  select,
}: {
  points: number[][];
  color: string;
  opacity?: number;
  select?: () => void;
}) {
  const line = useMemo(
    () =>
      new T.Line(
        new T.BufferGeometry().setFromPoints(
          points.map((p) => new T.Vector3(p[0], p[1], p[2])),
        ),
        new T.LineBasicMaterial({ color, transparent: true, opacity }),
      ),
    [points, color, opacity],
  );
  useEffect(
    () => () => {
      line.geometry.dispose();
      line.material.dispose();
    },
    [line],
  );
  return (
    <primitive
      object={line}
      onClick={(e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        select?.();
      }}
    />
  );
}
const paths = routes.map(([a, b]) =>
  Array.from({ length: 70 }, (_, i) => arc(a, b, i / 69)),
);
function Sphere({ view, paused, dragging, onReady, onSelect }: GlobeProps) {
  const [surface, bump] = useTexture([
    "/geo/earth-atlas.webp",
    "/geo/earth-height.webp",
  ]);
  surface.colorSpace = T.SRGBColorSpace;
  const group = useRef<T.Group>(null);
  const particles = useRef<T.InstancedMesh>(null);
  const rt = useRef(0),
    clock = useRef(0),
    sent = useRef(false);
  const [labels, setLabels] = useState<number[]>([]);
  const ctx = useThree();
  const obj = useMemo(() => new T.Object3D(), []);
  const fr = useRef(0);
  useEffect(() => {
    rt.current = 0;
    ctx.invalidate();
  }, [view, ctx.invalidate]);
  useEffect(() => {
    const cam = ctx.camera as T.OrthographicCamera;
    cam.zoom = Math.min(ctx.size.width, ctx.size.height) * 0.435 * view.zoom;
    cam.updateProjectionMatrix();
    ctx.invalidate();
  }, [ctx.camera, ctx.size, ctx.invalidate, view.zoom]);
  useFrame((_, dt) => {
    if (!group.current) return;
    if (!paused && !dragging) {
      rt.current += Math.min(0.06, dt) * 0.55;
      clock.current += Math.min(0.06, dt);
      ctx.invalidate();
    }
    group.current.rotation.set(
      view.lat * rad,
      -(view.lon + rt.current) * rad,
      0,
      "XYZ",
    );
    group.current.updateMatrixWorld();
    paths.forEach((_, i) => {
      const [a, b] = routes[i];
      obj.position.fromArray(
        arc(a, b, (clock.current * 0.095 + i * 0.217) % 1),
      );
      obj.updateMatrix();
      particles.current?.setMatrixAt(i, obj.matrix);
    });
    if (particles.current) particles.current.instanceMatrix.needsUpdate = true;
    if (fr.current++ % 10 === 0 || paused) {
      const next = cities
        .map((c, i) =>
          c.label &&
          new T.Vector3(...unit(c.lat, c.lon)).applyEuler(
            group.current!.rotation,
          ).z > 0.26
            ? i
            : -1,
        )
        .filter((i) => i >= 0);
      if (next.join() != labels.join()) setLabels(next);
    }
    if (!sent.current) {
      sent.current = true;
      onReady?.();
    }
  });
  return (
    <group ref={group}>
      <mesh
        rotation={[0, -Math.PI / 2, 0]}
        onClick={async (e) => {
          if (!group.current) return;
          e.stopPropagation();
          const p = group.current.worldToLocal(e.point.clone()).normalize();
          try {
            const iso = await countryAt(
              Math.asin(p.y) / rad,
              Math.atan2(p.x, p.z) / rad,
            );
            if (iso) onSelect(iso);
          } catch {}
        }}
      >
        <sphereGeometry args={[1, 128, 96]} />
        <meshStandardMaterial
          map={surface}
          bumpMap={bump}
          bumpScale={0.012}
          roughness={0.92}
          metalness={0.03}
        />
      </mesh>
      {paths.map((p, i) => (
        <Line
          key={i}
          points={p}
          select={() =>
            onSelect(cities[routes[i][1]].country, cities[routes[i][0]].country)
          }
          color={i % 3 === 0 ? "#e0a761" : "#f5c488"}
          opacity={0.91}
        />
      ))}
      {cities.map((c, i) => (
        <group
          key={c.name}
          position={
            unit(c.lat, c.lon).map((x) => x * 1.012) as [number, number, number]
          }
        >
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              onSelect(c.country);
            }}
          >
            <sphereGeometry args={[0.012, 12, 8]} />
            <meshBasicMaterial color="#f5d599" />
          </mesh>
          {labels.includes(i) && (
            <Html
              center
              zIndexRange={[3, 1]}
              style={{ pointerEvents: "auto", whiteSpace: "nowrap" }}
            >
              <button
                className={"map-label loc-" + i}
                onClick={() => onSelect(c.country)}
              >
                {c.name}
              </button>
            </Html>
          )}
        </group>
      ))}
      <instancedMesh
        ref={particles}
        args={[undefined, undefined, paths.length]}
      >
        <sphereGeometry args={[0.006, 6, 6]} />
        <meshBasicMaterial color="#fff4d8" />
      </instancedMesh>
    </group>
  );
}
class Boundary extends Component<
  { fail: () => void; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.fail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
export default function GlobeThree(p: GlobeProps & { onFailure: () => void }) {
  const [visible, setVisible] = useState(true);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ob = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return (
    <div ref={host} className="three-globe">
      <Boundary fail={p.onFailure}>
        <Canvas
          orthographic
          frameloop={visible ? "demand" : "never"}
          camera={{ position: [0, 0, 4], near: 0.1, far: 12 }}
          dpr={[1, 1.6]}
          gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
          onCreated={({ gl, raycaster }) => {
            raycaster.params.Line.threshold = 0.012;
            gl.toneMapping = T.NoToneMapping;
            gl.domElement.addEventListener(
              "webglcontextlost",
              (e) => {
                e.preventDefault();
                p.onFailure();
              },
              { once: true },
            );
          }}
        >
          <ambientLight intensity={1.25} />
          <directionalLight
            position={[-3, 5, 4]}
            color="#fff4da"
            intensity={2}
          />
          <Suspense fallback={null}>
            <Sphere {...p} />
          </Suspense>
        </Canvas>
      </Boundary>
    </div>
  );
}
