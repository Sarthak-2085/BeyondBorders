"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Atlas,
  Destination,
  getName,
  param,
  readLocal,
  saveLocal,
} from "@/lib/data";
import { disciplines } from "@/lib/routes";
import { CountrySelect, Select, Official, Empty, Save } from "./Forms";
const labels = {
  tuition: "Tuition",
  housing: "Accommodation",
  food: "Food",
  transport: "Transport",
  insurance: "Insurance",
  other: "Other expenses",
};
type Key = keyof typeof labels;
const keys = Object.keys(labels) as Key[];
function costTotal(c: Destination) {
  return keys.reduce((sum, k) => sum + (c.cost[k] ?? 0), 0);
}
function money(n: number, unit: string) {
  return new Intl.NumberFormat(unit === "INR" ? "en-IN" : "en", {
    style: "currency",
    currency: unit,
    maximumFractionDigits: 0,
  }).format(n);
}
function fx(a: Atlas, n: number, from: string, to: string) {
  const r = a.planning.exchange.rates as Record<string, number>;
  return (n / r[from]) * r[to];
}
export function Costs({ a }: { a: Atlas }) {
  const cs = a.planning.countries,
    [iso, setIso] = useState(param("country", "DEU")),
    [currency, setCurrency] = useState("INR");
  const c = cs.find((c) => c.iso === iso) || cs[0];
  const [edits, setEdits] = useState<Partial<Record<Key, string>>>({});
  const val = (k: Key) => edits[k] ?? c.cost[k]?.toString() ?? "";
  const present = keys.filter((k) => val(k) !== "");
  const total = present.reduce(
    (sum, k) => sum + Math.max(0, Number(val(k)) || 0),
    0,
  );
  return (
    <>
      <div className="filters">
        <CountrySelect
          a={a}
          value={c.iso}
          onChange={(v) => {
            setIso(v);
            setEdits({});
          }}
          choices={cs.map((c) => c.iso)}
          label="Destination scenario"
        />
        <Select
          label="Display currency"
          value={currency}
          onChange={setCurrency}
          options={Object.keys(a.planning.exchange.rates)}
        />
      </div>
      <div className="columns">
        <section className="panel">
          <span className="meta">
            {c.name} · {c.cost.period}
          </span>
          <h2>Annual expenses</h2>
          <p className="sub">{c.cost.note}</p>
          <div className="cost-grid">
            {keys.map((k) => (
              <label key={k} className="form-field">
                <span>
                  {labels[k]} · {c.cost.currency}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={val(k)}
                  placeholder="Enter an estimate"
                  onChange={(e) =>
                    setEdits({
                      ...edits,
                      [k]:
                        e.target.value === ""
                          ? ""
                          : String(Math.max(0, Number(e.target.value))),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <button className="button small" onClick={() => setEdits({})}>
            Reset published inputs
          </button>
          <div className="source-stack">
            {c.cost.sources.map((s) => (
              <Official key={s.url} href={s.url}>
                {s.label}
              </Official>
            ))}
          </div>
        </section>
        <aside className="ink-panel">
          <span className="meta">Annual planning estimate</span>
          <h2>
            {present.length === 6 ? "Estimated total" : "Known-cost subtotal"}
          </h2>
          <strong className="big-number">
            {money(fx(a, total, c.cost.currency, currency), currency)}
          </strong>
          <p>{money(total, c.cost.currency)} in the destination currency.</p>
          <p>
            {present.length} of 6 expense categories included.{" "}
            {present.length < 6
              ? "Add missing categories to complete the estimate."
              : "Actual costs depend on your program and living arrangements."}
          </p>
          <div className="source-note">
            <Official href={a.planning.exchange.source}>
              ECB exchange rates
            </Official>{" "}
            · {a.planning.exchange.date}
          </div>
        </aside>
      </div>
    </>
  );
}
type Plan = {
  origin: string;
  field: string;
  level: string;
  currency: string;
  budget: string;
  preferred: string[];
  when: string;
};
const initial: Plan = {
  origin: "IND",
  field: "Computer Science",
  level: "Master",
  currency: "INR",
  budget: "",
  preferred: [],
  when: "",
};
export function Planner({ a }: { a: Atlas }) {
  const [form, setForm] = useState<Plan>(initial),
    [result, setResult] = useState<Plan | null>(null),
    [status, setStatus] = useState("");
  useEffect(() => {
    const p = readLocal<Plan | null>("plan", null);
    if (p) {
      setForm(p);
      setResult(p);
    }
  }, []);
  const patch = (v: Partial<Plan>) => setForm((f) => ({ ...f, ...v }));
  const ranked = result
    ? a.planning.countries
        .filter((c) => c.iso !== result.origin)
        .map((c) => {
          const programs = a.planning.universities
            .filter((u) => u.country === c.iso)
            .flatMap((u) =>
              u.programs
                .filter(
                  (p) => p.field === result.field && p.level === result.level,
                )
                .map((p) => ({ ...p, uni: u.name })),
            );
          const cost = fx(a, costTotal(c), c.cost.currency, result.currency);
          const partial = keys.some((k) => c.cost[k] == null);
          const preferred = result.preferred.includes(c.iso);
          const completeBudget = !partial && cost <= Number(result.budget);
          let score =
            (programs.length ? 4 : 0) +
            (preferred ? 2 : 0) +
            (completeBudget ? 1 : 0);
          return {
            c,
            programs,
            cost,
            partial,
            preferred,
            completeBudget,
            score,
          };
        })
        .filter((x) => x.programs.length > 0)
        .sort((x, y) => y.score - x.score || x.cost - y.cost)
    : [];
  return (
    <>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          setResult({ ...form });
          try {
            saveLocal("plan", form);
            setStatus("Plan saved on this device.");
          } catch {
            setStatus("Plan calculated. Device storage is unavailable.");
          }
        }}
      >
        <h2>Your study preferences</h2>
        <div className="form-grid">
          <CountrySelect
            a={a}
            label="Home country"
            value={form.origin}
            onChange={(origin) => patch({ origin })}
          />
          <Select
            label="Intended course"
            value={form.field}
            onChange={(field) => patch({ field })}
            options={disciplines}
          />
          <Select
            label="Degree level"
            value={form.level}
            onChange={(level) => patch({ level })}
            options={["Bachelor", "Master", "Doctorate"]}
          />
          <label className="form-field">
            <span>Annual budget</span>
            <input
              required
              type="number"
              min="1"
              step="any"
              value={form.budget}
              placeholder="Enter your annual limit"
              onChange={(e) => patch({ budget: e.target.value })}
            />
          </label>
          <Select
            label="Budget currency"
            value={form.currency}
            onChange={(currency) => patch({ currency })}
            options={Object.keys(a.planning.exchange.rates)}
          />
          <label className="form-field">
            <span>Intended start month</span>
            <input
              type="month"
              required
              value={form.when}
              onChange={(e) => patch({ when: e.target.value })}
            />
          </label>
        </div>
        <fieldset>
          <legend>Preferred destinations</legend>
          <div className="checks">
            {a.planning.countries.map((c) => (
              <label key={c.iso}>
                <input
                  type="checkbox"
                  checked={form.preferred.includes(c.iso)}
                  onChange={(e) =>
                    patch({
                      preferred: e.target.checked
                        ? [...form.preferred, c.iso]
                        : form.preferred.filter((v) => v !== c.iso),
                    })
                  }
                />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="button dark" type="submit">
          Find destinations
        </button>
        <span className="form-status" role="status">
          {status}
        </span>
      </form>
      {result && (
        <section className="panel">
          <span className="meta">Intended start · {result.when}</span>
          <h2>Your destination matches</h2>
          <p className="sub">
            A listed course and degree match earns 4 points, a preferred
            destination earns 2, and a complete country cost scenario within
            budget earns 1. Home destinations are excluded. Cost scenarios cover
            named programs. Confirm your chosen program’s tuition and intake
            with the university.
          </p>
          {ranked.length ? (
            ranked.map(
              ({
                c,
                programs,
                cost,
                partial,
                score,
                preferred,
                completeBudget,
              }) => (
                <article className="match" key={c.iso}>
                  <div className="section-row">
                    <h3>
                      {c.flag} {c.name}
                    </h3>
                    <span className="meta">{score} / 7 points</span>
                  </div>
                  <p>
                    {programs.length} listed course{" "}
                    {programs.length === 1 ? "match" : "matches"}
                    {preferred ? " · Preferred destination" : ""}
                    {completeBudget
                      ? " · Published scenario within budget"
                      : ""}
                  </p>
                  <ul>
                    {programs.map((p) => (
                      <li key={p.url}>
                        <Official href={p.url}>
                          {p.name} · {p.uni}
                        </Official>
                      </li>
                    ))}
                  </ul>
                  <p className="sub">
                    {partial ? "Partial annual scenario" : "Annual scenario"}{" "}
                    {money(cost, result.currency)} · {c.cost.period}
                  </p>
                  <div className="inline-links">
                    <Link href={"/costs/?country=" + c.iso}>Adjust costs</Link>
                    <Link href={"/visa/?country=" + c.iso}>Visa guide</Link>
                    <Save
                      item={{
                        kind: "country",
                        id: c.iso,
                        name: c.name,
                        href: "/countries/?country=" + c.iso,
                      }}
                    />
                  </div>
                </article>
              ),
            )
          ) : (
            <Empty>
              No exact course and degree match in the current directory. Change
              the discipline or degree to explore other options.
            </Empty>
          )}
        </section>
      )}
    </>
  );
}
