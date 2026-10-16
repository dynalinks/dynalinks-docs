# API Reference in the Docs Site (Plan 3 of 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** docs.dynalinks.app gets an "API reference" with one page per public operation, code samples and a working "Try it". Every link that pointed at dynalinks.readme.io (in the docs site and in the app) points there instead.

**Architecture:** `fumadocs-openapi` builds virtual pages at build time (`staticSource`) from the spec the backend serves. Pull requests build against staging (`https://dynalinks.ovh/api/v1/openapi.json`) and `main` builds against production (`https://dynalinks.app/api/v1/openapi.json`). The pages sit under `/reference/<tag>/<operation>` next to the guides, which stay at the root. "Try it" calls the API straight from the browser, with no proxy. After a production deploy, the backend sends a `repository_dispatch` that rebuilds the docs.

**Tech Stack:** fumadocs-openapi 12.5.1 + shiki, the existing Fumadocs/Next 16 static site, Rails 8 backend, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-16-docs-site-and-api-reference-design.md` (Part 3).

## Global Constraints

- Repos: docs `~/Projects/dynalinks-docs` (`dynalinks/dynalinks-docs`); backend worktree `~/.local/share/opencode/worktree/295fc6/feat/public-openapi-spec-195` (PR #201, branch `feat/public-openapi-spec-195`).
- Spec URL: env `OPENAPI_URL`, which can be a URL or a file path. The default is `https://dynalinks.app/api/v1/openapi.json`. In CI, `pull_request` → staging URL, everything else → production URL.
- No proxy (`proxyUrl` unset), no telemetry, no hosted service.
- Code samples: cURL, JavaScript, Python, Ruby, in that order.
- Reference URL = `/reference/<kebab(tag)>/<kebab(operationId)>`. The 18 public pages:
  - links: `list-links`, `create-link`, `upsert-link`, `get-link`, `update-link`, `delete-link`
  - short-links: `create-short-link`, `resolve-short-link`
  - ios-apps: `list-ios-apps`, `create-ios-app`, `get-ios-app`, `update-ios-app`, `delete-ios-app`
  - android-apps: `list-android-apps`, `create-android-app`, `get-android-app`, `update-android-app`, `delete-android-app`
