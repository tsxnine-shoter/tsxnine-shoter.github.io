// Lokalny serwer: node server.mjs  ->  http://localhost:8080
// Serwuje stronę i co 30 min sam odświeża data/clips.json.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, copyFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";

const root = fileURLToPath(new URL(".", import.meta.url));
if (!existsSync(join(root, "favicon.png")) && existsSync(join(root, "tsx.png"))) { try { copyFileSync(join(root, "tsx.png"), join(root, "favicon.png")); console.log("  Utworzono favicon.png z tsx.png"); } catch {} }
const port = process.env.PORT || 8080;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const blocked = [/^\/\./, /^\/scripts\//, /^\/server\.mjs/];

http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const safe = normalize(p).replace(/^(\.\.[/\\])+/, "");
    if (blocked.some((b) => b.test(safe.replace(/\\/g, "/")))) { res.writeHead(403).end("403"); return; }
    const data = await readFile(join(root, safe));
    res.writeHead(200, { "Content-Type": types[extname(safe).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" }).end(data);
  } catch { res.writeHead(404).end("404"); }
}).listen(port, () => {
  console.log(`\n  Komputer:  http://localhost:${port}`);
  for (const list of Object.values(networkInterfaces()))
    for (const n of list || []) if (n.family === "IPv4" && !n.internal) console.log(`  Telefon (to samo Wi-Fi):  http://${n.address}:${port}`);
  console.log("  (Ctrl+C aby zatrzymać)\n");
});

let running = false;
function refresh() {
  if (running) return;
  running = true;
  console.log("[klipy] pobieram…");
  const p = spawn(process.execPath, ["scripts/fetch-clips.mjs"], { cwd: root, stdio: "inherit" });
  p.on("close", () => { running = false; });
}
refresh();
setInterval(refresh, 30 * 60 * 1000);
