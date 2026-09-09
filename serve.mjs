// Tiny static server for local preview. No dependencies.
//   node serve.mjs           → serves ./docs on http://localhost:8080
//   node serve.mjs 3000      → custom port
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "docs");
const PORT = Number(process.argv[2]) || 8080;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".vcf": "text/vcard; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p === "/") p = "/index.html";
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ""));
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("404 Not Found");
  }
}).listen(PORT, () => {
  console.log(`Serving docs/ at http://localhost:${PORT}`);
  console.log(`Card list:        http://localhost:${PORT}/`);
  console.log(`Stop with Ctrl+C`);
});
