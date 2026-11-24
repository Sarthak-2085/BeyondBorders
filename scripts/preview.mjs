import { spawn } from "node:child_process";
const args = process.argv
  .slice(2)
  .filter((v) => v !== "--strictPort")
  .map((v) => (v === "--host" ? "--hostname" : v));
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--webpack", ...args],
  { stdio: "inherit" },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
