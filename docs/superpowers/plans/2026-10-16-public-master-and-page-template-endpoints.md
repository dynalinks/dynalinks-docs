# Public master-key and page-template endpoints — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the 20 hidden API operations (API keys, Projects, Page templates, link QR) on docs.dynalinks.app/reference, each group carrying the note that says who can call it.

**Architecture:** The backend keeps its role as the single source of the spec: the markers come off `docs/dynalinks.yaml`, so `GET /api/v1/openapi.json` starts listing all 38 operations. The docs site already generates one page per operation from that spec; it gains three sidebar groups, one extra page in Links, and a Callout whose text is read from the spec's tag descriptions at build time.

**Tech Stack:** Rails 8 (spec served by `PublicOpenapiSpec`), YAML spec in `docs/dynalinks.yaml`; Next.js 16 + Fumadocs (`fumadocs-openapi` 12.5.1, static export to GitHub Pages).

**Spec:** `docs/superpowers/specs/2026-10-16-public-master-and-page-template-endpoints-design.md`

## Global Constraints

- Two repos: backend = `/Users/kuba/.local/share/opencode/worktree/295fc6/feat/public-openapi-spec-195`, docs = `/Users/kuba/Projects/dynalinks-docs`.
- Backend: `bin/rails test` (1481 runs green today) and `bin/rubocop` on changed `.rb` files.
- Docs: `npm test` stays `node --test` — never `node --test tests/`. Node is pinned to 24 by `.nvmrc`; a change to `package.json`'s test script breaks CI.
- Docs verification loop: `OPENAPI_URL=<spec> npm run build && npm test`, plus `npm run lint` and `npm run types:check`.
- The docs build must fail on a bad or empty spec; it must never deploy an empty reference.
- No hosted docs vendor, no "Try it" proxy, no telemetry. No new `readme.io` links anywhere.
- Reference URL shape is frozen: `/reference/<tag-slug>/<kebab-operationId>`; tag slug = lowercase, spaces to dashes; operationId slug = camelCase split to dashes.
- Code samples stay in the order cURL, JavaScript, Python, Ruby with those exact labels.
- The 38 old docs URLs keep working. Do not touch `redirects.json`.
- Do not merge, release, or create secrets without the owner's word.

## Review Focus

Failure modes the spec implies but no single task's tests fully cover — each has its test in the task that owns the code:

1. **A project key hits a master-key page.** A reader must see who can call the endpoint before they try it. Test: every page of the three new groups renders its tag description as a Callout (Task 3).
2. **A missed `x-internal` marker keeps an endpoint invisible.** One forgotten line means a group renders with a hole. Test: exactly 38 operations in the served spec, and no operation carries the key (Task 1).
3. **A tag without a description renders a page with no note, silently.** Test: every declared tag has a description (Task 1) and every group's first page shows its own description (Task 3).
4. **The spec transform swallows a fetch failure** and the site ships an empty reference. Test: a bad `OPENAPI_URL` exits non-zero, and the operation count test still runs before the artifact upload (Task 2).
5. **`GET /links/{id}/qr` documented as needing no auth.** The endpoint does require a key; a reader following the old spec gets a 401 with no explanation. Test: the operation declares no `security: []` (Task 1).

---

### Task 1: Publish every operation in the spec

**Files:**
- Modify: `docs/dynalinks.yaml` (20 `x-internal: true` lines; 3 tag descriptions; `GET /links/{id}/qr` `security`)
- Modify: `CLAUDE.md:236`
- Test: `test/integration/openapi_spec_routes_test.rb:62-74`

**Interfaces:**
- Consumes: `PublicOpenapiSpec.filter(spec:)` and `PublicOpenapiSpec.for(server_url:)` — existing service, unchanged.
- Produces: a spec whose `paths` hold 38 operations, 7 tags each with a `description`, and no `x-internal` key. Tasks 2–4 read the served spec's tag descriptions.

