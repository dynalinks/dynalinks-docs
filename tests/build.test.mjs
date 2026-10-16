import assert from "node:assert/strict";
import { test } from "node:test";
import { outFileFor, readOut } from "./helpers.mjs";

test("home page is at the site root", () => {
  const file = outFileFor("/");
  assert.ok(file, "out/index.html is missing");
  assert.match(readOut(file), /privacy-first deep linking platform/);
});

test("search index is exported", () => {
  const file = outFileFor("/api/search");
  assert.ok(file, "search index is missing");
  assert.doesNotThrow(() => JSON.parse(readOut(file)));
});

test("no /docs prefix", () => {
  assert.equal(outFileFor("/docs"), null);
});
