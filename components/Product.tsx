"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Globe2 } from "lucide-react";
import { useAtlas, refreshAtlas } from "@/lib/data";
import { pages } from "@/lib/pages";
import { Explore, Countries, Courses } from "./Mobility";
import { Universities, Scholarships, Visa, Shortlist } from "./Education";
import { Costs, Planner } from "./Planner";
const Analyst = dynamic(() => import("./Intelligence").then((m) => m.Analyst));
const Forecast = dynamic(() =>
  import("./Intelligence").then((m) => m.Forecast),
);
const Network = dynamic(() => import("./Intelligence").then((m) => m.Network));
const Reports = dynamic(() => import("./Intelligence").then((m) => m.Reports));
const ImportData = dynamic(() => import("./ImportData"));
const modules = {
  explore: Explore,
  countries: Countries,
  courses: Courses,
  universities: Universities,
  planner: Planner,
  costs: Costs,
  scholarships: Scholarships,
  visa: Visa,
  shortlist: Shortlist,
  intelligence: Analyst,
  forecast: Forecast,
  network: Network,
  reports: Reports,
  import: ImportData,
};
const groups = [
  ["explore", "network", "countries", "courses"],
  ["universities", "courses", "scholarships"],
  ["planner", "costs", "visa", "shortlist"],
  ["intelligence", "forecast", "network", "reports"],
  ["reports", "import"],
];
const names: Record<string, string> = {
  explore: "Mobility map",
  network: "Corridor network",
  countries: "Country profiles",
  courses: "Disciplines",
  universities: "Universities",
  scholarships: "Scholarships",
  planner: "Destination matching",
  costs: "Cost calculator",
  visa: "Visa guides",
  shortlist: "Shortlist",
  intelligence: "Analyst",
  forecast: "Forecasts",
  reports: "Sources & reports",
  import: "CSV import",
};
export default function Product({ section }: { section: string }) {
  const { data, error } = useAtlas();
  const reduce = useReducedMotion();
  const [k, h, p] = pages[section];
  const group =
    section === "reports"
      ? ["reports", "import", "intelligence"]
      : section === "network"
        ? ["explore", "network", "forecast", "intelligence"]
        : section === "courses"
          ? ["universities", "courses", "scholarships"]
          : groups.find((g) => g.includes(section)) || groups[0];
  const Module = modules[section as keyof typeof modules];
  return (
    <main id="main" className="product">
      <header className="product-head">
        <div className="eyebrow">
          <i />
          {k}
        </div>
        <h1>
          {h}
          <em>.</em>
        </h1>
        <p>{p}</p>
        <div className="product-emblem" aria-hidden="true">
          <Globe2 />
        </div>
      </header>
      <nav className="tabs" aria-label="Related atlas tools">
        {group.map((m) => (
          <Link
            key={m}
            className={section === m ? "active" : ""}
            href={"/" + m + "/"}
            aria-current={section === m ? "page" : undefined}
          >
            {names[m]}
          </Link>
        ))}
      </nav>
      <motion.div
        className="product-body"
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0 : 0.2 }}
      >
        {error ? (
          <div className="empty" role="alert">
            {error}{" "}
            <button className="inline-btn" onClick={refreshAtlas}>
              Retry
            </button>
          </div>
        ) : data ? (
          <Module a={data} />
        ) : (
          <p className="loading" role="status">
            Loading the atlas edition…
          </p>
        )}
      </motion.div>
    </main>
  );
}
