import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  BASE_PATH,
  OUT,
  outFileFor,
  outHtmlFiles,
  readOut,
  walk,
} from "./helpers.mjs";

// Run with NEXT_PUBLIC_BASE_PATH=/dynalinks-docs for both `npm run build` and `npm test`.
const skip =
  BASE_PATH !== "/dynalinks-docs" && "only runs for a /dynalinks-docs build";

test("every root-relative URL carries the base path", { skip }, () => {
  const unprefixed = outHtmlFiles()
    .flatMap((file) => [...readOut(file).matchAll(/(?:href|src)="(\/[^"]*)"/g)])
    .map(([, url]) => url)
    .filter(
      (url) =>
        !url.startsWith("//") &&
        url !== BASE_PATH &&
        !url.startsWith(`${BASE_PATH}/`),
    );
  assert.deepEqual(unprefixed, []);
});

test("search loads its index from the base path", { skip }, () => {
  const bundles = walk(join(OUT, "_next", "static"), (file) =>
    file.endsWith(".js"),
  );
  assert.ok(
    bundles.some((file) =>
      readFileSync(file, "utf8").includes("/dynalinks-docs/api/search"),
    ),
    "no client bundle fetches /dynalinks-docs/api/search",
  );
});

test("redirects point inside the base path", { skip }, () => {
  assert.match(
    readOut(outFileFor("/start/getting_started.html")),
    /content="0; url=\/dynalinks-docs\/start\/getting-started"/,
  );
});