- [ ] **Step 1: Branch off main**

```bash
git fetch -q origin && git checkout -b feat/public-master-endpoints-195 origin/main
```

- [ ] **Step 2: Rewrite the internal-endpoint test to demand the opposite**

Replace `test "unpromoted endpoints are marked x-internal"` (lines 62–74) with:

```ruby
  test "every operation is public" do
    assert_equal 38, operations.size

    operations.each do |verb, path, operation|
      assert_not operation.key?("x-internal"), "#{verb.upcase} #{path} should not be x-internal"
    end

    served = PublicOpenapiSpec.for(server_url: "https://dynalinks.app/api/v1")

    assert_not_includes served.to_json, "x-internal"
    assert_equal 38, served["paths"].sum { |_path, item| item.keys.count { |key| HTTP_VERBS.include?(key) } }
  end

  test "every tag has a description" do
    assert_equal 7, spec["tags"].size

    spec["tags"].each do |tag|
      assert_predicate tag["description"], :present?, "tag #{tag["name"]} has no description"
    end
  end

  test "the QR endpoint requires the API key" do
    assert_not spec["paths"]["/links/{id}/qr"]["get"].key?("security")
  end

  test "the spec intro does not mention master keys" do
    assert_no_match(/master/i, spec.dig("info", "description"))
  end
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `bin/rails test test/integration/openapi_spec_routes_test.rb`
Expected: 2 failures. `every operation is public` stops at the first marked operation (`GET /api_keys should not be x-internal`). `the QR endpoint requires the API key` sees `security: []` still there. The other two new tests pass at this point: the spec file already holds 38 operations and all 7 tags already carry a description from part 3.

- [ ] **Step 4: Take the 20 markers off**

```bash
ruby -e 'p = "docs/dynalinks.yaml"; s = File.read(p); n = s.scan(/^      x-internal: true\n/).size; abort "expected 20 markers, found #{n}" unless n == 20; File.write(p, s.gsub(/^      x-internal: true\n/, ""))'
```

Indentation matters: the marker lines sit at six spaces, directly under each `get:`/`post:`/`patch:`/`delete:` key. Verify with `grep -c x-internal docs/dynalinks.yaml` → `0`.

- [ ] **Step 5: Drop the stale `security` on the QR operation**

In `docs/dynalinks.yaml`, the `getLinkQrCode` operation keeps `security: []`, which claims the endpoint needs no auth. Delete that one line (the global `security` then applies). Leave the `security: []` on `resolveShortLink` alone — that endpoint really is public (`ShortLinksController` skips `authenticate` for `resolve`).

- [ ] **Step 6: Rewrite the three tag descriptions**

In the `tags:` block at the top of `docs/dynalinks.yaml`, set exactly:

```yaml
- name: API keys
  description: Manage a project's API keys. Requires a master API key. Experimental: the request and response shapes may still change.
- name: Projects
  description: Manage projects. Requires a master API key. Experimental: the request and response shapes may still change.
- name: Page templates
  description: Manage the page template shown on link preview pages. Requires page-template access, enabled per project by Dynalinks. Experimental: the request and response shapes may still change.
