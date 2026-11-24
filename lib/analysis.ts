import type { Atlas, Obs } from "./data";
export function forecast(rows: Obs[], horizon: number) {
  const history = rows
    .filter((r) => /^\d{4}$/.test(r.period))
    .slice()
    .sort((a, b) => a.period.localeCompare(b.period));
  let start = history.length - 1;
  while (
    start > 0 &&
    Number(history[start].period) - Number(history[start - 1].period) === 1
  )
    start--;
  const recent = history.slice(Math.max(start, history.length - 10));
  if (recent.length < 5) return null;
  const n = recent.length,
    xbar = (n - 1) / 2,
    ybar = recent.reduce((sum, r) => sum + r.value, 0) / n;
  const xx = recent.reduce((sum, _, i) => sum + (i - xbar) ** 2, 0);
  const slope =
    recent.reduce((sum, r, i) => sum + (i - xbar) * (r.value - ybar), 0) / xx;
  const intercept = ybar - slope * xbar;
  const sse = recent.reduce(
    (sum, r, i) => sum + (r.value - intercept - slope * i) ** 2,
    0,
  );
  const stderr = Math.sqrt(sse / (n - 2));
  const t = [0, 0, 0, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306][n - 2];
  return {
    start: recent[0].period,
    end: recent[n - 1].period,
    n,
    slope,
    points: Array.from({ length: horizon }, (_, j) => {
      const x = n + j,
        estimate = intercept + slope * x,
        margin = t * stderr * Math.sqrt(1 + 1 / n + (x - xbar) ** 2 / xx);
      return {
        year: Number(recent[0].period) + x,
        value: Math.max(0, Math.round(estimate)),
        low: Math.max(0, Math.round(estimate - margin)),
        high: Math.max(0, Math.round(estimate + margin)),
      };
    }),
  };
}
export type Answer = { text: string; sources: string[]; context: string[] };
const nf = (n: number) => n.toLocaleString("en-US");
export function answer(
  a: Atlas,
  question: string,
  prior: string[] = [],
): Answer {
  const q = question.toLowerCase();
  const aliases: Record<string, string[]> = {
    IND: ["indian", "india"],
    DEU: ["german", "germany"],
    USA: ["united states", "united states of america", "usa", "us", "u.s."],
    GBR: ["united kingdom", "uk", "u.k.", "britain", "british"],
    CAN: ["canada", "canadian"],
    CHN: ["china", "chinese"],
    AUS: ["australia", "australian"],
  };
  const terms = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mentions = Object.entries(a.places)
    .filter(([c]) => c !== "WLD")
    .map(([c, p]) => ({
      c,
      i: Math.min(
        ...[p.name.toLowerCase(), ...(aliases[c] || [])].map((w) => {
          const m = q.search(new RegExp("\\b" + terms(w) + "\\b"));
          return m < 0 ? Infinity : m;
        }),
      ),
    }))
    .filter((x) => Number.isFinite(x.i))
    .sort((x, y) => x.i - y.i)
    .map((x) => x.c);
  const continuation =
    /^(and\b|what about\b|how about\b|in (19|20)\d{2}\b|that (country|corridor)|there\b)/.test(
      q,
    );
  const context = mentions.length ? mentions : continuation ? prior : [];
  const name = (c: string) => a.places[c]?.name || c;
  const ans = (text: string, sources: string[]): Answer => ({
    text,
    sources,
    context,
  });
  const requested = q.match(/\b(?:19|20)\d{2}\b/)?.[0];
  const fieldTerms: Record<string, string[]> = {
    "Computer Science": ["computer science", "computing", "ict"],
    "Business and Management": ["business", "management"],
    Engineering: ["engineering"],
    "Medicine and Healthcare": ["medicine", "healthcare", "health"],
    "Social Sciences": ["social science"],
    "Arts and Humanities": ["arts", "humanities"],
    "Natural Sciences": ["natural science"],
    Law: ["law"],
  };
  const field = Object.entries(fieldTerms).find(([, terms]) =>
    terms.some((t) => q.includes(t)),
  )?.[0];
  const level = /postgraduate|master/.test(q)
    ? "Master's"
    : /undergraduate|bachelor/.test(q)
      ? "Bachelor's"
      : /doctoral|doctorate|phd/.test(q)
        ? "Doctorate"
        : "All";
  if (field && /from |indian students|chinese students/.test(q)) {
    return ans(
      "Eurostat reports this discipline by destination and degree level with all origins combined. An origin-by-discipline count is unavailable in this edition.",
      ["eurostat-fields"],
    );
  }
  if (field) {
    const rows = a.rows.filter(
      (r) =>
        r.dataset_id === "eurostat-fields" &&
        r.level === level &&
        r.field === field,
    );
    const year =
      requested || rows.reduce((y, r) => (r.period > y ? r.period : y), "");
    const hits = rows
      .filter(
        (r) =>
          r.period === year &&
          (!context.length || context.includes(r.destination)),
      )
      .sort((x, y) => y.value - x.value);
    return ans(
      hits.length
        ? `In ${year}, Eurostat reported the following mobile enrolments in ${field} (${level === "All" ? "all tertiary levels" : level}): ${hits
            .slice(0, 4)
            .map((r) => name(r.destination) + " " + nf(r.value))
            .join(
              ", ",
            )}. The collection covers selected European destinations and combines all origin countries.`
        : `There is no published ${field} observation for that selection. The field series covers selected European destinations and combines all origins.`,
      ["eurostat-fields"],
    );
  }
  const aggregate = a.rows.filter(
    (r) => r.dataset_id === "uis-mobility" && r.measure === "inbound",
  );
  const ref =
    requested || aggregate.reduce((y, r) => (r.period > y ? r.period : y), "");
  if (/compar|versus|\bvs\b/.test(q) && context.length >= 2) {
    const selected = context.slice(0, 2);
    const years = selected.map((code) =>
      aggregate.filter((r) => r.destination === code).map((r) => r.period),
    );
    const year =
      requested ||
      years[0]
        .filter((y) => years[1].includes(y))
        .sort()
        .at(-1);
    if (!year)
      return ans(
        "These countries have no common reference year in the selected series.",
        ["uis-mobility"],
      );
    const details = selected.map((c) => {
      const r = aggregate.find((r) => r.destination === c && r.period === year);
      return (
        name(c) +
        (r
          ? " hosted " + nf(r.value) + " mobile students"
          : " has no inbound observation")
      );
    });
    return ans(
      `${year}: ${details.join(". ")}. The UIS comparison covers all tertiary levels.${level !== "All" ? " A comparable degree-specific count is unavailable in this series." : ""} Tuition, work permission and admissions depend on the program and destination.`,
      ["uis-mobility"],
    );
  }
  if (context.length >= 2) {
    const [o, d] = context;
    const history = a.rows
      .filter(
        (r) =>
          r.dataset_id === "uis-mobility" &&
          r.measure === "bilateral" &&
          r.origin === o &&
          r.destination === d,
      )
      .sort((x, y) => x.period.localeCompare(y.period));
    const r = requested
      ? history.find((r) => r.period === requested)
      : history.at(-1);
    if (!r)
      return ans(
        `No published ${name(o)} to ${name(d)} count is available${requested ? " for " + requested : ""} in this edition.`,
        ["uis-mobility"],
      );
    const first = history.find((x) => x.period < r.period);
    return ans(
      `UIS counted ${nf(r.value)} tertiary students from ${name(o)} studying in ${name(d)} in ${r.period}.${first ? " The series reports " + nf(first.value) + " in " + first.period + "." : ""}${/why|choos|reason/.test(q) ? " Enrolment counts show movement. The source does not survey students’ motivations." : ""}`,
      ["uis-mobility"],
    );
  }
  if (/increas|grow|trend|rising/.test(q) && !context.length) {
    const pairs = aggregate
      .filter((r) => r.period === ref)
      .map((r) => ({
        r,
        p: aggregate.find(
          (p) =>
            p.destination === r.destination &&
            Number(p.period) === Number(ref) - 1,
        ),
      }))
      .filter((x) => x.p && x.r.value > x.p.value)
      .sort((a, b) => b.r.value - b.p!.value - (a.r.value - a.p!.value));
    return ans(
      pairs.length
        ? `Largest reported absolute gains between ${Number(ref) - 1} and ${ref} in this edition: ${pairs
            .slice(0, 4)
            .map(
              (x) => name(x.r.destination) + " +" + nf(x.r.value - x.p!.value),
            )
            .join(
              ", ",
            )}. Only destinations reporting in both years are compared.`
        : "There are no comparable increases for the requested period.",
      ["uis-mobility"],
    );
  }
  if (/weather|salary|guarantee|acceptance rate|admission chance/.test(q))
    return ans(
      "The atlas does not contain that measure. Available records describe enrolments, study programs and published planning guidance.",
      [],
    );
  if (context.length === 1) {
    const c = context[0],
      out = /outbound|abroad|leav/.test(q);
    const rows = (
      out
        ? a.rows.filter(
            (r) =>
              r.dataset_id === "uis-outbound" &&
              r.origin === c &&
              r.measure === "outbound",
          )
        : aggregate.filter((r) => r.destination === c)
    )
      .filter((r) => !requested || r.period === requested)
      .sort((x, y) => y.period.localeCompare(x.period));
    const r = rows[0];
    return ans(
      r
        ? `${name(c)} ${out ? "had an estimated " + nf(r.value) + " tertiary students studying abroad" : "hosted " + nf(r.value) + " internationally mobile tertiary students"} in ${r.period}.${rows[1] ? " The previous available observation was " + nf(rows[1].value) + " in " + rows[1].period + "." : ""}${level !== "All" ? " This measure combines all tertiary levels." : ""}`
        : "No published observation matches this country and period.",
      [out ? "uis-outbound" : "uis-mobility"],
    );
  }
  if (/world|global|total|how many/.test(q)) {
    const r = a.rows
      .filter(
        (r) =>
          r.measure === "global" &&
          r.dataset_id === "uis-mobility" &&
          (!requested || r.period === requested),
      )
      .at(-1);
    return ans(
      r
        ? `UIS reports ${nf(r.value)} internationally mobile tertiary students worldwide in ${r.period}. This is the publisher’s global total.`
        : "No global count is available for that year.",
      ["uis-mobility"],
    );
  }
  return ans(
    "I can retrieve published country totals, compare two destinations, trace a student corridor, rank available disciplines, or compare growth over adjacent years. Include a country or discipline and a reference year if you have one.",
    [],
  );
}