- Display tag names (the spec's tag values, after Task 1): `Links`, `Short links`, `iOS apps`, `Android apps`. kebab(`iOS apps`) = `ios-apps`.
- ReadMe → new URL: `post_links` → `/reference/links/create-link`; `get_links` → `/reference/links/list-links`; `post_links-upsert` → `/reference/links/upsert-link`; `delete_links-id` → `/reference/links/delete-link`; `post_short-links` → `/reference/short-links/create-short-link`. A ReadMe root link → `/reference`.
- **STOP** before: merging any PR, pushing to `production`, or creating tokens or secrets.

## Review Focus

1. **The spec fetch fails at build time** (backend down, or 404 before the release): the build must fail loudly rather than ship an empty reference. Test in Task 2.
2. **The "Try it" request goes to the wrong host, or through a proxy:** the page must target `https://dynalinks.app/api/v1` on main builds, and the bundle must have no proxy URL. Test in Task 2.
3. **Internal operations leaking** if the backend filter regresses: there are no `/reference/**` pages for projects, API keys, page templates or QR. Test in Task 2.
4. **The base path** under `NEXT_PUBLIC_BASE_PATH`: reference links and playground assets carry the prefix. The existing base-path test covers it once the reference pages exist (Task 2 runs it).
5. **Ruby sample for a JSON body or a DELETE without a body:** the generated code must be valid-looking Ruby with no `undefined`. Test in Task 3.

---

### Task 1: Display tag names in the spec (backend, added to PR #201)

**Files:**
- Modify: `docs/dynalinks.yaml`:
  - Operation tags `links` → `Links`, `short_links` → `Short links`, `ios_apps` → `iOS apps`, `android_apps` → `Android apps`, `projects` → `Projects`, `api_keys` → `API keys`, and the page template tag → `Page templates`.
  - Add a top-level `tags:` list after `security`, with `name` + a one-sentence `description` for each, in that order.
- Modify: `app/services/public_openapi_spec.rb`: drop top-level `tags` entries that no remaining operation uses.
- Test: `test/services/public_openapi_spec_test.rb`, `test/integration/openapi_spec_routes_test.rb`

- [ ] **Step 1: Write the failing tests:**
  - routes test `test "every operation tag is declared in top-level tags"`: the set of operation tags is a subset of `spec["tags"].map { _1["name"] }`.
  - service test `test "prunes top-level tags no longer used"`: a fixture with tags `A` (public op) and `B` (internal op only) keeps only `A`.
  - service test `test "real spec: public tags"`: `PublicOpenapiSpec.for(...)["tags"].map { _1["name"] } == ["Links", "Short links", "iOS apps", "Android apps"]`.
- [ ] **Step 2:** `bin/rails test test/services/public_openapi_spec_test.rb test/integration/openapi_spec_routes_test.rb`. Expected: the 3 new tests FAIL.
- [ ] **Step 3:** Rename the tags, add `tags:`, and add the pruning to `filter`.
- [ ] **Step 4:** Run the Step 2 command, then `bin/rails test`. Expected: all PASS.
- [ ] **Step 5:** Commit `docs(api): display tag names and prune unused tags`, then push to `feat/public-openapi-spec-195`. PR #201 picks it up.
- [ ] **Step 6:** Write the local spec for the docs tasks: `bin/rails runner 'puts JSON.pretty_generate(PublicOpenapiSpec.for(server_url: "https://dynalinks.app/api/v1"))' > /tmp/dynalinks-openapi.json`.

### Task 2: Reference pages in the docs site

Work on branch `feat/api-reference` in `~/Projects/dynalinks-docs`. Run every build in this task with `OPENAPI_URL=/tmp/dynalinks-openapi.json`.

**Files:**
- `npm i fumadocs-openapi@12.5.1 shiki`
- Create: `lib/openapi.ts`: `export const openapi = createOpenAPI({ input: { dynalinks: () => process.env.OPENAPI_URL ?? "https://dynalinks.app/api/v1/openapi.json" } })`
- Create: `components/api-page.tsx` (client): `export const OpenAPIPage = createOpenAPIPage({ codeUsages })`. `codeUsages` is set up in Task 3; here use `createOpenAPIPage()` with no arguments.
- Modify: `lib/source.ts`: `loader({ docs: docs.toFumadocsSource(), openapi: await openapi.staticSource({ baseDir: "reference", per: "operation", groupBy: (e) => kebab(e.item.tags?.[0]), name: (e) => kebab(e.item.operationId), meta: true }) }, { baseUrl: "/", plugins: [openapi.loaderPlugin()] })`. Check the entry's exact field names against `fumadocs-openapi/dist/utils/pages/builder.d.ts` (`OperationOutput`).
- Modify: `app/(docs)/[[...slug]]/page.tsx`: when `page.type === "openapi"`, render `<DocsPage full><DocsTitle>{page.data.title}</DocsTitle><DocsBody><OpenAPIPage {...page.data.getOpenAPIPageProps()} /></DocsBody></DocsPage>`. Fix every other `source` user that `npm run types:check` flags: `generateMetadata`, the llms routes, the og route and the search route.
- Modify: `app/global.css`: `@import "fumadocs-openapi/css/preset.css";`
- Create: `content/docs/reference/index.mdx`, titled "API reference". Its body:
  - base URL `https://dynalinks.app/api/v1`;
  - authentication with a link to `/api/authorization`;
  - the spec URL for Postman/codegen;
  - a list linking the four groups' first pages.
- Modify: `.github/workflows/pages.yml`: Build and Test steps get `OPENAPI_URL: ${{ github.event_name == 'pull_request' && 'https://dynalinks.ovh/api/v1/openapi.json' || 'https://dynalinks.app/api/v1/openapi.json' }}`.
- Test: `tests/reference.test.mjs`

**Interfaces:**
- Produces: `components/api-page.tsx` exports `OpenAPIPage`. Task 3 adds `codeUsages` to it.
- Produces: the 18 reference URLs from Global Constraints and `/reference`.

- [ ] **Step 1: Write the failing tests** in `tests/reference.test.mjs`:
  - `test('all 18 public operations have a page')`: `outFileFor` is not null for each URL in Global Constraints, nor for `/reference`.
  - `test('no internal operations')`: `walk(out/reference)` has no path matching `/project|api-key|page-template|qr/`.
  - `test('reference pages are in the sidebar under display names')`: the HTML of `/reference/links/list-links` contains `Short links`, `iOS apps` and `Android apps`, plus `href` links to the four first pages.
  - `test('Try it targets the production API without a proxy')`: the `/reference/links/delete-link` HTML contains `https://dynalinks.app/api/v1`. No `out/**` file contains `/api/proxy` or `readme.io`.
  - `test('reference is searchable')`: the `/api/search` export contains `Upsert`.
- [ ] **Step 2:** `OPENAPI_URL=/tmp/dynalinks-openapi.json npm run build; npm test`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement the files above. If `staticSource` and `content/docs/reference/index.mdx` can't share the `reference` folder (a duplicate-path build error), move the overview to `content/docs/api/reference.mdx`, change the `/reference` test to `/api/reference`, and ledger the ruling.
- [ ] **Step 4:** Run the Step 2 command, plus the base-path pair (`NEXT_PUBLIC_BASE_PATH=/dynalinks-docs`), `npm run types:check` and `npm run lint`. Expected: all PASS.
- [ ] **Step 5: The spec fetch must fail loudly.** `OPENAPI_URL=https://dynalinks.app/api/v1/does-not-exist.json npm run build`. Expected: the build exits non-zero. If it succeeds with an empty reference, make `input.dynalinks` an async function that fetches the URL itself and throws on a non-200 response. Re-run until it fails.
- [ ] **Step 6:** Screenshot `/reference/links/upsert-link` in light and dark mode. **Commit** `feat: API reference generated from the backend spec`.

### Task 3: Code samples: cURL, JavaScript, Python, Ruby

**Files:**
- Create: `lib/ruby-generator.ts`: `export const ruby: CodeUsageGenerator` with `label: "Ruby"`, `lang: "ruby"`. It generates `require "net/http"`, `require "json"`, `uri = URI(<url>)`, a `Net::HTTP::<Method>` request, one `request[<name>] = <value>` per header, `request.body = JSON.dump(<body as a Ruby hash literal>)` only when there is a JSON body, then `response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(request) }` and `puts response.body`.
- Modify: `components/api-page.tsx`: `const codeUsages = createCodeUsageGeneratorRegistry(); codeUsages.add("curl", curl); codeUsages.add("js", javascript); codeUsages.add("python", python); codeUsages.add("ruby", ruby);`. The first three come from `fumadocs-openapi/requests/generators/{curl,javascript,python}`; adjust the import paths to the package's `exports`.
- Test: `tests/reference.test.mjs`, `tests/ruby-generator.test.mjs` (runs `lib/ruby-generator.ts` with Node 24's `--experimental-strip-types`; if its imports block that, test through the built HTML only and ledger it)

- [ ] **Step 1: Write the failing tests:**
  - `test('code samples in the four languages')`: the `/reference/links/upsert-link` HTML contains `cURL`, `JavaScript`, `Python` and `Ruby`, and doesn't contain `>Go<` or `>Java<`.
  - `test('ruby: JSON body')`: `ruby.generate({ method: "post", url: "https://dynalinks.app/api/v1/links/upsert", header: { Authorization: { value: "Bearer KEY" } }, body: { url: "https://x" }, bodyMediaType: "application/json" }, { mediaAdapters: {} })` contains `Net::HTTP::Post.new(uri)`, `request["Authorization"] = "Bearer KEY"`, `request["Content-Type"] = "application/json"` and `JSON.dump({ "url" => "https://x" })`.
  - `test('ruby: DELETE without body')`: contains `Net::HTTP::Delete.new(uri)` and doesn't contain `request.body` or `undefined`.
- [ ] **Step 2:** Build, then run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Build, then run the tests. Expected: PASS. **Commit** `feat: cURL, JavaScript, Python and Ruby code samples`.

### Task 4: Point the docs site at the new reference

**Files:**
- Modify: `lib/layout.shared.tsx`: the API link becomes `{ text: "API", url: "/reference" }`.
- Modify the ReadMe links in:
  - `content/docs/api/api-basics.mdx` (2 links)
  - `content/docs/api/apps-api.mdx`
  - `content/docs/api/checking-if-link-exists.mdx` (2 links)
  - `content/docs/api/link-shortening.mdx`
  - `content/docs/links/creating-links.mdx`
  - `content/docs/links/named-vs-unnamed.mdx` (2 links)
  - `content/docs/links/social-previews.mdx`

  Use the mapping in Global Constraints and keep the link text.
- Modify: `tests/branding.test.mjs`: replace `https://dynalinks.readme.io` in `TOP_BAR_LINKS` with a separate assertion that the home page has `href="/reference"`.
- Test: `tests/reference.test.mjs`

- **Tabs:** "Guides" and "API reference" become sidebar tabs (Fumadocs root folders).
  - Move the guide sections into `content/docs/(guides)/`, with `meta.json` `{ "title": "Guides", "root": true, "pages": [...the current root order...] }`. The group folder keeps guide URLs unchanged.
  - Give the reference folder `root: true` with title "API reference". It's virtual, so do it through `staticSource`'s meta, or with a `content/docs/reference/meta.json` if the two sources merge.
  - If root folders can't keep guide URLs at the root, fall back to an "API reference" section at the bottom of the sidebar, and ledger the ruling.

- [ ] **Step 1: Write the failing tests:**
  - `test('no links to ReadMe')`: no `content/docs/**/*.mdx` and no `out/**/*.html` contains `readme.io`.
  - `test('Guides and API reference tabs')`: the `/reference/links/list-links` HTML contains both `Guides` and `API reference` as tab labels. The `/ios/sdk` sidebar doesn't list reference pages, and `/reference/links/list-links` doesn't list guide sections.
  - The existing old-URL and sidebar tests must stay green: guide URLs are unchanged.
- [ ] **Step 2:** Build, then run the tests. Expected: FAIL.
- [ ] **Step 3:** Make the edits.
- [ ] **Step 4:** Build, then run the tests. Expected: PASS. **Commit** `feat: link guides and the top bar to the new API reference`.
- [ ] **Step 5:** Push and open the PR, titled "API reference (#195, part 3/4)". Its CI builds against staging, so it only goes green after PR #201 is merged and deployed to staging (Task 7). Say so in the PR body.

### Task 5: Rebuild the docs after each production deploy

**Files:**
- Docs repo, `.github/workflows/pages.yml`: add `repository_dispatch: { types: [api-spec-updated] }` to `on:`.
- Backend, `.github/workflows/test-build-deploy.yml`: append a last step to `deploy-production`:
  - `name: Rebuild API reference`
  - `if: ${{ env.DOCS_DISPATCH_TOKEN != '' }}`
  - env `DOCS_DISPATCH_TOKEN: ${{ secrets.DOCS_DISPATCH_TOKEN }}`
  - run `gh api repos/dynalinks/dynalinks-docs/dispatches -f event_type=api-spec-updated`, with `GH_TOKEN: ${{ env.DOCS_DISPATCH_TOKEN }}`
- Backend, `.github/workflows/readme.yml`: unchanged (Part 4 deletes it).

- [ ] **Step 1:** Make both edits. Commit the docs one on `feat/api-reference`: `ci: rebuild on api-spec-updated`. The backend one goes in Task 6's branch.
- [ ] **Step 2:** Validate both files: `npx -y @action-validator/cli .github/workflows/pages.yml` (docs) and the backend file. Expected: no errors.
- [ ] **Step 3 (STOP):** Ask the user to create a fine-grained token (resource owner `dynalinks`, repository `dynalinks-docs` only, permission Contents: read and write, 1-year expiry) and to save it as backend secret `DOCS_DISPATCH_TOKEN`. Until then the step is skipped, not failed.

### Task 6: Point the app at the new reference (backend)

Branch `feat/docs-links-195`, from `feat/public-openapi-spec-195` (stacked on #201).

**Files:** replace each ReadMe URL:
- `app/views/shared/_navbar.html.erb:10` → `https://docs.dynalinks.app/reference`
- `app/views/home/about.html.erb:11` → `https://docs.dynalinks.app/reference`
- `app/views/home/faq.html.erb:76` → `https://docs.dynalinks.app/reference`
- `app/views/console/api_keys/index.html.erb:80` → `https://docs.dynalinks.app/reference`
- `app/views/console/master_api_keys/index.html.erb:80` → `https://docs.dynalinks.app/reference`
- `app/views/console/links/_form.html.erb:43` → `https://docs.dynalinks.app/reference/short-links/resolve-short-link`
- blog posts per the mapping: `android_ios_app_ids.md` and `shorten_while_creating.md` → `create-link`; `links_delete_endpoint.md` → `delete-link`; `links_upsert.md` → `upsert-link`; `url_shortening.md` → `/reference`
- plus the Task 5 backend workflow edit

**Test:** `test/integration/no_readme_links_test.rb`

- [ ] **Step 1: Write the failing test** `test "no ReadMe links in app"`: `Dir[Rails.root.join("app/**/*.{erb,md,rb}")]`, where no file's contents match `/readme\.io/`. Failure lists the files.
- [ ] **Step 2:** `bin/rails test test/integration/no_readme_links_test.rb`. Expected: FAIL, listing 11 files.
- [ ] **Step 3:** Make the edits.
- [ ] **Step 4:** Run the test, then `bin/rails test`. Expected: all PASS. `bin/rubocop` on the changed `.rb` files.
- [ ] **Step 5:** Commit `feat: link the app to the self-hosted API reference`, push, and open a PR based on `feat/public-openapi-spec-195`, saying "merge after #201".

### Task 7: Release and verify (needs the user)

- [ ] **Step 1 (STOP):** Ask the user to merge #201 into `main`, which deploys staging. Then run `curl -s https://dynalinks.ovh/api/v1/openapi.json | jq '.tags[].name'`. Expected: the four display names. Re-run CI on the docs PR. Expected: green.
- [ ] **Step 2 (STOP):** Ask the user to release to production, their usual push to `production`. Then the same `curl` against `https://dynalinks.app`. Check the CORS preflight with `curl -si -X OPTIONS https://dynalinks.app/api/v1/links/x -H "Origin: https://docs.dynalinks.app" -H "Access-Control-Request-Method: DELETE"`. Expected: `access-control-allow-methods` contains `DELETE`.
- [ ] **Step 3 (STOP):** Ask the user to merge the docs PR, then wait for its deploy. Check that `https://docs.dynalinks.app/reference/links/upsert-link` returns 200 and shows the four sample tabs.
- [ ] **Step 4:** Ask the user to run "Try it" on `GET /links` with a real API key, and report the result. Then merge the backend links PR (STOP).
