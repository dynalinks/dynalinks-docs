import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  BASE_PATH,
  outFileFor,
  outHtmlFiles,
  ROOT,
  readOut,
  walk,
} from "./helpers.mjs";

const REDIRECTS_FILE = join(ROOT, "redirects.json");
const IGNORED_HREF_PREFIXES = ["/_next", "/api/search", "/og", "/llms"];

function redirects() {
  assert.ok(existsSync(REDIRECTS_FILE), "redirects.json is missing");
  return JSON.parse(readFileSync(REDIRECTS_FILE, "utf8"));
}

function pageUrls() {
  return [...new Set(Object.values(redirects()))].filter((url) => url !== "/");
}

test("every old page has a new page", () => {
  const map = redirects();
  assert.equal(Object.keys(map).length, 38);
  for (const url of Object.values(map)) {
    assert.ok(outFileFor(url), `no page for ${url}`);
  }
});

test("every internal link resolves", () => {
  const broken = [];
  for (const file of outHtmlFiles()) {
    for (const [, href] of readOut(file).matchAll(/href="(\/[^"]*)"/g)) {
      if (
        href.startsWith("//") ||
        IGNORED_HREF_PREFIXES.some((prefix) =>
          href.startsWith(`${BASE_PATH}${prefix}`),
        )
      )
        continue;
      if (!outFileFor(href)) broken.push(`${file} → ${href}`);
    }
  }
  assert.deepEqual(broken, []);
});

test("old in-page anchors still exist", () => {
  assert.match(
    readOut(outFileFor("/fallbacks/fallback")),
    /id="using-a-play-store-url-as-the-android-fallback"/,
  );
  assert.match(
    readOut(outFileFor("/start/getting-started")),
    /id="5-test-the-link-on-a-phone"/,
  );
});

// The sidebar only renders the open section, so each section is checked from its first page.
test("sidebar lists every page", () => {
  const urls = pageUrls();
  assert.equal(urls.length, 37);
  const sections = Object.groupBy(urls, (url) => url.split("/")[1]);
  for (const [section, sectionUrls] of Object.entries(sections)) {
    const { pages } = JSON.parse(
      readFileSync(
        join(ROOT, "content/docs/(guides)", section, "meta.json"),
        "utf8",
      ),
    );
    const html = readOut(outFileFor(`/${section}/${pages[0]}`));
    for (const url of sectionUrls) {
      assert.ok(
        html.includes(`href="${BASE_PATH}${url}"`),
        `${url} is not in the sidebar`,
      );
    }
  }
});

test("no Jekyll syntax left", () => {
  const leftovers = [];
  for (const file of walk(join(ROOT, "content/docs"), (f) =>
    f.endsWith(".mdx"),
  )) {
    const prose = readFileSync(file, "utf8").replace(/^```[\s\S]*?^```/gm, "");
    if (/\{:\s*\.|\{% include|layout: page|nav_order|\{% raw %\}/.test(prose))
      leftovers.push(file);
  }
  assert.deepEqual(leftovers, []);
});

test("the authorization guide covers master keys", () => {
  const html = readOut(outFileFor("/api/authorization"));
  assert.ok(html.includes("Master API key"), "no master-key section");
  assert.ok(
    html.includes("user, not a project"),
    "master keys are not explained as a user-level key",
  );
  assert.ok(
    html.includes(`href="${BASE_PATH}/reference/projects/list-projects"`),
    "the guide does not link to the master-key endpoints",
  );
});

test("the page-template guide points at the API reference", () => {
  const html = readOut(outFileFor("/advanced/page-templates"));
  assert.ok(
    html.includes(
      `href="${BASE_PATH}/reference/page-templates/get-page-template"`,
    ),
    "the page-template guide does not link to the reference",
  );
});
