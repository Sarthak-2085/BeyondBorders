"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Atlas, useAtlas, fmt, getName, latest, uniq } from "@/lib/data";
import { CountrySelect } from "./Forms";
const RouteMap = dynamic(() => import("./RouteMap"), { ssr: false });
function ActiveCorridor() {
  const { data, error } = useAtlas();
  const [origin, setOrigin] = useState("IND"),
    [dest, setDest] = useState("DEU");
  if (!data)
    return (
      <p role="status" className="loading">
        {error || "Loading the mobility map…"}
      </p>
    );
  const rows = data.rows.filter(
    (r) => r.measure === "bilateral" && r.dataset_id === "uis-mobility",
  );
  const hit = latest(
    rows.filter((r) => r.origin === origin && r.destination === dest),
  );
  return (
    <>
      <div className="corridor-selectors">
        <CountrySelect
          a={data}
          label="Map origin"
          choices={uniq(rows.map((r) => r.origin))}
          value={origin}
          onChange={setOrigin}
        />
        <CountrySelect
          a={data}
          label="Map destination"
          choices={[dest, ...uniq(rows.map((r) => r.destination))]}
          value={dest}
          onChange={setDest}
        />
      </div>
      <RouteMap origin={origin} destination={dest} onSelect={setDest} />
      <div className="corridor-caption">
        <div>
          <strong>{hit ? fmt(hit.value) : "Unreported"}</strong>
          <span>
            {hit
              ? "Students · " + hit.period + " · UNESCO UIS"
              : "No published corridor count"}
          </span>
        </div>
        <Link
          className="text-link"
          href={"/explore/?origin=" + origin + "&destination=" + dest}
        >
          Route details
        </Link>
      </div>
    </>
  );
}
export default function LandingCorridor() {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setShow(true);
      return;
    }
    const watch = new IntersectionObserver(
      ([r]) => {
        if (r.isIntersecting) {
          setShow(true);
          watch.disconnect();
        }
      },
      { rootMargin: "150px" },
    );
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return (
    <div className="corridor-plate" ref={ref}>
      {show ? (
        <ActiveCorridor />
      ) : (
        <img
          loading="lazy"
          src="/geo/earth-atlas.webp"
          alt="Geographic relief map of the world"
        />
      )}
    </div>
  );
}
