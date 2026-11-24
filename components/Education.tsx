"use client";
import { useState } from "react";
import Link from "next/link";
import { Atlas, Uni, param, getName, fmt, useSaved } from "@/lib/data";
import {
  SearchBox,
  Select,
  CountrySelect,
  Empty,
  Official,
  Save,
} from "./Forms";
import { disciplines } from "@/lib/routes";
const levels = ["Bachelor", "Master", "Doctorate"];
function Institution({ a, u }: { a: Atlas; u: Uni }) {
  return (
    <article className="panel institution">
      <span className="meta">
        {u.city} / {getName(a, u.country)}
      </span>
      <h2>{u.name}</h2>
      <div className="inline-links">
        <Official href={u.url}>Official university website</Official>
        <Save
          item={{
            kind: "university",
            id: u.id,
            name: u.name,
            href: "/universities/?university=" + u.id,
          }}
        />
      </div>
      <h3>Selected programs</h3>
      <ul className="programs">
        {u.programs.map((p) => (
          <li key={p.name}>
            <div>
              <Official href={p.url}>{p.name}</Official>
              <small>
                {p.field} · {p.level}
              </small>
            </div>
          </li>
        ))}
      </ul>
      <h3>Published tuition</h3>
      <p>{u.tuition}</p>
      <h3>International admissions</h3>
      <p>{u.admissions}</p>
      <div className="source-stack">
        {u.sources.map((s) => (
          <Official key={s.url} href={s.url}>
            {s.label}
          </Official>
        ))}
      </div>
      <p className="meta">Verified {u.verified}</p>
    </article>
  );
}
export function Universities({ a }: { a: Atlas }) {
  const all = a.planning.universities;
  const [q, setQ] = useState(""),
    [dest, setDest] = useState(param("country", "")),
    [field, setField] = useState(param("field", "")),
    [level, setLevel] = useState(""),
    [selected, setSelected] = useState(param("university", "")),
    [other, setOther] = useState("");
  const filtered = all.filter(
    (u) =>
      (!dest || u.country === dest) &&
      (!q ||
        (
          u.name +
          " " +
          u.id +
          " " +
          u.city +
          " " +
          u.programs.map((p) => p.name).join(" ")
        )
          .toLowerCase()
          .includes(q.toLowerCase())) &&
      u.programs.some(
        (p) => (!field || p.field === field) && (!level || p.level === level),
      ),
  );
  const u = all.find((u) => u.id === selected),
    v = all.find((u) => u.id === other);
  return (
    <>
      <div className="filters">
        <SearchBox
          value={q}
          onChange={setQ}
          label="Search universities or programs"
        />
        <CountrySelect
          a={a}
          label="Destination"
          value={dest}
          onChange={setDest}
          choices={all.map((u) => u.country)}
          all="All destinations"
        />
        <Select
          label="Discipline"
          value={field}
          onChange={setField}
          options={[["", "All disciplines"], ...disciplines]}
        />
        <Select
          label="Degree"
          value={level}
          onChange={setLevel}
          options={[["", "All degrees"], ...levels]}
        />
      </div>
      <section className="panel">
        <h2>University directory</h2>
        <p className="sub">
          {filtered.length} institutions match · Selected programs from official
          catalogues
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Institution</th>
                <th>Location</th>
                <th>Programs</th>
                <th>Profile</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>
                    {u.city}, {getName(a, u.country)}
                  </td>
                  <td>{u.programs.length}</td>
                  <td>
                    <button
                      className="inline-btn"
                      onClick={() => {
                        setSelected(u.id);
                        if (other === u.id) setOther("");
                        requestAnimationFrame(() =>
                          document
                            .getElementById("university-profile")
                            ?.scrollIntoView({ block: "start" }),
                        );
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <Empty>No listed programs match these filters.</Empty>
        )}
      </section>
      <section id="university-profile">
        <div className="filters">
          <Select
            label="University profile"
            value={selected}
            onChange={(v) => {
              setSelected(v);
              if (other === v) setOther("");
            }}
            options={[
              ["", "Select an institution"],
              ...all.map((u) => [u.id, u.name] as [string, string]),
            ]}
          />
          <Select
            label="Compare with"
            disabled={!u}
            value={other}
            onChange={setOther}
            options={[
              ["", "Select a second institution"],
              ...all
                .filter((u) => u.id !== selected)
                .map((u) => [u.id, u.name] as [string, string]),
            ]}
          />
        </div>
        {u && (
          <div className={v ? "columns" : "profile-single"}>
            <Institution u={u} a={a} />
            {v && <Institution u={v} a={a} />}
          </div>
        )}
      </section>
    </>
  );
}
export function Scholarships({ a }: { a: Atlas }) {
  const [dest, setDest] = useState(param("country", "")),
    [level, setLevel] = useState(""),
    [field, setField] = useState(""),
    [nat, setNat] = useState(""),
    [q, setQ] = useState(""),
    [deadline, setDeadline] = useState(""),
    [funding, setFunding] = useState(""),
    [by, setBy] = useState("");
  const ss = a.planning.scholarships,
    fx = a.planning.exchange.rates as Record<string, number>;
  const today = new Date().toISOString().slice(0, 10);
  const hits = ss.filter(
    (s) =>
      (!dest || s.country === dest) &&
      (!level || s.levels.includes(level)) &&
      (!field || s.fields.includes("All") || s.fields.includes(field)) &&
      (!nat ||
        ((s.nationalities.includes("*") || s.nationalities.includes(nat)) &&
          !(s.excludedNationalities as string[]).includes(nat))) &&
      s.name.toLowerCase().includes(q.toLowerCase()) &&
      (!deadline ||
        (deadline === "undated"
          ? !s.deadlineDate
          : s.deadlineDate && s.deadlineDate >= today)) &&
      (!by || (s.deadlineDate && s.deadlineDate <= by)) &&
      (!funding ||
        (s.amountMax != null &&
          s.currency &&
          (s.amountMax / fx[s.currency]) * fx.INR >= Number(funding))),
  );
  return (
    <>
      <div className="filters">
        <SearchBox label="Search awards" value={q} onChange={setQ} />
        <CountrySelect
          a={a}
          label="Destination"
          all="All destinations"
          choices={ss.map((s) => s.country)}
          value={dest}
          onChange={setDest}
        />
        <CountrySelect
          a={a}
          label="Nationality"
          all="Any nationality"
          value={nat}
          onChange={setNat}
        />
        <Select
          label="Degree"
          value={level}
          onChange={setLevel}
          options={[["", "All degrees"], ...levels]}
        />
        <Select
          label="Discipline"
          value={field}
          onChange={setField}
          options={[["", "All disciplines"], ...disciplines]}
        />
        <Select
          label="Deadline status"
          value={deadline}
          onChange={setDeadline}
          options={[
            ["", "All cycles"],
            ["open", "Upcoming dated deadline"],
            ["undated", "Check official cycle"],
          ]}
        />
        <label className="form-field">
          <span>Deadline on or before</span>
          <input
            type="date"
            value={by}
            onChange={(e) => setBy(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Published award ceiling ≥ INR</span>
          <input
            min="0"
            type="number"
            placeholder="Any amount"
            value={funding}
            onChange={(e) => setFunding(e.target.value)}
          />
        </label>
      </div>
      <p className="sub">
        {hits.length} matching awards. Check the full eligibility conditions for
        your application cycle.
      </p>
      {funding && (
        <p className="sub">
          Dated monetary awards converted using ECB reference rates,{" "}
          {a.planning.exchange.date}. Variable funding has no numeric ceiling.
        </p>
      )}
      <div className="record-list">
        {hits.map((s) => (
          <article key={s.id} className="panel" id={s.id}>
            <span className="meta">
              {getName(a, s.country)} · {s.levels.join(" / ")}
            </span>
            <h2>{s.name}</h2>
            <p>{s.funding}</p>
            <p className="sub">{s.note}</p>
            <div className="detail-line">
              <b>Deadline</b>
              <span>
                {s.deadline}{" "}
                {s.deadlineDate && s.deadlineDate < today
                  ? " · Published cycle closed"
                  : ""}
              </span>
            </div>
            <div className="inline-links">
              <Official href={s.url}>Official award and application</Official>
              <Save
                item={{
                  kind: "scholarship",
                  id: s.id,
                  name: s.name,
                  href: "/scholarships/?country=" + s.country + "#" + s.id,
                }}
              />
            </div>
          </article>
        ))}
      </div>
      {!hits.length && <Empty>No awards match all selected criteria.</Empty>}
    </>
  );
}
export function Visa({ a }: { a: Atlas }) {
  const countries = a.planning.countries;
  const [iso, setIso] = useState(param("country", "GBR"));
  const c = countries.find((x) => x.iso === iso) || countries[0];
  return (
    <>
      <div className="filters">
        <CountrySelect
          a={a}
          label="Study destination"
          choices={countries.map((c) => c.iso)}
          value={c.iso}
          onChange={setIso}
        />
      </div>
      <div className="columns">
        <article className="ink-panel">
          <span className="meta">
            {c.flag} {c.name}
          </span>
          <h2>{c.visa.name}</h2>
          <p>Last verified {c.visa.verified}</p>
          <Official href={c.visa.url}>Government guidance</Official>
        </article>
        <section className="panel">
          {[
            ["Application requirements", c.visa.requirements],
            ["Financial evidence", c.visa.proof],
            ["Work during study", c.visa.work],
            ["After graduation", c.visa.post],
          ].map(([h, v]) => (
            <div className="prose-section" key={h}>
              <h3>{h}</h3>
              <p>{v}</p>
            </div>
          ))}
          <p className="sub">
            General planning information. Your nationality, program and
            individual permission determine the rules that apply. Consult the
            immigration authority for advice on your case.
          </p>
          <div className="source-stack">
            {c.visa.sources.map((s) => (
              <Official key={s.url} href={s.url}>
                {s.label}
              </Official>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
export function Shortlist() {
  const { saved, toggle, error } = useSaved();
  return (
    <section className="panel">
      <h2>Saved choices</h2>
      <p className="sub">Stored in this browser on this device.</p>
      {saved.length ? (
        <div className="record-list">
          {saved.map((s) => (
            <div className="saved-row" key={s.kind + s.id}>
              <div>
                <span className="meta">{s.kind}</span>
                <h3>
                  <Link href={s.href}>{s.name}</Link>
                </h3>
              </div>
              <button className="button small" onClick={() => toggle(s)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty>
          Your shortlist is empty. Save a country, university or scholarship
          while exploring.
        </Empty>
      )}
      <p role="status">{error}</p>
      <div className="inline-links">
        <Link href="/countries/">Browse countries</Link>
        <Link href="/universities/">Browse universities</Link>
        <Link href="/scholarships/">Browse awards</Link>
      </div>
    </section>
  );
}
