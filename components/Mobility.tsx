"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPinned, BookOpen } from "lucide-react";
import {
  Atlas,
  Obs,
  fmt,
  getName,
  latest,
  param,
  uniq,
  flag,
} from "@/lib/data";
import {
  CountrySelect,
  Empty,
  Save,
  SearchBox,
  Select,
  SourceNote,
} from "./Forms";
import { disciplines } from "@/lib/routes";
const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="map-plate loading">Drawing the world map…</div>
  ),
});
const Chart = dynamic(() => import("./TrendChart"), { ssr: false });
export function Totals({ a, year }: { a: Atlas; year: string }) {
  const all = a.rows
    .filter(
      (r) =>
        r.dataset_id === "uis-mobility" &&
        r.measure === "inbound" &&
        r.period === year &&
        r.level === "All" &&
        r.field === "All",
    )
    .sort((x, y) => y.value - x.value);
  return (
    <section className="panel">
      <h2>Leading destinations</h2>
      <p className="sub">
        {all.length} reporting destinations · {year}
      </p>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Destination</th>
            <th>Inbound students</th>
          </tr>
        </thead>
        <tbody>
          {all.slice(0, 10).map((r, i) => (
            <tr key={r.destination}>
              <td>{i + 1}</td>
              <td>
                <Link href={"/countries/?country=" + r.destination}>
                  {getName(a, r.destination)}
                </Link>
              </td>
              <td>{fmt(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <SourceNote
        s={a.sources.find((s) => s.id === "uis-mobility")}
        period={year}
      />
    </section>
  );
}
export function Explore({ a }: { a: Atlas }) {
  const sources = a.sources.filter((s) =>
    a.rows.some((r) => r.dataset_id === s.id && r.measure === "bilateral"),
  );
  const [ds, setDs] = useState(param("dataset", "uis-mobility"));
  const [origin, setOrigin] = useState(param("origin", "IND")),
    [dest, setDest] = useState(param("destination", "GBR")),
    [yr, setYr] = useState(param("year", "")),
    [level, setLevel] = useState("All"),
    [field, setField] = useState("All");
  const series = a.rows.filter(
    (r) => r.dataset_id === ds && r.measure === "bilateral",
  );
  const from = uniq(series.map((r) => r.origin));
  const to = uniq(series.map((r) => r.destination));
  const sel = series.filter(
    (r) => r.origin === origin && r.destination === dest,
  );
  const levels = uniq(sel.map((r) => r.level)),
    fields = uniq(sel.filter((r) => r.level === level).map((r) => r.field));
  const complete = sel.filter((r) => r.level === level && r.field === field);
  const yrs = uniq(series.map((r) => r.period)).reverse();
  const year = yr || latest(complete)?.period || yrs[0] || "2024";
  const hit = complete.find((r) => r.period === year);
  const source = a.sources.find((s) => s.id === ds);
  return (
    <>
      <div className="filters">
        {sources.length > 1 && (
          <Select
            label="Dataset"
            value={ds}
            options={sources.map((s) => [s.id, s.name])}
            onChange={(v) => {
              setDs(v);
              const row = a.rows.find(
                (r) => r.dataset_id === v && r.measure === "bilateral",
              )!;
              setOrigin(row.origin);
              setDest(row.destination);
              setLevel(row.level);
              setField(row.field);
              setYr("");
            }}
          />
        )}
        <CountrySelect
          a={a}
          label="Origin"
          value={origin}
          choices={[origin, ...from]}
          onChange={(v) => {
            setOrigin(v);
            setYr("");
          }}
        />
        <CountrySelect
          a={a}
          label="Destination"
          value={dest}
          choices={[dest, ...to]}
          onChange={(v) => {
            setDest(v);
            setYr("");
          }}
        />
        <Select
          label="Reference period"
          value={year}
          onChange={setYr}
          options={yrs}
        />
        {levels.some((x) => x !== "All") && (
          <Select
            label="Study level"
            value={level}
            options={levels}
            onChange={(v) => {
              setLevel(v);
              setField(sel.find((r) => r.level === v)?.field || "All");
            }}
          />
        )}
        {fields.some((x) => x !== "All") && (
          <Select
            label="Discipline"
            value={field}
            options={fields}
            onChange={setField}
          />
        )}
      </div>
      <div className="product-two">
        <section className="map-frame">
          <RouteMap
            origin={origin}
            destination={dest}
            onSelect={(v) => {
              setDest(v);
              setYr("");
            }}
          />
          <div className="map-caption">
            <span>
              <i />
              Origin
            </span>
            <span>
              <i />
              Destination
            </span>
            <small>Select a country to change the destination</small>
          </div>
        </section>
        <section className="ink-panel">
          <span className="meta">Student corridor · {year}</span>
          <h2>
            {getName(a, origin)} <em>to</em>
            <br />
            {getName(a, dest)}
          </h2>
          {hit ? (
            <>
              <strong className="big-number">{fmt(hit.value)}</strong>
              <p>Internationally mobile tertiary students</p>
            </>
          ) : (
            <p className="no-record">No published count for this selection.</p>
          )}
          <SourceNote s={source} period={year} />
        </section>
      </div>
      <div className="columns">
        <section className="panel">
          <h2>Corridor history</h2>
          {complete.length ? (
            <Chart rows={complete} />
          ) : (
            <Empty>No observations in this dataset for this corridor.</Empty>
          )}
          <p className="sub">
            Enrolled students in each reference period. Gaps indicate missing
            observations.
          </p>
        </section>
        <Totals a={a} year={year} />
      </div>
    </>
  );
}
export function Countries({ a }: { a: Atlas }) {
  const [sel, setSel] = useState(param("country", "DEU")),
    [other, setOther] = useState(param("compare", "")),
    [search, setSearch] = useState(""),
    [region, setRegion] = useState(""),
    [page, setPage] = useState(1),
    [year, setYear] = useState("2024");
  const places = Object.keys(a.places).filter(
    (x) =>
      x !== "WLD" && a.rows.some((r) => r.origin === x || r.destination === x),
  );
  const visible = places
    .filter(
      (x) =>
        getName(a, x).toLowerCase().includes(search.toLowerCase()) &&
        (!region || a.places[x].region === region),
    )
    .sort((x, y) => getName(a, x).localeCompare(getName(a, y)));
  const annual = (iso: string, measure: string) =>
    a.rows.filter(
      (r) =>
        r.dataset_id ===
          (measure === "inbound" ? "uis-mobility" : "uis-outbound") &&
        r.measure === measure &&
        (measure === "inbound" ? r.destination : r.origin) === iso,
    );
  const src = (id: string) => a.sources.find((s) => s.id === id);
  function profile(iso: string) {
    const place = a.places[iso];
    if (!place) return <Empty>Country unavailable.</Empty>;
    const inflow = annual(iso, "inbound"),
      out = annual(iso, "outbound");
    const main = a.rows
      .filter(
        (r) =>
          r.dataset_id === "uis-mobility" &&
          r.destination === iso &&
          r.measure === "bilateral" &&
          r.period === year,
      )
      .sort((x, y) => y.value - x.value)
      .slice(0, 5);
    const fields = a.rows
      .filter(
        (r) =>
          r.dataset_id === "eurostat-fields" &&
          r.destination === iso &&
          r.level === "All" &&
          r.period === year,
      )
      .sort((x, y) => y.value - x.value)
      .slice(0, 3);
    const planning = a.planning.countries.find((c) => c.iso === iso);
    return (
      <section className="panel profile">
        <div className="section-row">
          <p className="meta">
            {place.region || "Country profile"} · {iso}
          </p>
          <Save
            item={{
              kind: "country",
              id: iso,
              name: place.name,
              href: "/countries/?country=" + iso,
            }}
          />
        </div>
        <h2>
          {flag(place)} {place.name}
        </h2>
        {planning && (
          <p className="sub">
            {planning.capital} · {planning.lat}° latitude, {planning.lon}°
            longitude
          </p>
        )}
        <div className="stat-pair">
          {[
            [inflow, "Inbound students"],
            [out, "Outbound estimate"],
          ].map(([arr, label]) => {
            const v = (arr as Obs[]).find((r) => r.period === year);
            return (
              <div key={String(label)}>
                <strong>{v ? fmt(v.value) : "—"}</strong>
                <span>
                  {String(label)} · {year}
                </span>
              </div>
            );
          })}
        </div>
        <p className="sub">
          A dash indicates missing data for the selected year.
        </p>
        <h3>Historical inflow</h3>
        {inflow.length ? (
          <Chart rows={inflow} />
        ) : (
          <Empty>Inbound history unavailable.</Empty>
        )}
        <SourceNote s={src("uis-mobility")} />
        <SourceNote s={src("uis-outbound")} />
        <h3>Origins in the corridor collection</h3>
        {main.length ? (
          <table>
            <tbody>
              {main.map((r) => (
                <tr key={r.origin}>
                  <td>
                    <Link
                      href={
                        "/explore/?origin=" +
                        r.origin +
                        "&destination=" +
                        iso +
                        "&year=" +
                        year
                      }
                    >
                      {getName(a, r.origin)}
                    </Link>
                  </td>
                  <td>{fmt(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No bilateral observations for {year}.</Empty>
        )}
        <h3>Leading reported disciplines</h3>
        {fields.length ? (
          <>
            <ul>
              {fields.map((r) => (
                <li key={r.field}>
                  {r.field} · {fmt(r.value)}
                </li>
              ))}
            </ul>
            <SourceNote s={src("eurostat-fields")} period={year} />
          </>
        ) : (
          <p className="sub">Discipline data unavailable for this selection.</p>
        )}
        {planning && (
          <div className="inline-links">
            <Link href={"/universities/?country=" + iso}>Universities</Link>
            <Link href={"/visa/?country=" + iso}>Visa information</Link>
          </div>
        )}
      </section>
    );
  }
  return (
    <>
      <div className="filters">
        <CountrySelect
          a={a}
          label="Country profile"
          value={sel}
          choices={places}
          onChange={(v) => {
            setSel(v);
            if (other === v) setOther("");
          }}
        />
        <CountrySelect
          a={a}
          label="Compare with"
          value={other}
          choices={places.filter((v) => v !== sel)}
          all="Select a second country"
          onChange={setOther}
        />
        <Select
          label="Compare in year"
          value={year}
          onChange={setYear}
          options={uniq(
            a.rows
              .filter((r) => r.dataset_id === "uis-mobility")
              .map((r) => r.period),
          ).reverse()}
        />
      </div>
      <div className={other ? "columns" : "profile-single"}>
        {profile(sel)}
        {other && profile(other)}
      </div>
      <section className="panel">
        <h2>Country directory</h2>
        <div className="filters">
          <SearchBox
            label="Find a country"
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
          />
          <Select
            label="Region"
            value={region}
            options={[
              ["", "All regions"],
              ...uniq(places.map((c) => a.places[c].region).filter(Boolean)),
            ]}
            onChange={(v) => {
              setRegion(v);
              setPage(1);
            }}
          />
        </div>
        <p className="sub">
          {visible.length} countries and territories with observations
        </p>
        <div className="country-list">
          {visible.slice((page - 1) * 24, page * 24).map((iso) => (
            <button
              key={iso}
              onClick={() => {
                setSel(iso);
                if (other === iso) setOther("");
                document.getElementById("main")?.scrollIntoView();
              }}
            >
              {flag(a.places[iso])} {getName(a, iso)}
            </button>
          ))}
        </div>
        {visible.length > 24 && (
          <div className="pager">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {Math.ceil(visible.length / 24)}
            </span>
            <button
              disabled={page * 24 >= visible.length}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </>
  );
}
export function Courses({ a }: { a: Atlas }) {
  const scope = a.rows.filter((r) => r.dataset_id === "eurostat-fields");
  const [field, setField] = useState(param("field", "Computer Science")),
    [dest, setDest] = useState("DEU"),
    [level, setLevel] = useState("All"),
    [year, setYear] = useState("2024");
  const source = a.sources.find((s) => s.id === "eurostat-fields");
  const filtered = scope.filter((r) => r.field === field && r.level === level);
  const history = filtered.filter((r) => r.destination === dest);
  const rank = filtered
    .filter((r) => r.period === year)
    .sort((a, b) => b.value - a.value);
  const current = history.find((r) => r.period === year);
  return (
    <>
      <div className="filters">
        <Select
          label="Discipline"
          value={field}
          options={disciplines}
          onChange={setField}
        />
        <CountrySelect
          a={a}
          label="Destination"
          value={dest}
          choices={uniq(scope.map((r) => r.destination))}
          onChange={setDest}
        />
        <Select
          label="Study level"
          value={level}
          options={uniq(scope.map((r) => r.level))}
          onChange={setLevel}
        />
        <Select
          label="Reference year"
          value={year}
          onChange={setYear}
          options={uniq(scope.map((r) => r.period)).reverse()}
        />
      </div>
      <div className="columns">
        <section className="panel">
          <span className="meta">
            {getName(a, dest)} · {year}
          </span>
          <h2>{field}</h2>
          <strong className="big-number">
            {current ? fmt(current.value) : "Unreported"}
          </strong>
          <p>
            Mobile students enrolled ·{" "}
            {level === "All" ? "All tertiary levels" : level}
          </p>
          <p className="sub">
            Published field: {source?.field_mapping?.[field]?.published}. This
            series combines all origins. An origin breakdown is unavailable.
          </p>
          <Chart rows={history} />
          <SourceNote s={source} />
        </section>
        <section className="panel">
          <h2>Compare destinations</h2>
          <p className="sub">
            Reporting destinations in the selected Eurostat series · {year}
          </p>
          {rank.length ? (
            <table>
              <thead>
                <tr>
                  <th>Destination</th>
                  <th>Enrolments</th>
                </tr>
              </thead>
              <tbody>
                {rank.map((r) => (
                  <tr key={r.destination}>
                    <td>
                      <button
                        className="inline-btn"
                        onClick={() => setDest(r.destination)}
                      >
                        {getName(a, r.destination)}
                      </button>
                    </td>
                    <td>{fmt(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No records for this combination.</Empty>
          )}
          <Link
            href={"/universities/?field=" + encodeURIComponent(field)}
            className="text-link"
          >
            Find university programs
          </Link>
        </section>
      </div>
    </>
  );
}
