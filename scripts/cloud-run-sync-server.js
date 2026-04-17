const http = require("http");
const { runSyncOnce, getCollections, getSyncMode } = require("./sync-firebase-to-supabase-once");

const port = Math.max(1, parseInt(process.env.PORT || "8080", 10));
const syncToken = process.env.SYNC_ENDPOINT_TOKEN || "";
let running = false;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function isAuthorized(request) {
  if (!syncToken) return true;
  const syncHeader = request.headers["x-sync-token"] || "";
  if (typeof syncHeader === "string" && syncHeader === syncToken) {
    return true;
  }

  const authHeader = request.headers.authorization || "";
  return authHeader === `Bearer ${syncToken}`;
}

const server = http.createServer(async (request, response) => {
  if (request.url === "/healthz" && request.method === "GET") {
    sendJson(response, 200, { ok: true, running });
    return;
  }

  if (request.url !== "/sync") {
    sendJson(response, 404, { ok: false, error: "Not found" });
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  if (!isAuthorized(request)) {
    sendJson(response, 401, { ok: false, error: "Unauthorized" });
    return;
  }

  if (running) {
    sendJson(response, 409, { ok: false, error: "Sync already running" });
    return;
  }

  running = true;
  const startedAt = new Date().toISOString();

  try {
    await runSyncOnce(getCollections());
    sendJson(response, 200, {
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      mode: getSyncMode(),
    });
  } catch (error) {
    console.error("Cloud Run sync failed:", error);
    sendJson(response, 500, {
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    running = false;
  }
});

server.listen(port, () => {
  console.log(`Cloud sync server listening on port ${port}`);
});
