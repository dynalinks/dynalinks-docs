import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { OUT, outHtmlFiles, readOut, walk } from "./helpers.mjs";

const TOP_BAR_LINKS = [
  "https://dynalinks.app",
  "https://dynalinks.readme.io",
  "https://dynalinks.app/pricing",
  "https://dynalinks.app/faq",
  "https://dynalinks.app/users/sign_in",
  "https://github.com/dynalinks",
];

test("top bar has the six links", () => {
  const home = readOut("index.html");
  for (const href of TOP_BAR_LINKS) {
    assert.ok(home.includes(`href="${href}"`), `missing top bar link ${href}`);
  }
});

test("logo and favicon are served", () => {
  assert.ok(existsSync(join(OUT, "logo.webp")), "out/logo.webp is missing");
  assert.ok(existsSync(join(OUT, "favicon.ico")), "out/favicon.ico is missing");
  assert.match(readOut("index.html"), /logo\.webp/);
});

test("brand colour is set", () => {
  const css = walk(join(OUT, "_next", "static"), (file) =>
    file.endsWith(".css"),
  );
  assert.ok(
    css.some((file) =>
      readFileSync(file, "utf8").toLowerCase().includes("#0d6efd"),
    ),
    "no CSS file sets the brand colour #0d6efd",
  );
});

test("no links into the private docs repo", () => {
  for (const file of outHtmlFiles()) {
    assert.doesNotMatch(
      readOut(file),
      /github\.com\/dynalinks\/dynalinks-docs/,
      `${file} links to the private repo`,
    );
  }
});

test("no external font or icon CDN", () => {
  for (const file of outHtmlFiles()) {
    const html = readOut(file);
    assert.doesNotMatch(
      html,
      /(href|src)="https:\/\/fonts\.googleapis\.com/,
      `${file} loads Google Fonts`,
    );
    assert.doesNotMatch(
      html,
      /(href|src)="https:\/\/cdnjs\.cloudflare\.com/,
      `${file} loads from cdnjs`,
    );
  }
});
