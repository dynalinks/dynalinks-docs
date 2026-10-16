import assert from "node:assert/strict";
import { test } from "node:test";
import { codeUsages } from "../lib/code-usages.ts";
import { ruby } from "../lib/ruby-generator.ts";

const context = { mediaAdapters: {} };

test("ruby: JSON body", () => {
  const code = ruby.generate(
    {
      method: "post",
      url: "https://dynalinks.app/api/v1/links/upsert",
      header: { Authorization: { value: "Bearer KEY" } },
      body: { url: "https://x", enable_forced_redirect: true, tags: [1, null] },
      bodyMediaType: "application/json",
    },
    context,
  );

  assert.match(code, /require "net\/http"/);
  assert.match(
    code,
    /uri = URI\("https:\/\/dynalinks\.app\/api\/v1\/links\/upsert"\)/,
  );
  assert.match(code, /Net::HTTP::Post\.new\(uri\)/);
  assert.match(code, /request\["Authorization"\] = "Bearer KEY"/);
  assert.match(code, /request\["Content-Type"\] = "application\/json"/);
  assert.match(code, /JSON\.dump\(\{\n?\s*"url" => "https:\/\/x",/);
  assert.match(code, /"enable_forced_redirect" => true/);
  assert.match(code, /"tags" => \[1, nil\]/);
  assert.match(code, /puts response\.body/);
});

test("ruby: DELETE without body", () => {
  const code = ruby.generate(
    {
      method: "delete",
      url: "https://dynalinks.app/api/v1/links/123",
      header: {},
    },
    context,
  );

  assert.match(code, /Net::HTTP::Delete\.new\(uri\)/);
  assert.doesNotMatch(code, /request\.body/);
  assert.doesNotMatch(code, /undefined/);
});

test("code samples in cURL, JavaScript, Python and Ruby only", () => {
  const labels = [...codeUsages.map().values()].map(
    (generator) => generator.label,
  );
  assert.deepEqual(labels, ["cURL", "JavaScript", "Python", "Ruby"]);
});
