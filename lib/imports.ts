import { csvParse } from "d3-dsv";
import type { Atlas, Edition, Obs, Source } from "./data";
import { disciplines } from "./routes";
export const columns = [
  "dataset_id",
  "origin",
  "destination",
  "period",
  "measure",
  "level",
  "field",
  "value",
] as const;
const aliases: Record<string, string> = {
  ict: "Computer Science",
  "business and administration": "Business and Management",
  "engineering and engineering trades": "Engineering",
  health: "Medicine and Healthcare",
};
const levels: Record<string, string> = {
  all: "All",
  "short-cycle": "Short-cycle",
  bachelor: "Bachelor's",
  "bachelor's": "Bachelor's",
  master: "Master's",
  "master's": "Master's",
  doctorate: "Doctorate",
  phd: "Doctorate",
};
export const observationKey = (r: Obs) =>
  JSON.stringify(columns.slice(0, -1).map((k) => r[k]));
export function normalizeCSV(a: Atlas, text: string, source: Source) {
  if (!/^user-[a-z0-9][a-z0-9-]{0,54}$/.test(source.id))
    throw Error(
      "Use a short edition ID with lowercase letters, numbers and hyphens.",
    );
  if (!["https:", "http:"].includes(new URL(source.url).protocol))
    throw Error("Use a public HTTP or HTTPS source URL.");
  const rows = csvParse(text.replace(/^\uFEFF/, ""));
  if (columns.slice(1).some((k) => !rows.columns.includes(k)))
    throw Error(
      "CSV header is incomplete. Download the template for the required columns.",
    );
  if (rows.length > 20000)
    throw Error("Import up to 20,000 observations at a time.");
  const look = new Map<string, string>();
  Object.entries(a.places).forEach(([iso, p]) =>
    [iso, p.iso2, p.name]
      .filter(Boolean)
      .forEach((k) => look.set(k.toLowerCase(), iso)),
  );
  look.set("uk", "GBR");
  look.set("united states of america", "USA");
  look.set("all countries", "WLD");
  const fields = Object.fromEntries(
    ["All", ...disciplines].map((f) => [f.toLowerCase(), f]),
  );
  Object.assign(fields, aliases);
  const seen = new Map<string, Obs>();
  let missing = 0,
    duplicates = 0;
  rows.forEach((r, ix) => {
    const fail = (msg: string): never => {
      throw Error("Row " + (ix + 2) + ": " + msg);
    };
    const get = (s: string) => (r[s] || "").trim();
    if (get("dataset_id") && get("dataset_id") !== source.id)
      fail("Dataset ID differs from the selected edition.");
    const origin = look.get(get("origin").toLowerCase()),
      destination = look.get(get("destination").toLowerCase());
    if (!origin || !destination) fail("Unknown origin or destination.");
    const measure = get("measure").toLowerCase();
    const expected =
      origin === "WLD"
        ? destination === "WLD"
          ? "global"
          : "inbound"
        : destination === "WLD"
          ? "outbound"
          : "bilateral";
    if (
      measure !== expected ||
      (measure === "bilateral" && origin === destination)
    )
      fail("Geography does not match the measure.");
    const m = get("period").match(/^(\d{4})(?:[-/–](\d{4}|\d{2}))?$/);
    if (!m || Number(m[1]) < 1900 || Number(m[1]) > 2100)
      fail("Invalid reference period.");
    const start = m![1],
      end = m![2],
      next = String(Number(start) + 1);
    if (end && end !== next && end !== next.slice(-2))
      fail("Academic years must be consecutive.");
    const level = levels[get("level").toLowerCase()],
      field = fields[get("field").toLowerCase()];
    if (!level || !field)
      fail("Unknown degree or discipline. Use All only for a published total.");
    const raw = get("value");
    if (["", "na", "n/a", "..", ":"].includes(raw.toLowerCase())) {
      missing++;
      return;
    }
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)))
      fail("Expected a nonnegative integer.");
    const observation: Obs = {
      dataset_id: source.id,
      origin: origin!,
      destination: destination!,
      period: end ? start + "/" + next : start,
      measure,
      level,
      field,
      value: Number(raw),
    };
    const key = observationKey(observation),
      prior = seen.get(key);
    if (prior) {
      if (prior.value !== observation.value) fail("Conflicting duplicate.");
      duplicates++;
    }
    seen.set(key, observation);
  });
  if (!seen.size) throw Error("There are no observations to import.");
  return { rows: [...seen.values()], missing, duplicates };
}
export function mergeEdition(existing: Edition[], source: Source, rows: Obs[]) {
  const old = existing.find((e) => e.source.id === source.id);
  if (old && JSON.stringify(old.source) !== JSON.stringify(source))
    throw Error("Use a new edition ID when provenance changes.");
  const merged = new Map(old?.rows.map((r) => [observationKey(r), r]) || []);
  const oldSize = merged.size;
  rows.forEach((r) => {
    const key = observationKey(r),
      prior = merged.get(key);
    if (prior && prior.value !== r.value)
      throw Error("A stored value differs. Use a new edition ID.");
    merged.set(key, r);
  });
  return {
    editions: [
      ...existing.filter((e) => e.source.id !== source.id),
      { source, rows: [...merged.values()] },
    ],
    added: merged.size - oldSize,
  };
}
