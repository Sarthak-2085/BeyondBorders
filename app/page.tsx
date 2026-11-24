import { existsSync, readFileSync } from "node:fs";
import Landing from "@/components/Landing";
export default function Home() {
  const file = "public/data/summary.json";
  return (
    <Landing
      data={existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null}
    />
  );
}
