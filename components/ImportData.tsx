"use client";
import { useState } from "react";
import Link from "next/link";
import { Upload, Download } from "lucide-react";
import {
  API,
  Atlas,
  Edition,
  Obs,
  Source,
  readLocal,
  saveLocal,
  refreshAtlas,
  download,
} from "@/lib/data";
import { columns, normalizeCSV, mergeEdition } from "@/lib/imports";
import { Select } from "./Forms";
type Preview = {
  source: Source;
  rows: Obs[];
  missing: number;
  duplicates: number;
  added: number;
};
const attributes = [
  ["id", "Edition ID"],
  ["publisher", "Publisher"],
  ["name", "Dataset name"],
  ["url", "Source URL"],
  ["period", "Reference period"],
  ["retrieved", "Retrieval date"],
  ["coverage", "Geographic coverage"],
  ["definition", "Measure definition"],
] as const;
export default function ImportData({ a }: { a: Atlas }) {
  const [form, setForm] = useState({
    id: "",
    publisher: "",
    name: "",
    url: "",
    period: "",
    retrieved: new Date().toISOString().slice(0, 10),
    coverage: "",
    definition: "",
  });
  const [dims, setDims] = useState("origin, destination, reference year"),
    [classification, setClass] = useState("User import"),
    [txt, setTxt] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [msg, setMsg] = useState(""),
    [last, setLast] = useState(""),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState(""),
    [shared, setShared] = useState(false);
  function invalidate() {
    setPreview(null);
    setMsg("");
    setLast("");
  }
  async function submit(commit: boolean) {
    setBusy(true);
    setMsg("");
    try {
      if (!txt.trim()) throw Error("Select a CSV or paste its contents.");
      const source: Source = {
        ...form,
        id: "user-" + form.id.trim(),
        dimensions: dims
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        classification,
      };
      if (!source.dimensions.length)
        throw Error("Add at least one available dimension.");
      if (a.sources.some((s) => s.id === source.id && !s.classification))
        throw Error("This dataset ID is reserved.");
      const result = normalizeCSV(a, txt, source);
      let added = 0;
      if (shared) {
        const res = await fetch(API + "/api/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + key,
          },
          body: JSON.stringify({ source, csv_text: txt, preview: !commit }),
        });
        const body = await res.json();
        if (!res.ok)
          throw Error(
            typeof body.detail === "string"
              ? body.detail
              : "Import rejected by the server.",
          );
        added = body.added;
      } else {
        const update = () => {
          const merged = mergeEdition(
            readLocal<Edition[]>("editions", []),
            source,
            result.rows,
          );
          added = merged.added;
          if (commit) saveLocal("editions", merged.editions);
        };
        if (navigator.locks)
          await navigator.locks.request("bb-editions", update);
        else update();
      }
      if (commit) {
        setLast(source.id);
        setPreview(null);
        setMsg(added + " new observations saved.");
        if (shared) refreshAtlas();
      } else setPreview({ ...result, source, added });
    } catch (err) {
      setPreview(null);
      setMsg(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="panel import-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(Boolean(preview));
      }}
    >
      <div className="section-row">
        <h2>Import an edition</h2>
        <button
          type="button"
          className="button small"
          onClick={() =>
            download("atlas-template.csv", columns.join(",") + "\n", "text/csv")
          }
        >
          <Download size={14} />
          CSV template
        </button>
      </div>
      <p className="sub">
        Add a distinct dataset with its provenance. Use ISO country codes and
        WLD for a published world aggregate. Blank counts stay missing.
        Re-importing identical records is safe.
      </p>
      <div className="form-grid">
        {attributes.map(([k, label]) => (
          <label className="form-field" key={k}>
            <span>{label}</span>
            <input
              required
              type={k === "url" ? "url" : k === "retrieved" ? "date" : "text"}
              value={form[k]}
              maxLength={k === "definition" ? 2000 : 500}
              placeholder={
                k === "id"
                  ? "my-edition-2024"
                  : k === "period"
                    ? "2024 or 2023/24"
                    : undefined
              }
              onChange={(e) => {
                invalidate();
                setForm({ ...form, [k]: e.target.value });
              }}
            />
          </label>
        ))}
        <label className="form-field">
          <span>Available dimensions</span>
          <input
            required
            value={dims}
            onChange={(e) => {
              invalidate();
              setDims(e.target.value);
            }}
          />
        </label>
        <Select
          label="Classification"
          value={classification}
          onChange={(v) => {
            invalidate();
            setClass(v);
          }}
          options={["User import", "DEMO DATA"]}
        />
        {API && (
          <Select
            label="Save destination"
            value={shared ? "server" : "local"}
            onChange={(v) => {
              invalidate();
              setShared(v === "server");
            }}
            options={[
              ["local", "This browser"],
              ["server", "Shared database"],
            ]}
          />
        )}{" "}
        {shared && (
          <label className="form-field">
            <span>Administrator key</span>
            <input
              required
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => {
                invalidate();
                setKey(e.target.value);
              }}
            />
          </label>
        )}
      </div>
      <div className="upload">
        <label className="form-field">
          <span>Choose CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              invalidate();
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 2_000_000) {
                setTxt("");
                setMsg("Use a CSV smaller than 2 MB.");
                return;
              }
              try {
                setTxt(await f.text());
              } catch {
                setMsg("This file could not be read.");
              }
            }}
          />
        </label>
        <label className="form-field">
          <span>CSV contents</span>
          <textarea
            value={txt}
            rows={5}
            maxLength={2_000_000}
            placeholder={columns.slice(1).join(",")}
            onChange={(e) => {
              invalidate();
              setTxt(e.target.value);
            }}
          />
        </label>
      </div>
      <p className="sub">
        For a filled dataset_id column, use{" "}
        <code>user-{form.id || "your-edition-id"}</code>. Use All for level or
        field only when the source reports an aggregate.{" "}
        {shared
          ? "Confirmed records will be written to the shared database."
          : "Confirmed records are saved in this browser and appear in Sources & reports."}
      </p>
      {preview && (
        <div className="import-review">
          <h3>Validation complete</h3>
          <p>
            {preview.added} new ·{" "}
            {preview.duplicates + preview.rows.length - preview.added} identical
            duplicates · {preview.missing} missing counts skipped.
          </p>
          <p>
            {preview.source.name} · {preview.source.publisher} ·{" "}
            {preview.source.period}
          </p>
        </div>
      )}
      <button disabled={busy} className="button dark" type="submit">
        <Upload size={15} />
        {busy ? "Processing…" : preview ? "Confirm import" : "Validate CSV"}
      </button>{" "}
      <span role="status">{msg}</span>
      {last && (
        <Link className="text-link" href={"/reports/?dataset=" + last}>
          View imported observations
        </Link>
      )}
    </form>
  );
}
