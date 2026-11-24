"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MessageSquare, Send, Download } from "lucide-react";
import { scaleSqrt } from "d3-scale";
import {
  Atlas,
  getName,
  fmt,
  param,
  uniq,
  latest,
  csv,
  download,
} from "@/lib/data";
import { answer, forecast, Answer } from "@/lib/analysis";
import { CountrySelect, Select, SourceNote, Official, Empty } from "./Forms";
export function Analyst({ a }: { a: Atlas }) {
  const [q, setQ] = useState(""),
    [history, setHistory] = useState<{ q: string; r: Answer }[]>([]);
  const prompts = [
    "Why are Indian students choosing Germany?",
    "Compare UK and Canada for postgraduate study.",
    "Which countries attract international computer science students?",
    "Which destinations have experienced increasing student inflows?",
  ];
  function ask(v: string) {
    if (!v.trim()) return;
    const r = answer(a, v.trim(), history.at(-1)?.r.context);
    setHistory((h) => [...h, { q: v.trim(), r }]);
    setQ("");
  }
  return (
    <div className="product-two analyst">
      <section className="panel">
        <div className="section-row">
          <h2>Education analyst</h2>
          {history.length > 0 && (
            <button className="inline-btn" onClick={() => setHistory([])}>
              New conversation
            </button>
          )}
        </div>
        <p className="sub">
          Rule-based analysis of the published atlas edition. Ask about a
          country, corridor, discipline or trend.
        </p>
        <div className="conversation" aria-live="polite">
          {history.map(({ q, r }, i) => (
            <article key={i}>
              <h3>{q}</h3>
              <p>{r.text}</p>
              {r.sources.map((id) => (
                <SourceNote key={id} s={a.sources.find((s) => s.id === id)} />
              ))}
            </article>
          ))}
        </div>
        <form
          className="ask-form"
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
        >
          <label className="form-field">
            <span>Your question</span>
            <textarea
              required
              maxLength={800}
              rows={3}
              placeholder="Ask about international student mobility…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <button className="button dark">
            <Send size={15} />
            Ask analyst
          </button>
        </form>
      </section>
      <aside className="panel prompts">
        <h2>Explore a question</h2>
        {prompts.map((p) => (
          <button key={p} onClick={() => ask(p)}>
            <MessageSquare size={15} />
            {p}
          </button>
        ))}
      </aside>
    </div>
  );
}
export function Forecast({ a }: { a: Atlas }) {
  const data = a.rows.filter(
    (r) => r.dataset_id === "uis-mobility" && r.measure === "inbound",
  );
  const [dest, setDest] = useState(param("country", "DEU")),
    [horizon, setHorizon] = useState("3");
  const result = forecast(
    data.filter((r) => r.destination === dest),
    Number(horizon),
  );
  return (
    <>
      <div className="filters">
        <CountrySelect
          a={a}
          label="Destination"
          value={dest}
          onChange={setDest}
          choices={uniq(data.map((r) => r.destination))}
        />
        <Select
          label="Forecast horizon"
          value={horizon}
          onChange={setHorizon}
          options={["1", "2", "3", "4", "5"].map((v) => [
            v,
            v + " year" + (v === "1" ? "" : "s"),
          ])}
        />
      </div>
      <section className="panel">
        <h2>{getName(a, dest)} inflow projection</h2>
        {result ? (
          <>
            <p className="sub">
              Ordinary least squares fitted to {result.n} consecutive annual
              observations, {result.start}–{result.end}. Estimated annual change{" "}
              {Math.round(result.slope).toLocaleString("en")} students.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Forecast year</th>
                  <th>Projected students</th>
                  <th>95% prediction interval</th>
                </tr>
              </thead>
              <tbody>
                {result.points.map((p) => (
                  <tr key={p.year}>
                    <td>{p.year}</td>
                    <td>{fmt(p.value)}</td>
                    <td>
                      {fmt(p.low)} – {fmt(p.high)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="sub">
              These are projections beyond the last observation. Intervals
              assume a linear trend and independent, normally distributed
              residuals. Policy and economic changes can move actual enrolments
              outside the interval. Negative model outputs are bounded at zero.
            </p>
          </>
        ) : (
          <Empty>
            The latest comparable run contains fewer than five consecutive
            years. A forecast is unavailable.
          </Empty>
        )}
        <SourceNote s={a.sources.find((s) => s.id === "uis-mobility")} />
      </section>
    </>
  );
}
export function Network({ a }: { a: Atlas }) {
  const series = a.rows.filter(
    (r) => r.dataset_id === "uis-mobility" && r.measure === "bilateral",
  );
  const [origin, setOrigin] = useState("IND"),
    [year, setYear] = useState("2024");
  const rows = series
    .filter((r) => r.origin === origin && r.period === year && r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const scale = scaleSqrt()
    .domain([0, Math.max(1, ...rows.map((r) => r.value))])
    .range([1, 13]);
  return (
    <>
      <div className="filters">
        <CountrySelect
          a={a}
          label="Origin"
          value={origin}
          onChange={setOrigin}
          choices={uniq(series.map((r) => r.origin))}
        />
        <Select
          label="Year"
          value={year}
          onChange={setYear}
          options={uniq(series.map((r) => r.period)).reverse()}
        />
      </div>
      <section className="panel">
        <h2>Largest observed corridors</h2>
        <p className="sub">
          Up to eight destinations from {getName(a, origin)} · {year}. Line
          width scales with the square root of enrolments. Select a destination
          to open the route.
        </p>
        {rows.length ? (
          <div className="network-content">
            <svg viewBox="0 0 600 355" aria-label="Student mobility network">
              {rows.map((r, i) => {
                const ang = (i / rows.length) * Math.PI * 2 - Math.PI / 2,
                  x = 300 + Math.cos(ang) * 193,
                  y = 175 + Math.sin(ang) * 127;
                return (
                  <a
                    key={r.destination}
                    href={
                      "/explore/?origin=" +
                      origin +
                      "&destination=" +
                      r.destination +
                      "&year=" +
                      year
                    }
                    aria-label={getName(a, r.destination) + " " + fmt(r.value)}
                  >
                    <line
                      x1="300"
                      y1="175"
                      x2={x}
                      y2={y}
                      stroke="#bd8059"
                      strokeWidth={scale(r.value)}
                      opacity=".62"
                    />
                    <circle cx={x} cy={y} r="14" fill="#324139" />
                    <text x={x} y={y + 28} textAnchor="middle">
                      {r.destination}
                    </text>
                  </a>
                );
              })}
              <circle cx="300" cy="175" r="26" fill="#a35134" />
              <text x="300" y="180" fill="white" textAnchor="middle">
                {origin}
              </text>
            </svg>
            <table>
              <thead>
                <tr>
                  <th>Destination</th>
                  <th>Enrolments</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.destination}>
                    <td>
                      <Link
                        href={
                          "/explore/?origin=" +
                          origin +
                          "&destination=" +
                          r.destination +
                          "&year=" +
                          year
                        }
                      >
                        {getName(a, r.destination)}
                      </Link>
                    </td>
                    <td>{fmt(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No positive corridor counts for this selection.</Empty>
        )}
        <SourceNote
          s={a.sources.find((s) => s.id === "uis-mobility")}
          period={year}
        />
      </section>
    </>
  );
}
export function Reports({ a }: { a: Atlas }) {
  const [ds, setDs] = useState(param("dataset", "uis-mobility")),
    [year, setYear] = useState(""),
    [measure, setMeasure] = useState(""),
    [page, setPage] = useState(0);
  const s = a.sources.find((s) => s.id === ds) || a.sources[0],
    series = a.rows.filter((r) => r.dataset_id === s.id),
    rows = series.filter(
      (r) =>
        (!year || r.period === year) && (!measure || r.measure === measure),
    );
  const keys = [
    "dataset_id",
    "origin",
    "destination",
    "period",
    "measure",
    "level",
    "field",
    "value",
  ] as const;
  function exportRows() {
    download(
      "beyond-borders-" + s.id + ".csv",
      csv([
        [...keys, "publisher", "source_url", "retrieved", "series_definition"],
        ...rows.map((r) => [
          ...keys.map((k) => r[k]),
          s.publisher,
          s.url,
          s.retrieved,
          s.definition,
        ]),
      ]),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <>
      <div className="filters">
        <Select
          label="Dataset"
          value={s.id}
          options={a.sources.map((s) => [s.id, s.name])}
          onChange={(v) => {
            setDs(v);
            setYear("");
            setMeasure("");
            setPage(0);
          }}
        />
        <Select
          label="Period"
          value={year}
          options={[
            ["", "All years"],
            ...uniq(series.map((r) => r.period)).reverse(),
          ]}
          onChange={(v) => {
            setYear(v);
            setPage(0);
          }}
        />
        <Select
          label="Measure"
          value={measure}
          options={[
            ["", "All measures"],
            ...uniq(series.map((r) => r.measure)),
          ]}
          onChange={(v) => {
            setMeasure(v);
            setPage(0);
          }}
        />
      </div>
      <section className="panel">
        <span className="meta">
          {s.classification || "Published dataset"} · {s.publisher}
        </span>
        <h2>{s.name}</h2>
        <p>{s.definition}</p>
        <dl className="data-dl">
          {[
            ["Reference period", s.period],
            ["Retrieved", s.retrieved],
            ["Coverage", s.coverage],
            ["Dimensions", s.dimensions.join(", ")],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <Official href={s.url}>Original dataset</Official>
      </section>
      <section className="panel">
        <div className="section-row">
          <h2>Observations</h2>
          <button
            className="button small"
            disabled={!rows.length}
            onClick={exportRows}
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
        <p className="sub">{fmt(rows.length)} matching records</p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Origin",
                  "Destination",
                  "Period",
                  "Measure",
                  "Level",
                  "Discipline",
                  "Students",
                ].map((t) => (
                  <th key={t}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(page * 20, (page + 1) * 20).map((r, i) => (
                <tr key={i}>
                  <td>{getName(a, r.origin)}</td>
                  <td>{getName(a, r.destination)}</td>
                  <td>{r.period}</td>
                  <td>{r.measure}</td>
                  <td>{r.level}</td>
                  <td>{r.field}</td>
                  <td>{fmt(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <button disabled={!page} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            {rows.length
              ? "Page " + (page + 1) + " of " + Math.ceil(rows.length / 20)
              : "No matching records"}
          </span>
          <button
            disabled={(page + 1) * 20 >= rows.length}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </section>
      <section className="panel">
        <h2>Atlas files and credits</h2>
        <div className="inline-links">
          <a href="/downloads/beyond-borders.zip" download>
            Download platform and source
          </a>
          <a href="/geo/credits.txt">Map and terrain credits</a>
          <a href="/photos/credits.txt">Destination photography</a>
        </div>
      </section>
    </>
  );
}
