import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dist");
const port = Number(process.env.PORT ?? 3100);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
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

// `new URL()` only collapses `..` segments it can see, so an encoded separator
// (`/..%2fpackage.json`) survives normalization and turns into `../` after
// decodeURIComponent. Containment is therefore checked on the resolved path,
// never on the requested one.
function fileIfExists(candidate) {
  try {
    const resolved = path.resolve(candidate);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null;
    return fs.existsSync(resolved) && fs.statSync(resolved).isFile() ? resolved : null;
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
  // Malformed percent-encoding must 404, not kill the process: WHATWG URL
  // preserves invalid sequences (`/%`, `/%zz`), so decodeURIComponent throws.
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    pathname = null;
  }

  // GitHub Pages answers a slashless directory request with a 301 to the
  // slashed form; mirror it so regressions exercise the redirect users get.
  // An extensionless `.html` sibling wins over the redirect, as on Pages.
  if (pathname !== null && !pathname.endsWith("/") && !path.extname(pathname)) {
    if (
      fileIfExists(path.join(root, pathname, "index.html")) &&
      !fileIfExists(path.join(root, `${pathname}.html`))
    ) {
      response.writeHead(301, { Location: `${url.pathname}/${url.search}` });
      response.end();
      return;
    }
  }

  const file = pathname === null ? null : resolveFile(pathname);

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
