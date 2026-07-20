#!/usr/bin/env bash
set -euo pipefail

# Bootstrap fixture: setup only. Service startup belongs to services.yaml.
if [[ ! -f /tmp/vuzora-static-server.mjs ]]; then
  cat > /tmp/vuzora-static-server.mjs <<'JS'
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "dist");
const port = Number(process.env.PORT || 3100);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
  const file = path.join(root, url.pathname, "index.html");
  if (!fs.existsSync(file)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "Content-Type": mime[path.extname(file)] || "application/octet-stream",
  });
  response.end(fs.readFileSync(file));
});

server.listen(port, "127.0.0.1");
JS
fi
