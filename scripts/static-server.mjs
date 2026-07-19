import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dist");
const port = Number(process.env.PORT ?? 3100);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};
const pathMime = {
  "/.well-known/api-catalog": "application/linkset+json; charset=utf-8",
};

function fileIfExists(candidate) {
  try {
    return fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      ? candidate
      : null;
  } catch {
    return null;
  }
}

function resolveFile(pathname) {
  const cleanPath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  return (
    fileIfExists(path.join(root, cleanPath)) ??
    fileIfExists(path.join(root, cleanPath, "index.html")) ??
    (path.extname(cleanPath) ? null : fileIfExists(path.join(root, `${cleanPath}.html`)))
  );
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const pathname = decodeURIComponent(url.pathname);
  const file = resolveFile(pathname);

  if (!file) {
    const notFound = fileIfExists(path.join(root, "404.html"));
    response.writeHead(404, {
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end(notFound ? fs.readFileSync(notFound) : "Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type":
      pathMime[pathname] ?? mime[path.extname(file)] ?? "application/octet-stream",
  });
  response.end(fs.readFileSync(file));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`static ${root} on http://127.0.0.1:${port}`);
});
