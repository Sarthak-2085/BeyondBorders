"use client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { fmt, Obs } from "@/lib/data";
export default function TrendChart({
  rows,
  label = "Students",
}: {
  rows: Obs[];
  label?: string;
}) {
  if (!rows.length) return null;
  const ordered = rows.slice().sort((a, b) => a.period.localeCompare(b.period));
  const allYears = ordered.every((r) => /^\d{4}$/.test(r.period));
  const points = allYears
    ? Array.from(
        {
          length:
            Number(ordered.at(-1)!.period) - Number(ordered[0].period) + 1,
        },
        (_, i) => {
          const period = String(i + Number(ordered[0].period));
          return {
            period,
            value: ordered.find((r) => r.period === period)?.value ?? null,
          };
        },
      )
    : ordered;
  return (
    <figure className="chart">
      <ResponsiveContainer width="100%" height={220} minWidth={0}>
        <AreaChart
          data={points}
          margin={{ top: 10, left: 0, right: 14, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="#c6beaf"
            strokeDasharray="2 5"
          />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: "#666053" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) =>
              Intl.NumberFormat("en", { notation: "compact" }).format(v)
            }
            tick={{ fontSize: 11, fill: "#666053" }}
            tickLine={false}
            axisLine={false}
            width={47}
          />
          <Tooltip
            formatter={(v) => [fmt(Number(v)), label]}
            contentStyle={{
              background: "#fbf5e9",
              border: "1px solid #a39882",
              fontSize: 13,
            }}
          />
          <Area
            type="linear"
            dataKey="value"
            stroke="#a75031"
            fill="#c66a4324"
            strokeWidth={2}
            dot={{ r: 3, fill: "#a75031" }}
            isAnimationActive={false}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <details>
        <summary>View chart values</summary>
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>{label}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((r) => (
              <tr key={r.period}>
                <td>{r.period}</td>
                <td>{r.value == null ? "Unreported" : fmt(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
