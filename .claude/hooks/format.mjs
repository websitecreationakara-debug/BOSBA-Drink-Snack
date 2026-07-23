import { execSync } from "node:child_process";

let data = "";
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(data || "{}");
    const f = j.tool_response?.filePath || j.tool_input?.file_path;
    if (!f) return;
    execSync(`npx prettier --write --ignore-unknown "${f}"`, { stdio: "ignore" });
  } catch {}
});
