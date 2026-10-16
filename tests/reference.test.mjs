import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    "get-link-qr-code",
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
  "api-keys": [
    "list-api-keys",
    "create-api-key",
    "get-api-key",
    "update-api-key",
    "delete-api-key",
  ],
  projects: [
    "list-projects",
    "create-project",
    "get-project",
    "update-project",
    "delete-project",
    "verify-project-custom-domain",
  ],
  "page-templates": [
    "get-page-template",
    "update-page-template",
    "publish-page-template",
    "unpublish-page-template",
    "preview-page-template",
    "list-page-template-versions",
    "get-page-template-version",
    "restore-page-template-version",
  ],
};

const referenceUrls = Object.entries(REFERENCE_PAGES).flatMap(
  ([group, pages]) => pages.map((page) => `/reference/${group}/${page}`),
);

test("every public operation has a page", () => {
  assert.equal(referenceUrls.length, 38);
  assert.ok(outFileFor("/reference"), "no /reference overview page");
  for (const url of referenceUrls) {
    assert.ok(outFileFor(url), `no page for ${url}`);
  }
  const llms = readFileSync(join(OUT, "llms.txt"), "utf8");
  for (const url of referenceUrls) {
    assert.ok(llms.includes(`](${url})`), `${url} is missing from llms.txt`);
  }
});

// Closed sidebar folders aren't rendered, so each group is checked from its own first page.
test("reference pages are in the sidebar under display names", () => {
  const html = readOut(outFileFor("/reference/links/list-links"));
  for (const name of [
    "Links",
    "Short links",
    "iOS apps",
    "Android apps",
    "API keys",
    "Projects",
    "Page templates",
  ]) {
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

// The server comes from the spec the site was built from: staging on PRs, production on main.
async function expectedServer() {
  const source =
    process.env.OPENAPI_URL ?? "https://dynalinks.app/api/v1/openapi.json";
  const spec = /^https?:/.test(source)
    ? await (await fetch(source)).json()
    : JSON.parse(readFileSync(source, "utf8"));
  return spec.servers[0].url;
}

test("Try it targets the spec's server without a proxy", async () => {
  const html = readOut(outFileFor("/reference/links/delete-link"));
  const server = await expectedServer();
  assert.ok(html.includes(server), `page doesn't target ${server}`);
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

test("overview documents the same auth header as the guides", () => {
  const overview = readFileSync(
    join(ROOT, "content/docs/reference/index.mdx"),
    "utf8",
  );
  assert.match(overview, /Authorization: Token <key>/);
  assert.doesNotMatch(overview, /Bearer/);
});
