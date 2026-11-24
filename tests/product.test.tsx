import { expect, test, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import { atlas as a } from "./fixture";
import { Countries, Courses, Explore } from "@/components/Mobility";
import {
  Universities,
  Scholarships,
  Shortlist,
  Visa,
} from "@/components/Education";
import { Planner, Costs } from "@/components/Planner";
import { Analyst, Forecast, Network, Reports } from "@/components/Intelligence";
import ImportData from "@/components/ImportData";
import { Globe2 } from "lucide-react";
vi.mock("next/dynamic", () => ({ default: () => () => null }));
const select = (label: string, v: string) =>
  fireEvent.change(screen.getByLabelText(label, { exact: true }), {
    target: { value: v },
  });
const click = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
test("corridor controls reflect dated and missing records", () => {
  render(<Explore a={a} />);
  expect(screen.getByText("164,378")).toBeTruthy();
  select("Destination", "USA");
  expect(screen.getByText("223,117")).toBeTruthy();
  select("Reference period", "2024");
  expect(
    screen.getByText("No published count for this selection."),
  ).toBeTruthy();
  select("Origin", "CHN");
  expect(screen.getByText("Corridor history")).toBeTruthy();
});
test("country comparison, directory search, paging and shortlist", () => {
  render(<Countries a={a} />);
  select("Compare with", "GBR");
  select("Compare in year", "2023");
  expect(screen.getAllByText("Historical inflow")).toHaveLength(2);
  fireEvent.click(
    screen.getAllByRole("button", { name: "Save" })[0],
  );
  expect(localStorage.getItem("bb.shortlist")).toContain("Germany");
  click("Next");
  click("Previous");
  select("Find a country", "Germany");
  expect(
    screen.getByText("1 countries and territories with observations"),
  ).toBeTruthy();
  select("Region", "Asia");
  expect(
    screen.getByText("0 countries and territories with observations"),
  ).toBeTruthy();
});
test("course filters and destination comparison", () => {
  render(<Courses a={a} />);
  select("Study level", "Master's");
  select("Discipline", "Engineering");
  select("Reference year", "2023");
  select("Destination", "FRA");
  expect(screen.getByText("Compare destinations")).toBeTruthy();
  const b = screen.getAllByRole("button")[0];
  fireEvent.click(b);
  expect(screen.getByText(/Published field:/)).toBeTruthy();
});
test("university search, program intersection and side-by-side comparison", () => {
  render(<Universities a={a} />);
  select("Destination", "DEU");
  select("Degree", "Master");
  select("Discipline", "Computer Science");
  select("Search universities or programs", "TUM");
  click("View");
  select("Compare with", "heidelberg");
  expect(screen.getAllByText("International admissions")).toHaveLength(2);
  fireEvent.click(
    screen.getAllByRole("button", { name: "Save" })[0],
  );
  expect(localStorage.getItem("bb.shortlist")).toContain("tum");
  select("Search universities or programs", "unknown institution");
  expect(
    screen.getByText("No listed programs match these filters."),
  ).toBeTruthy();
});
test("planner uses all inputs and persists a reproducible match", () => {
  render(<Planner a={a} />);
  select("Annual budget", "5500000");
  select("Budget currency", "INR");
  select("Intended start month", "2027-09");
  select("Home country", "IND");
  fireEvent.click(screen.getByLabelText("Germany"));
  click("Find destinations");
  expect(screen.getByText("Your destination matches")).toBeTruthy();
  expect(screen.getByText(/Intended start · 2027-09/)).toBeTruthy();
  expect(localStorage.getItem("bb.plan")).toContain("DEU");
});
test("cost calculator keeps absent line items visible and recalculates FX", () => {
  render(<Costs a={a} />);
  select("Destination scenario", "USA");
  expect(screen.getByText("Known-cost subtotal")).toBeTruthy();
  select("Transport · USD", "1200");
  select("Insurance · USD", "500");
  expect(screen.getByText("Estimated total")).toBeTruthy();
  select("Display currency", "USD");
  expect(screen.getByText("$94,460")).toBeTruthy();
  click("Reset published inputs");
  expect(screen.getByText("Known-cost subtotal")).toBeTruthy();
});
test("scholarship eligibility, amount and date filters", () => {
  render(<Scholarships a={a} />);
  select("Destination", "CAN");
  select("Degree", "Bachelor");
  select("Nationality", "IND");
  select("Discipline", "Engineering");
  select("Search awards", "Entrance");
  select("Published award ceiling ≥ INR", "10000");
  select("Deadline on or before", "2027-02-01");
  expect(
    screen.getByText("UBC International Major Entrance Scholarship"),
  ).toBeTruthy();
  select("Deadline status", "undated");
  expect(
    screen.getByText("No awards match all selected criteria."),
  ).toBeTruthy();
});
test("visa, source links and shortlist removal", () => {
  const view = render(<Visa a={a} />);
  select("Study destination", "AUS");
  expect(screen.getByText(/Student visa, subclass 500/i)).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Government guidance" })
      .getAttribute("href"),
  ).toBe(a.planning.countries.find((c) => c.iso === "AUS")!.visa.url);
  view.unmount();
  localStorage.setItem(
    "bb.shortlist",
    JSON.stringify([
      {
        id: "DEU",
        kind: "country",
        name: "Germany",
        href: "/countries/?country=DEU",
      },
    ]),
  );
  render(<Shortlist />);
  click("Remove");
  expect(screen.getByText(/Your shortlist is empty/)).toBeTruthy();
});
test("analyst conversation, examples and clear", () => {
  render(<Analyst a={a} />);
  click("Why are Indian students choosing Germany?");
  expect(screen.getByText(/UIS counted 49,243/)).toBeTruthy();
  select("Your question", "And in 2019?");
  click("Ask analyst");
  expect(screen.getByText(/studying in Germany in 2019/)).toBeTruthy();
  click("New conversation");
  expect(screen.queryByRole("button", { name: "New conversation" })).toBeNull();
});
test("forecast and network controls", () => {
  const v = render(<Forecast a={a} />);
  select("Forecast horizon", "5");
  expect(screen.getAllByRole("row")).toHaveLength(6);
  select("Destination", "CAN");
  v.unmount();
  render(<Network a={a} />);
  select("Origin", "CHN");
  select("Year", "2023");
  expect(
    screen
      .getAllByRole("link")
      .some((el) => el.getAttribute("href")?.includes("origin=CHN")),
  ).toBe(true);
});
test("source filters, pagination and CSV export", () => {
  const create = vi.fn(() => "blob:test");
  URL.createObjectURL = create;
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<Reports a={a} />);
  select("Dataset", "eurostat-fields");
  select("Period", "2023");
  select("Measure", "inbound");
  click("Next");
  click("Previous");
  click("Export CSV");
  expect(create).toHaveBeenCalledOnce();
  expect(screen.getByText("Eurostat", { exact: false })).toBeTruthy();
});
test("CSV import validates and commits a separately labelled edition", async () => {
  render(<ImportData a={a} />);
  Object.entries({
    "Edition ID": "qa",
    Publisher: "Test",
    "Dataset name": "Quality check",
    "Source URL": "https://example.org/test",
    "Reference period": "2024",
    "Geographic coverage": "DEU",
    "Measure definition": "Fixture",
    Classification: "DEMO DATA",
    "CSV contents":
      "origin,destination,period,measure,level,field,value\nIN,DE,2024,bilateral,All,All,20",
  }).forEach(([k, v]) => select(k, v));
  click("Validate CSV");
  await screen.findByText("Validation complete");
  expect(localStorage.getItem("bb.editions")).toBeNull();
  click("Confirm import");
  await screen.findByText("1 new observations saved.");
  expect(
    JSON.parse(localStorage.getItem("bb.editions")!)[0].source.classification,
  ).toBe("DEMO DATA");
});
