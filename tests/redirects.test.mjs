import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { writeRedirects } from "../scripts/write-redirects.mjs";
import { BASE_PATH, outFileFor, readOut } from "./helpers.mjs";

// The live sitemap of the Jekyll site, October 2026.
const OLD_URLS = [
  "/",
  "/advanced/appearance_settings.html",
  "/advanced/apple_app_site_association.html",
  "/advanced/custom_domains.html",
  "/advanced/page_templates.html",
  "/advanced/query_params.html",
  "/advanced/root_url.html",
  "/analytics/analytics_configuration.html",
  "/analytics/analytics.html",
  "/api/api_basics.html",
  "/api/apps_api.html",
  "/api/authorization.html",
  "/api/checking_if_link_exists.html",
  "/api/link_shortening.html",
  "/api/unnamed_links.html",
  "/deferred/deferred-android.html",
  "/deferred/deferred-ios.html",
  "/fallbacks/fallback.html",
  "/fallbacks/forced_redirect.html",
  "/integrations/android-debugging.html",
  "/integrations/android-sdk.html",
  "/integrations/android.html",
  "/integrations/flutter-debugging.html",
  "/integrations/flutter-sdk.html",
  "/integrations/ios-debugging.html",
  "/integrations/ios-privacy-compliance.html",
  "/integrations/ios-sdk.html",
  "/integrations/ios.html",
  "/integrations/react-native-debugging.html",
  "/integrations/react-native-sdk.html",
  "/integrations/receiving_link_in_your_app.html",
  "/links/creating_links.html",
  "/links/named_vs_unnamed.html",
  "/links/social_previews.html",
  "/start/firebase_migration.html",
  "/start/getting_started.html",
  "/start/plans.html",
  "/team/team_members.html",
];

test("all 38 old URLs resolve", () => {
  assert.equal(OLD_URLS.length, 38);
  for (const url of OLD_URLS) {
    assert.ok(outFileFor(url), `${url} does not resolve`);
  }
});

test("redirect pages point at the new page", () => {
  const html = readOut(outFileFor("/start/getting_started.html"));
  assert.ok(
    html.includes(
      `http-equiv="refresh" content="0; url=${BASE_PATH}/start/getting-started"`,
    ),
  );
  assert.ok(
    html.includes(
      'rel="canonical" href="https://docs.dynalinks.app/start/getting-started"',
    ),
  );
  assert.ok(html.includes(`<a href="${BASE_PATH}/start/getting-started">`));
});

test("redirect pages keep the #anchor", () => {
  const html = readOut(outFileFor("/start/getting_started.html"));
  const script = html.indexOf(
    `location.replace("${BASE_PATH}/start/getting-started" + location.hash)`,
  );
  assert.ok(script > -1, "no anchor-preserving redirect script");
  assert.ok(
    script < html.indexOf('http-equiv="refresh"'),
    "the script must run before the meta refresh",
  );
});

test("a URL that is already the new page is not overwritten", () => {
  const html = readOut(outFileFor("/start/plans.html"));
  assert.doesNotMatch(html, /http-equiv="refresh"/);
  assert.match(html, /Free and Pro plans/);
});

test("redirects keep the base path", () => {
  const outDir = mkdtempSync(join(tmpdir(), "redirects-"));
  const written = writeRedirects({
    outDir,
    redirects: { "/start/getting_started.html": "/start/getting-started" },
    basePath: "/dynalinks-docs",
  });

  assert.deepEqual(written, ["/start/getting_started.html"]);
  const html = readFileSync(join(outDir, "start/getting_started.html"), "utf8");
  assert.ok(
    html.includes('content="0; url=/dynalinks-docs/start/getting-started"'),
  );
});
