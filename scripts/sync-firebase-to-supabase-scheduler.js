/*
 * Interval-based sync scheduler for local/server execution.
 *
 * Env:
 *   SYNC_INTERVAL_MINUTES=120
 *   SYNC_COLLECTIONS=tasks,reports,survey-existing,survey-apj-propose,survey-pra-existing,user-admin
 */

const path = require("path");
const { spawn } = require("child_process");

const intervalMinutes = Math.max(1, parseInt(process.env.SYNC_INTERVAL_MINUTES || "120", 10));
const runnerPath = path.resolve(__dirname, "sync-firebase-to-supabase-once.js");

let running = false;

function runOnce() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runnerPath], {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Scheduled sync run failed with exit code ${code}.`));
    });
  });
}

async function tick() {
  if (running) {
    console.warn("Previous sync still running, skipping this interval.");
    return;
  }

  running = true;
  const startedAt = new Date().toISOString();
  console.log(`\n[${startedAt}] Scheduled sync started`);

  try {
    await runOnce();
    console.log(`[${new Date().toISOString()}] Scheduled sync finished`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Scheduled sync failed:`, error);
  } finally {
    running = false;
  }
}

console.log(`Supabase sync scheduler started. Interval: ${intervalMinutes} minute(s).`);
void tick();
setInterval(() => {
  void tick();
}, intervalMinutes * 60 * 1000);
