import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import test from "node:test";
import { buildRouteLastmod, gitLastCommitDate, sourcesFor } from "./route-lastmod.mjs";

const POSTS = [
  { slug: "post-a", date: "2026-07-01" },
  { slug: "post-b", date: "2026-07-09" },
];

/** Stub git that records its invocations and answers with a fixed date. */
function stubGit(answer = "2026-05-04") {
  const calls = [];
  const git = (args, cwd) => {
    calls.push({ args, cwd });
    return answer;
  };
  return { git, calls };
}

test("blog surfaces date themselves from the post records, never from git", () => {
  const { git, calls } = stubGit();
  const lastmod = buildRouteLastmod({
    routes: ["/blog/", "/blog/post-a/", "/blog/post-b/"],
    postRecords: POSTS,
    git,
  });
  assert.equal(lastmod.get("/blog/post-a/"), "2026-07-01");
  assert.equal(lastmod.get("/blog/post-b/"), "2026-07-09");
  // The index is as fresh as its newest post, not as its oldest.
  assert.equal(lastmod.get("/blog/"), "2026-07-09");
  assert.equal(calls.length, 0);
});

test("every other route takes the last commit date of its own sources", () => {
  const { git, calls } = stubGit("2026-05-04");
  const routes = ["/", "/pricing/", "/unis/", "/changelog/", "/unis/msu/", "/unis/hse/"];
  const lastmod = buildRouteLastmod({ routes, postRecords: POSTS, git });
  for (const route of routes) assert.equal(lastmod.get(route), "2026-05-04");
  // The 28 detail pages share one source set, so they must share one git call:
  // four core routes plus one for the whole detail family.
  assert.equal(calls.length, 5);
  assert.ok(calls.every((call) => call.args[0] === "log" && call.args.includes("--")));
});

test("an unanswerable git leaves the route with no date rather than a guess", () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const answer of [undefined, "", "not-a-date", "2026-13-99"]) {
    const lastmod = buildRouteLastmod({
      routes: ["/pricing/", "/unis/msu/"],
      postRecords: POSTS,
      git: () => answer,
    });
    assert.equal(lastmod.get("/pricing/"), undefined);
    assert.equal(lastmod.get("/unis/msu/"), undefined);
    // The build day is exactly the value this module exists to stop emitting.
    assert.notEqual(lastmod.get("/pricing/"), today);
  }
});

test("a route with no declared sources asks git nothing", () => {
  assert.equal(sourcesFor("/blog/some-post/"), undefined);
  assert.equal(gitLastCommitDate([], { git: () => "2026-05-04" }), undefined);
  const { git, calls } = stubGit();
  const lastmod = buildRouteLastmod({ routes: ["/nope/"], postRecords: [], git });
  assert.equal(lastmod.get("/nope/"), undefined);
  assert.equal(calls.length, 0);
});

test("declared sources are repo-relative paths this repository actually has", async () => {
  const routes = ["/", "/pricing/", "/unis/", "/changelog/", "/legal/terms/", "/legal/privacy/"];
  for (const route of [...routes, "/unis/msu/"]) {
    const paths = sourcesFor(route);
    assert.ok(paths?.length, `no sources declared for ${route}`);
    for (const path of paths) {
      assert.doesNotMatch(path, /^[/\\]|\\/, `source must be a repo-relative POSIX path: ${path}`);
      // A typo here silently drops the date instead of failing the build, so
      // pin the paths to files that exist.
      await stat(path);
    }
  }
});