```

Plain text, no markdown: the site leaks raw markdown out of descriptions into prev/next footers, `og:image` metadata and `llms.txt`.

- [ ] **Step 7: Run the test and confirm it passes**

Run: `bin/rails test test/integration/openapi_spec_routes_test.rb`
Expected: PASS, 10 runs 0 failures.

- [ ] **Step 8: Rewrite the CLAUDE.md rule**

`CLAUDE.md:236` currently tells builders to mark master-key and page-template endpoints `x-internal`. Replace that bullet with:

```markdown
- Every operation in dynalinks.yaml is public at /api/v1/openapi.json. To hold an endpoint back, mark it `x-internal: true`; `PublicOpenapiSpec` strips it, its paths and the schemas only it uses. Nothing is held back today.
```

- [ ] **Step 9: Run the whole suite**

Run: `bin/rails test`
Expected: `1483 runs, 0 failures` (1481 + 2 net new tests).

- [ ] **Step 10: Refresh the local spec copy the docs work builds from**

```bash
bin/rails runner 'puts JSON.pretty_generate(PublicOpenapiSpec.for(server_url: "https://dynalinks.app/api/v1"))' > /tmp/dynalinks-openapi.json
jq '.paths|length, (.paths|map(.[])|length), .tags|length' /tmp/dynalinks-openapi.json
```

Expected: `22`, `38`, `7`.

- [ ] **Step 11: Commit**

```bash
git add docs/dynalinks.yaml CLAUDE.md test/integration/openapi_spec_routes_test.rb
git commit -m "feat(api): publish every operation, gate noted per group"
```

---

### Task 2: Give the three new groups pages

**Files:**
- Modify: `content/docs/reference/meta.json`, `content/docs/reference/index.mdx`
- Create: `content/docs/reference/api-keys/meta.json`, `content/docs/reference/projects/meta.json`, `content/docs/reference/page-templates/meta.json`
- Modify: `content/docs/reference/links/meta.json`
- Modify: `tests/reference.test.mjs:7-52`
- Create: `docs/superpowers/specs/2026-10-16-public-master-and-page-template-endpoints-design.md` (copy of the backend file)

**Interfaces:**
- Consumes: Task 1's spec — `/tmp/dynalinks-openapi.json`, with tag names `API keys`, `Projects`, `Page templates` and operationIds `listApiKeys`…, `verifyProjectCustomDomain`, `getLinkQrCode`.
- Produces: 38 reference pages under the tags' slugs. Task 3 asserts the Callout on those pages; Task 4 links to them.

- [ ] **Step 1: Extend the page inventory test**

In `tests/reference.test.mjs`, replace the `REFERENCE_PAGES` object (lines 7–31) with:

```js
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
```

Then rename `test("all 18 public operations have a page")` to `test("every public operation has a page")` and delete its `assert.equal(referenceUrls.length, 18);` line, replacing it with:

```js
  assert.equal(referenceUrls.length, 38);
  const llms = readFileSync(join(OUT, "llms.txt"), "utf8");
  for (const url of referenceUrls) {
    assert.ok(llms.includes(`](${url})`), `${url} is missing from llms.txt`);
  }
