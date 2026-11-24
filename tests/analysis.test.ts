import { describe, test, expect } from "vitest";
import { atlas as a } from "./fixture";
import { answer, forecast } from "@/lib/analysis";
import { normalizeCSV, mergeEdition } from "@/lib/imports";
import { csv } from "@/lib/data";
const source = {
  id: "user-test",
  publisher: "Test fixture",
  name: "Test",
  url: "https://example.org/source",
  period: "2023/24",
  retrieved: "2026-11-22",
  dimensions: ["origin", "destination"],
  coverage: "Test only",
  definition: "Unit-test fixture",
  classification: "DEMO DATA",
};
const header = "origin,destination,period,measure,level,field,value\n";
test("published edition keeps global totals, country inflow and disaggregations distinct", () => {
  expect(a.rows).toHaveLength(13713);
  expect(
    a.rows.find((r) => r.measure === "global" && r.period === "2024")?.value,
  ).toBe(7980289);
  expect(
    a.rows.filter(
      (r) =>
        r.dataset_id === "uis-mobility" &&
        r.measure === "inbound" &&
        r.period === "2024",
    ),
  ).toHaveLength(94);
  expect(
    a.rows.filter(
      (r) =>
        r.measure === "bilateral" &&
        r.origin === "IND" &&
        r.destination === "USA" &&
        r.period === "2024",
    ),
  ).toHaveLength(0);
});
test("analyst answers four example intents with source-backed values", () => {
  expect(answer(a, "Why are Indian students choosing Germany?").text).toContain(
    "49,243",
  );
  expect(
    answer(a, "Compare UK and Canada for postgraduate study.").text,
  ).toContain("degree-specific count is unavailable");
  expect(
    answer(
      a,
      "Which countries attract international computer science students?",
    ).sources,
  ).toEqual(["eurostat-fields"]);
  expect(
    answer(a, "Which destinations have experienced increasing student inflows?")
      .text,
  ).toContain("Largest reported absolute gains");
  expect(answer(a, "How many worldwide in 2024?").text).toContain("7,980,289");
  expect(answer(a, "India to United States in 2024").text).toContain(
    "No published",
  );
  expect(answer(a, "And in 2019?", ["IND", "DEU"]).text).toContain("2019");
  expect(answer(a, "What is the weather?").sources).toEqual([]);
});
test("forecast uses consecutive observations and explicit future periods", () => {
  const r = a.rows.filter(
    (r) =>
      r.dataset_id === "uis-mobility" &&
      r.measure === "inbound" &&
      r.destination === "DEU",
  );
  const f = forecast(r, 3)!;
  expect(f.points[0].year).toBe(Number(f.end) + 1);
  expect(f.points).toHaveLength(3);
  expect(f.points.every((p) => p.low <= p.value && p.value <= p.high)).toBe(
    true,
  );
  expect(forecast(r.slice(-3), 4)).toBe(null);
});
test("CSV validation normalizes codes, academic periods, categories and missing counts", () => {
  const result = normalizeCSV(
    a,
    header +
      "IN,uk,2023/24,bilateral,master,ict,25\nIND,GBR,2023-2024,bilateral,Master,Computer Science,25\nIN,DE,2023,bilateral,All,All,:",
    source,
  );
  expect(result.rows).toHaveLength(1);
  expect(result.duplicates).toBe(1);
  expect(result.missing).toBe(1);
  expect(result.rows[0]).toMatchObject({
    origin: "IND",
    destination: "GBR",
    level: "Master's",
    field: "Computer Science",
    period: "2023/2024",
  });
  const first = mergeEdition([], source, result.rows);
  expect(mergeEdition(first.editions, source, result.rows).added).toBe(0);
  expect(() =>
    mergeEdition(first.editions, source, [{ ...result.rows[0], value: 30 }]),
  ).toThrow("differs");
  expect(() =>
    normalizeCSV(a, header + "IND,DEU,2023/25,bilateral,All,All,0", source),
  ).toThrow();
  expect(() =>
    normalizeCSV(a, header + "WLD,GBR,2023,bilateral,All,All,5", source),
  ).toThrow();
  expect(csv([["=formula", "hello,there"]])).toContain("'=formula");
});
