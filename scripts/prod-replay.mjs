import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const sha = process.argv[2] || process.env.PLAYWRIGHT_PROD_SHA;

if (!sha) {
  console.error("Usage: node scripts/prod-replay.mjs <git-sha>");
  process.exit(1);
}

const repoRoot = process.cwd();
const targetDir = path.join(os.tmpdir(), `css-artist-prod-replay-${sha}`);

if (!fs.existsSync(targetDir)) {
  execFileSync("git", ["worktree", "add", "--detach", targetDir, sha], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

const commands = [
  `cd ${targetDir}`,
  "pnpm install",
  "DEBUG_LOGS=true WS_SERVICE_TOKEN=ws-service-secret ./dev.sh",
  "PLAYWRIGHT_SCENARIO=baseline PLAYWRIGHT_HEADED=false npm run pw:local-group",
  "PLAYWRIGHT_SCENARIO=classroom_churn PLAYWRIGHT_HEADED=false PLAYWRIGHT_USER_COUNT=12 PLAYWRIGHT_GROUP_SIZE=3 npm run pw:local-group",
  "PLAYWRIGHT_SCENARIO=submit_after_churn PLAYWRIGHT_HEADED=false PLAYWRIGHT_USER_COUNT=12 PLAYWRIGHT_GROUP_SIZE=3 npm run pw:local-group",
];

console.log("");
console.log(`Prod replay worktree ready: ${targetDir}`);
console.log("Run these commands there:");
for (const command of commands) {
  console.log(command);
}
