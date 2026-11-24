import { readFileSync } from "node:fs";
import type { Atlas, Obs } from "@/lib/data";
const file = JSON.parse(readFileSync("public/data/atlas.json", "utf8"));
export const atlas: Atlas = {
  ...file,
  rows: file.records.map(
    (r: (string | number)[]) =>
      Object.fromEntries(
        file.columns.map((k: string, i: number) => [k, r[i]]),
      ) as Obs,
  ),
};