```

`join` and `OUT` are already imported at the top of the file. `readFileSync(join(OUT, "llms.txt"), "utf8")` holds the generated index; each reference page appears as `- [Title](/reference/<group>/<page>)`.

Delete `test("no internal operations")` (lines 45–52) entirely: those files exist now, and the page inventory above is the assertion that they do. In `test("reference pages are in the sidebar under display names")`, extend the name list to:

```js
  for (const name of [
    "Links",
    "Short links",
    "iOS apps",
    "Android apps",
    "API keys",
    "Projects",
    "Page templates",
  ]) {
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd ~/Projects/dynalinks-docs
OPENAPI_URL=/tmp/dynalinks-openapi.json npm run build > /tmp/dd-build.log 2>&1; echo build=$?
OPENAPI_URL=/tmp/dynalinks-openapi.json npm test 2>&1 | grep -E "^✖|ℹ (pass|fail)"
```

Expected: build 0, then failures naming `no page for /reference/api-keys/list-api-keys` and similar, plus sidebar misses. The build passes because the pages are generated from the spec; the sidebar just hides groups with no `meta.json`.

- [ ] **Step 3: Add the three `meta.json` files**

`content/docs/reference/api-keys/meta.json`:

```json
{
  "title": "API keys",
  "pages": [
    "list-api-keys",
    "create-api-key",
    "get-api-key",
    "update-api-key",
    "delete-api-key",
    "..."
  ]
}
```

`content/docs/reference/projects/meta.json`:

```json
{
  "title": "Projects",
  "pages": [
    "list-projects",
    "create-project",
    "get-project",
    "update-project",
    "delete-project",
    "verify-project-custom-domain",
    "..."
  ]
}
```

`content/docs/reference/page-templates/meta.json`:

```json
{
  "title": "Page templates",
  "pages": [
    "get-page-template",
    "update-page-template",
    "publish-page-template",
    "unpublish-page-template",
    "preview-page-template",
    "list-page-template-versions",
    "get-page-template-version",
    "restore-page-template-version",
    "..."
  ]
}
```

The trailing `"..."` keeps later endpoints visible without editing the file, matching the four existing groups.

- [ ] **Step 4: Show the QR page in Links and the groups in the reference root**

Add `"get-link-qr-code"` to `content/docs/reference/links/meta.json`'s `pages`, after `"delete-link"` and before `"..."`.

In `content/docs/reference/meta.json`, extend `pages` to:

```json
  "pages": [
    "links",
    "short-links",
    "ios-apps",
    "android-apps",
    "api-keys",
    "projects",
    "page-templates",
    "..."
  ]
```

- [ ] **Step 5: List the groups on the overview page**

In `content/docs/reference/index.mdx`, extend the `## Endpoints` list to seven entries, appending:

```markdown
- [API keys](/reference/api-keys/list-api-keys): manage a project's API keys. Requires a **master API key**.
- [Projects](/reference/projects/list-projects): manage projects. Requires a **master API key**.
- [Page templates](/reference/page-templates/get-page-template): manage the page template shown on link preview pages. Requires page-template access for the project, and is still experimental.
```

- [ ] **Step 6: Copy the design doc into the docs repo**

```bash
mkdir -p ~/Projects/dynalinks-docs/docs/superpowers/specs
cp docs/superpowers/specs/2026-10-16-public-master-and-page-template-endpoints-design.md ~/Projects/dynalinks-docs/docs/superpowers/specs/
```

- [ ] **Step 7: Rebuild and run the tests**

Run the Step 2 commands again.
Expected: `ℹ pass` with 0 fail, and `build=0`.

- [ ] **Step 8: Commit**

```bash
git add content/docs/reference tests/reference.test.mjs docs/superpowers/specs
git commit -m "feat(reference): API keys, Projects and Page templates groups"
```

---

### Task 3: Put each group's note on its pages

**Files:**
- Modify: `lib/openapi.ts`, `components/api-page.tsx`
- Test: `tests/reference.test.mjs`

**Interfaces:**
- Consumes: the served spec's `tags[].description` (Task 1) and the pages from Task 2.
- Produces: an injected `x-group-note` string on every operation whose tag has a description, and an `<OpenAPIPage />` that renders it as a Callout above the operation description. Task 4 relies on the note being visible to explain master keys.

- [ ] **Step 1: Write the failing test**

Append to `tests/reference.test.mjs`:

```js
test("every group explains who can call it", () => {
  const notes = {
    "api-keys": "Requires a master API key.",
    projects: "Requires a master API key.",
    "page-templates": "Requires page-template access",
  };
  for (const [group, note] of Object.entries(notes)) {
    const pages = REFERENCE_PAGES[group];
    for (const page of pages) {
      const html = readOut(outFileFor(`/reference/${group}/${page}`));
      assert.ok(html.includes(note), `${group}/${page} is missing "${note}"`);
    }
  }
  for (const [group, page] of [
    ["api-keys", "list-api-keys"],
    ["projects", "create-project"],
    ["page-templates", "update-page-template"],
  ]) {
    assert.ok(
      readOut(outFileFor(`/reference/${group}/${page}`)).includes(
        "Experimental: the request",
      ),
      `${group}/${page} is missing the experimental note`,
    );
  }
});

test("the existing groups keep their own one-liner", () => {
  const html = readOut(outFileFor("/reference/links/list-links"));
  assert.ok(
    html.includes("Create, update, look up and delete dynamic links."),
    "Links pages lost their tag description",
  );
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run the Task 2 Step 2 commands.
Expected: the two new tests fail with `list-api-keys is missing "Requires a master API key."`.

- [ ] **Step 3: Inject the note at build time**

In `lib/openapi.ts`, replace the `openapi` creation with a resolver that fetches the spec, copies each tag's description onto its operations, and returns the document:

```ts
async function loadSpec() {
  const response = await fetch(OPENAPI_URL);
  if (!response.ok) {
    throw new Error(`[OpenAPI] ${OPENAPI_URL} returned ${response.status}`);
  }
  const spec = await response.json();
  if (!spec?.paths || Object.keys(spec.paths).length === 0) {
    throw new Error(`[OpenAPI] ${OPENAPI_URL} has no paths`);
  }
  return spec as Document;
}

// The tag description is the group's note: one per group, written once, in the
// spec. The renderer can only see one operation, so it is copied onto each.
async function loadSpecWithGroupNotes(): Promise<Document> {
  const spec = await loadSpec();
  const notes = new Map<string, string>(
    (spec.tags ?? []).map((tag: { name: string; description?: string }) => [
      tag.name,
      tag.description,
    ]),
  );
  for (const pathItem of Object.values(spec.paths)) {
    for (const operation of Object.values(pathItem as Record<string, unknown>)) {
      if (typeof operation !== "object" || operation === null) continue;
      const op = operation as { tags?: string[]; [key: string]: unknown };
      const note = op.tags?.[0] ? notes.get(op.tags[0]) : undefined;
      if (note) op["x-group-note"] = note;
    }
  }
  return spec;
}

export const openapi = createOpenAPI({
  input: { dynalinks: loadSpecWithGroupNotes },
});
```

`type Document` is exported from `fumadocs-openapi`: add `import type { Document } from "fumadocs-openapi";` beside the existing `fumadocs-openapi/server` import.

- [ ] **Step 4: Render it as a Callout**

In `components/api-page.tsx`, replace the export with a page that keeps the library's own layout and adds the note:

```tsx
"use client";
import { Callout } from "fumadocs-ui/components/callout";
import { createOpenAPIPage } from "fumadocs-openapi/ui";
import { codeUsages } from "@/lib/code-usages";

export const OpenAPIPage = createOpenAPIPage({
  codeUsages,
  content: {
    renderOperationLayout(slots, { operation }) {
      const note = (operation as { "x-group-note"?: string })["x-group-note"];
      return (
        <div className="flex flex-col gap-x-6 gap-y-4 @4xl:flex-row @4xl:items-start">
          <div className="min-w-0 flex-1">
            {slots.header}
            {slots.apiPlayground}
            {note ? <Callout type="info">{note}</Callout> : null}
            {slots.description}
            {slots.authSchemes}
            {slots.parameters}
            {slots.body}
            {slots.responses}
            {slots.callbacks}
          </div>
          <div className="@4xl:sticky @4xl:top-[calc(var(--fd-docs-row-3,0px)+1rem)] @4xl:flex @4xl:max-h-[calc(var(--fd-docs-height,100dvh)-var(--fd-docs-row-3,0px)-2rem)] @4xl:w-[400px] @4xl:flex-col">
            {slots.apiExample}
          </div>
        </div>
      );
    },
  },
});
```

These class names and slot order are the library's default layout (`fumadocs-openapi/dist/ui/operation/index.js`); rendering our own layout is the price of adding a slot, so keep the markup identical apart from the Callout.

- [ ] **Step 5: Run the tests and confirm they pass**

Run the Task 2 Step 2 commands, plus:

```bash
npm run lint 2>&1 | tail -1
npm run types:check 2>&1 | tail -3
```

Expected: `ℹ fail 0`, `Checked 57 files`, no type errors.

- [ ] **Step 6: Confirm a bad spec still fails the build**

```bash
OPENAPI_URL=https://dynalinks.app/api/v1/does-not-exist.json npm run build; echo exit=$?
```

Expected: `exit=1` and `[OpenAPI]` in the output. Without this, a failed fetch could ship an empty reference.

- [ ] **Step 7: Commit**

```bash
git add lib/openapi.ts components/api-page.tsx tests/reference.test.mjs
git commit -m "feat(reference): show each group's note as a callout"
```

---

### Task 4: Teach master keys and point the page-template guide at the API

**Files:**
- Modify: `content/docs/(guides)/api/authorization.mdx`, `content/docs/(guides)/advanced/page-templates.mdx`
- Test: `tests/content.test.mjs`

**Interfaces:**
- Consumes: the reference URLs from Task 2 (`/reference/projects/list-projects`, `/reference/page-templates/get-page-template`).
- Produces: nothing later tasks read.

- [ ] **Step 1: Write the failing test**

Append to `tests/content.test.mjs`:

```js
test("the authorization guide covers master keys", () => {
  const html = readOut(outFileFor("/api/authorization"));
  assert.ok(html.includes("Master API key"), "no master-key section");
  assert.ok(
    html.includes("not project-scoped") || html.includes("user, not a project"),
    "master keys are not explained as a user-level key",
  );
  assert.ok(
    html.includes("/reference/projects/list-projects"),
    "the guide does not point at the master-key endpoints",
  );
});

test("the page-template guide points at the API reference", () => {
  const html = readOut(outFileFor("/advanced/page-templates"));
  assert.ok(
    html.includes("/reference/page-templates/get-page-template"),
    "the page-template guide does not link to the reference",
  );
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run the Task 2 Step 2 commands.
Expected: both tests fail; the second with the missing link.

- [ ] **Step 3: Write the master-key section**

Append to `content/docs/(guides)/api/authorization.mdx`:

```markdown
## Master API keys

Most endpoints take a **project API key**: it belongs to one project and can only
touch that project.

A small set of endpoints takes a **master API key** instead. A master key belongs
to your **user, not a project**, so it can work across every project you own:

- everything under [Projects](/reference/projects/list-projects), including
  creating and deleting projects and verifying a custom domain;
- everything under [API keys](/reference/api-keys/list-api-keys), which manages
  the project keys themselves.

A master key is sent the same way, in the `Authorization: Token <key>` header,
and it uses the same `Token` prefix. With a project key those endpoints answer
`401 API key is not master`; that error means the key is fine and the endpoint
wants a master key.

Master API access is enabled per account by Dynalinks. Once it is on, create the
key in the Console under **Master API keys**. Treat it as a password for your
whole account: it is not scoped to one project.
```

- [ ] **Step 4: Point the page-template guide at the reference**

In `content/docs/(guides)/advanced/page-templates.mdx`, add before the closing matter of "Where to find it":

```markdown
The same template can be managed over the API — see
[the Page templates reference](/reference/page-templates/get-page-template). The
API is experimental: the request and response shapes may still change.
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run the Task 2 Step 2 commands.
Expected: `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add "content/docs/(guides)/api/authorization.mdx" "content/docs/(guides)/advanced/page-templates.mdx" tests/content.test.mjs
git commit -m "docs(guides): master keys, and page templates over the API"
```

---

## After the tasks

1. Backend PR → merge → the push to `main` deploys staging.
2. Confirm staging serves 38 operations: `curl -s https://dynalinks.ovh/api/v1/openapi.json | jq '.paths|map(.[])|length'` → `38`.
3. Docs PR (CI builds against staging) → merge → `main` deploys the reference to GitHub Pages.
4. One production release carrying both; then rebuild the docs site (by hand until `DOCS_DISPATCH_TOKEN` exists) and check one page per new group on `docs.dynalinks.app`.
5. Whole-branch review with a fresh reviewer before any merge.
