import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { BASE_PATH, OUT, outFileFor, ROOT, readOut, walk } from "./helpers.mjs";

export const REFERENCE_PAGES = {
  links: [
    "list-links",
    "create-link",
    "upsert-link",
    "get-link",
    "update-link",
    "delete-link",
  ],
  "short-links": ["create-short-link", "resolve-short-link"],
  "ios-apps": [
    "list-ios-apps",
    "create-ios-app",
    "get-ios-app",
    "update-ios-app",
    "delete-ios-app",
  ],
  "android-apps": [
    "list-android-apps",
    "create-android-app",
    "get-android-app",
    "update-android-app",
    "delete-android-app",
  ],
};

const referenceUrls = Object.entries(REFERENCE_PAGES).flatMap(
  ([group, pages]) => pages.map((page) => `/reference/${group}/${page}`),
);

test("all 18 public operations have a page", () => {
  assert.equal(referenceUrls.length, 18);
  assert.ok(outFileFor("/reference"), "no /reference overview page");
  for (const url of referenceUrls) {
    assert.ok(outFileFor(url), `no page for ${url}`);
  }
});

test("no internal operations", () => {
  const dir = join(OUT, "reference");
  assert.ok(existsSync(dir), "out/reference is missing");
  const leaked = walk(dir)
    .map((file) => relative(OUT, file))
    .filter((file) => /project|api-key|page-template|qr/.test(file));
  assert.deepEqual(leaked, []);
});

// Closed sidebar folders aren't rendered, so each group is checked from its own first page.
test("reference pages are in the sidebar under display names", () => {
  const html = readOut(outFileFor("/reference/links/list-links"));
  for (const name of ["Links", "Short links", "iOS apps", "Android apps"]) {
    assert.ok(html.includes(`>${name}<`), `sidebar is missing ${name}`);
  }
  for (const [group, pages] of Object.entries(REFERENCE_PAGES)) {
    const groupHtml = readOut(outFileFor(`/reference/${group}/${pages[0]}`));
    for (const page of pages) {
      assert.ok(
        groupHtml.includes(`href="${BASE_PATH}/reference/${group}/${page}"`),
        `sidebar has no link to /reference/${group}/${page}`,
      );
    }
  }
});

test("Try it targets the production API without a proxy", () => {
  const html = readOut(outFileFor("/reference/links/delete-link"));
  assert.ok(html.includes("https://dynalinks.app/api/v1"));
  for (const file of walk(OUT, (f) => /\.(html|js|json)$/.test(f))) {
    const content = readFileSync(file, "utf8");
    assert.ok(
      !content.includes("/api/proxy"),
      `${relative(OUT, file)} mentions /api/proxy`,
    );
  }
});

test("reference is searchable", () => {
  const index = readOut(outFileFor("/api/search"));
  for (const url of referenceUrls) {
    assert.ok(
      index.includes(`"url":"${url}"`),
      `${url} is not in the search index`,
    );
  }
});

test("no links to ReadMe", () => {
  const files = [
    ...walk(join(ROOT, "content/docs"), (f) => f.endsWith(".mdx")),
    ...walk(OUT, (f) => f.endsWith(".html")),
  ];
  const hits = files.filter((file) =>
    readFileSync(file, "utf8").includes("readme.io"),
  );
  assert.deepEqual(
    hits.map((file) => relative(ROOT, file)),
    [],
  );
});

// The tab switcher renders the current tab; the other one only appears when it opens.
test("Guides and API reference tabs", () => {
  const reference = readOut(outFileFor("/reference/links/list-links"));
  const guide = readOut(outFileFor("/ios/sdk"));
  const currentTab = (html) =>
    html.match(/<p class="text-sm font-medium">([^<]+)<\/p>/)?.[1];

  assert.equal(currentTab(guide), "Guides");
  assert.equal(currentTab(reference), "API reference");
  assert.ok(
    !guide.includes(`href="${BASE_PATH}/reference/links/list-links"`),
    "guide sidebar lists reference pages",
  );
  assert.ok(
    !reference.includes(`href="${BASE_PATH}/ios/sdk"`),
    "reference sidebar lists guide pages",
  );
});
