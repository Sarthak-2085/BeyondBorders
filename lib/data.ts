"use client";
import { useEffect, useState } from "react";
import type originalPlanning from "@/backend/seeds/planning.json";
export type Planning = typeof originalPlanning;
export type Uni = Planning["universities"][number];
export type Destination = Planning["countries"][number];
export interface Source {
  id: string;
  name: string;
  publisher: string;
  url: string;
  period: string;
  retrieved: string;
  dimensions: string[];
  coverage: string;
  definition: string;
  field_mapping?: Record<string, { code: string; published: string }>;
  classification?: string;
}
export interface Obs {
  dataset_id: string;
  origin: string;
  destination: string;
  period: string;
  measure: string;
  level: string;
  field: string;
  value: number;
}
export type Place = { name: string; iso2: string; region: string };
export type Atlas = {
  sources: Source[];
  places: Record<string, Place>;
  planning: Planning;
  rows: Obs[];
};
export type Edition = { source: Source; rows: Obs[] };
declare global {
  interface Window {
    __BB_API__?: string;
  }
}
export const API = (
  process.env.NEXT_PUBLIC_ATLAS_API ||
  (typeof window !== "undefined" ? window.__BB_API__ : "") ||
  ""
).replace(/\/$/, "");
export const fmt = (n: number) => n.toLocaleString("en-US");
export const uniq = (xs: string[]) => Array.from(new Set(xs)).sort();
export const latest = (r: Obs[]) =>
  r.slice().sort((a, b) => b.period.localeCompare(a.period))[0];
export const getName = (a: Atlas, iso: string) => a.places[iso]?.name || iso;
export const flag = (p: Place) =>
  p?.iso2
    ? String.fromCodePoint(
        ...p.iso2
          .toUpperCase()
          .split("")
          .map((c) => 127397 + c.charCodeAt(0)),
      )
    : "";
export const readLocal = <T>(key: string, initial: T): T => {
  try {
    const v = localStorage.getItem("bb." + key);
    return v ? JSON.parse(v) : initial;
  } catch {
    return initial;
  }
};
export function saveLocal(key: string, v: unknown) {
  localStorage.setItem("bb." + key, JSON.stringify(v));
  window.dispatchEvent(new Event("bb-data"));
}
let cached: Promise<Atlas> | null = null;
export async function fetchAtlas(): Promise<Atlas> {
  if (!cached)
    cached = fetch(API ? API + "/api/atlas" : "/data/atlas.json")
      .then(async (response) => {
        if (!response.ok) throw Error("Could not load the atlas edition.");
        const d = await response.json();
        return {
          places: d.places,
          sources: d.sources,
          planning: d.planning,
          rows: d.records.map((row: unknown[]) =>
            Object.fromEntries(
              d.columns.map((k: string, i: number) => [k, row[i]]),
            ),
          ),
        } as Atlas;
      })
      .catch((err) => {
        cached = null;
        throw err;
      });
  return cached;
}
export function refreshAtlas() {
  cached = null;
  window.dispatchEvent(new Event("bb-data"));
}
export function useAtlas() {
  const [data, set] = useState<Atlas | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    function load() {
      fetchAtlas()
        .then((base) => {
          if (!active) return;
          const local = readLocal<Edition[]>("editions", []);
          set({
            ...base,
            sources: [...base.sources, ...local.map((e) => e.source)],
            rows: [...base.rows, ...local.flatMap((e) => e.rows)],
          });
          setError("");
        })
        .catch((err) => {
          if (active) setError(String(err.message));
        });
    }
    load();
    window.addEventListener("bb-data", load);
    window.addEventListener("storage", load);
    return () => {
      active = false;
      window.removeEventListener("bb-data", load);
      window.removeEventListener("storage", load);
    };
  }, []);
  return { data, error };
}
export type Saved = {
  kind: "university" | "country" | "scholarship";
  id: string;
  name: string;
  href: string;
};
export function useSaved() {
  const [saved, set] = useState<Saved[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    const load = () => set(readLocal("shortlist", []));
    load();
    window.addEventListener("bb-data", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("bb-data", load);
      window.removeEventListener("storage", load);
    };
  }, []);
  const toggle = (item: Saved) => {
    try {
      const current = readLocal<Saved[]>("shortlist", []);
      const same = (s: Saved) => s.kind === item.kind && s.id === item.id;
      saveLocal(
        "shortlist",
        current.some(same)
          ? current.filter((s) => !same(s))
          : [...current, item],
      );
      setError("");
    } catch {
      setError("Your browser could not save this shortlist.");
    }
  };
  return { saved, toggle, error };
}
export function param(k: string, fallback: string) {
  return typeof window === "undefined"
    ? fallback
    : new URLSearchParams(location.search).get(k) || fallback;
}
export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const el = document.createElement("a");
  el.href = url;
  el.download = name;
  el.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function csv(rows: (string | number)[][]) {
  return rows
    .map((row) =>
      row
        .map((v) => {
          let s = String(v);
          if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}
