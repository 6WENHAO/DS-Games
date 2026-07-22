// Minimal static file server so the game can load ES modules + importmap.
// Run:  node serve.mjs      then open  http://localhost:8080
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 8080;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const fp = path.join(root, path.normalize(p));
  if (!fp.startsWith(root)) { res.writeHead(403); res.end("403"); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(fp)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(port, () => {
  console.log(`WEB STRIKE running -> http://localhost:${port}`);
});
