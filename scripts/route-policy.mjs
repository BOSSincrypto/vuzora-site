import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const read = (path) => readFile(join(root, path), "utf8");
const field = (record, name) => {
  const match = record.match(new RegExp(`\\b${name}\\s*:\\s*["']([^"']*)["']`));
  return match?.[1];
};

export async function readRegistry() {
  const [universitiesSource, blogSource] = await Promise.all([
    read("src/content/universities.ts"),
    read("src/content/blog.ts"),
  ]);
  const registryBlock = universitiesSource.match(
    /export const UNIVERSITIES[\s\S]*?=\s*\[[\s\S]*?\]\s*as const/,
  )?.[0];
  if (!registryBlock) throw new Error("Could not locate UNIVERSITIES registry");

  const universities = [...registryBlock.matchAll(/\{([^{}]*)\}/g)].map((match) => {
    const record = match[1];
    return {
      slug: field(record, "slug") ?? null,
      code: field(record, "code") ?? null,
      name: field(record, "name") ?? null,
      city: field(record, "city") ?? null,
      status: field(record, "status") ?? null,
      officialUrl: field(record, "officialUrl") ?? null,
    };
  });
  const posts = [...blogSource.matchAll(/\bslug\s*:\s*["']([^"']+)["']/g)].map(
    (match) => match[1],
  );

  return { universities, posts };
}

export function buildRoutes({ universities, posts }) {
  const core = [
    "/",
    "/pricing",
    "/unis",
    "/blog/",
    "/changelog",
    "/legal/terms",
    "/legal/privacy",
  ];
  const blog = posts.map((slug) => `/blog/${slug}`);
  const university = universities
    .filter((record) => record.slug)
    .map((record) => `/unis/${record.slug}`);
  return [...core, ...blog, ...university];
}

export function artifactFor(route) {
  if (route === "/") return "index.html";
  return `${route.replace(/\/$/, "")}/index.html`.replace(/^\//, "");
}

export function manifestFor({ universities, posts }) {
  return {
    universities: universities.map((record) => ({ ...record })),
    posts: [...posts],
  };
}
