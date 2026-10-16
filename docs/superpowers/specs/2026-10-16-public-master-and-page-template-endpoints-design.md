# Publish the master-key and page-template endpoints in the reference — design

Issue: dynalinks/dynalinks-backend#195, part 5.

Supersedes two lines of `2026-10-16-docs-site-and-api-reference-design.md`:
"Documenting the Page Templates API publicly, for now" and "Documenting
master-API-key features" were non-goals there. They are goals now.

## Why

The reference hides 20 of the API's 38 operations. Three groups are missing
entirely (API keys, Projects, Page templates) plus the link QR image, so a
reader cannot find them at all.

They are not secret. ReadMe already listed them: `readme.yml` uploaded the spec
as-is, and `x-internal` only affects the spec the backend serves. Closing ReadMe
(part 4) would therefore *remove* public documentation that exists today. The
owner wants it kept and visible to anyone, with a note that it may still change.

## Goals

- All 20 endpoints have reference pages: their own URL, in the sidebar, in
  search, with code samples and "Try it", like the current 18.
- Each page says plainly who can call it: a master API key for API keys and
  Projects, page-template access for Page templates, a PRO project for the QR
  image. A reader with a project key must be able to tell why they got a 401.
- The note has one home. Changing the gate must not mean editing 15 pages.
- The spec stays truthful: `GET /links/{id}/qr` currently declares `security: []`
  (no auth), but the endpoint does require a key.

## Non-goals

- Changing endpoint behaviour. This is spec metadata, docs pages and tests.
- Making master keys or page-template access self-serve. Both stay switched on
  by Dynalinks (`master_api_enabled?`, `project_policy.manage_page_template?`).
- The SDK-only routes: `POST /links/attribute`, `POST /fingerprints`,
  `POST /fingerprints/match` stay out of the spec.
- ReadMe: its pages stay up, and only its upload workflow is removed (part 4a).

## Anti-goals

- A reader pastes a project key on `/reference/projects/create-project`, gets
  `401 API key is not master`, and the page never says the key has to be a
  master key.
- Re-hiding an endpoint costs a release.
- Raw markdown leaking into the prev/next footer, `og:image`, meta description
  and `llms.txt` (a known bug in this site) gets worse because the new notes use
  markdown.

## What becomes public

| Group | Operations | Key needed |
|---|---|---|
| API keys (5) | `listApiKeys`, `createApiKey`, `getApiKey`, `updateApiKey`, `deleteApiKey` | master, `projects.*` style `api_keys` scopes |
| Projects (6) | `listProjects`, `createProject`, `getProject`, `updateProject`, `deleteProject`, `verifyProjectCustomDomain` | master (`projects.index/show/create/update/delete`) |
| Page templates (8) | `getPageTemplate`, `updatePageTemplate`, `publishPageTemplate`, `unpublishPageTemplate`, `previewPageTemplate`, `listPageTemplateVersions`, `getPageTemplateVersion`, `restorePageTemplateVersion` | project key with `page_templates.*` scopes, enabled per project |
| Links (1) | `getLinkQrCode` → joins the existing Links group | project key, PRO project only |

18 + 20 = 38 operations, 22 paths, 7 groups. (Both figures are what
`docs/dynalinks.yaml` holds today; the counts are not changing, only who can see
them.)

## Decisions

**1. `x-internal` stays the promote switch.** All 20 markers come off; no
operation is internal afterwards. `PublicOpenapiSpec` keeps its stripping code
and its fixture-based unit tests, so the switch still works the day something
needs hiding again. The route test flips from "these are marked internal" to
"38 operations, 7 tags, no `x-internal` in the served JSON". `CLAUDE.md:236`,
which tells builders to mark master-key and page-template endpoints internal,
gets rewritten to match: the switch exists, nothing is behind it today.

**2. Group names come from the spec tags** — `API keys`, `Projects`,
`Page templates` — which turns into `/reference/api-keys`, `/reference/projects`,
`/reference/page-templates` by the existing slug rule. The QR operation joins
Links, where its tag already puts it.

**3. The notes are the spec's tag descriptions.** Every tag in
`docs/dynalinks.yaml` carries a one-line description today, and the reference
shows no group note at all. The reference renders a Callout above each
operation's description holding that operation's tag description, for all seven
groups. One mechanism, no list of "gated" groups in the docs repo, and the gate
travels with the spec it describes. The cost is that the four existing groups
gain their one-liner above every page, which duplicates the sidebar heading
slightly and costs nothing.

Because the Callout is uniform, the "experimental" warning belongs in the tag
descriptions too. No new extension in `docs/dynalinks.yaml`: the spec stays a
plain OpenAPI document, and the docs site carries the text onto its in-memory
copy of the document at build time if it needs to. Two mechanisms for one note
is one too many. Copy to settle in the spec:

- API keys: `Manage a project's API keys. Requires a master API key.
  Experimental: the request and response shapes may still change.`
- Projects: `Manage projects. Requires a master API key. Experimental: the
  request and response shapes may still change.`
- Page templates: `Manage the page template shown on link preview pages.
  Requires page-template access, enabled per project by Dynalinks. Experimental:
  the request and response shapes may still change.`
- The other four keep their current text.

**4. Fix `security: []` on the QR operation.** `LinksController` skips auth only
for `attribute`, so `qr` needs the key like its neighbours. Dropping the empty
`security` lets the global default apply.

**5. Order:** Links, Short links, iOS apps, Android apps, API keys, Projects,
Page templates. Project-key groups first because they are what most readers use.
Each group keeps a hand-written `meta.json` ending in `"..."`.

**6. "Try it" is unchanged.** A master key goes in the same `Authorization:
Token …` header, so the existing playground authorises master endpoints. No
proxy, no new host. The test that proves there is no proxy stays.

**7. Guides grow the missing context.** `api/authorization.mdx` gets a master-key
half: what a master key is (a key on the user, not a project), where it comes
from (Console → Master API keys, once Dynalinks enables master API access), that
it goes in the same header, and that a project key gets a 401 on those endpoints.
`advanced/page-templates.mdx` gains a pointer to the reference for the API
alongside the Console UI it already describes. The reference overview lists all
seven groups and says which key each needs.

**8. Exposing this is not a new disclosure.** ReadMe lists these endpoints today;
the audience is unchanged. The one new fact made explicit is that a master key
can mint project keys — already implied by `/api_keys` being reachable.

## Acceptance

- `curl https://dynalinks.app/api/v1/openapi.json | jq '.paths|length'` → 22,
  `.paths|map(.[])|length` → 38, `x-internal` appears nowhere.
- `/reference/api-keys/list-api-keys`, `/reference/projects/create-project`,
  `/reference/page-templates/get-page-template`,
  `/reference/links/get-link-qr-code` return 200, are in the sidebar, in search,
  and in `llms.txt`.
- Each of the 38 pages shows code samples in cURL, JavaScript, Python, Ruby.
- The three new groups' Callouts carry the master-key / page-template-access
  sentence and the experimental warning; every other page's Callout holds its
  tag's existing one-liner.
- All 38 old URLs still return 200, unchanged.

## How it ships

Backend first, because the docs build reads the spec from a URL.

1. Branch off `main`; unmark the 20 operations and edit the tag descriptions.
   Merge. The push to `main` deploys staging, which is what the docs CI builds
   against.
2. Docs branch off `main`; the new groups, the Callout, the guides and the
   tests. CI is green against staging's spec.
3. One production release carrying both. After it, the docs site rebuilds (by
   hand until `DOCS_DISPATCH_TOKEN` exists) so the reference serves production's
   host in "Try it".

Stops: the same as the earlier parts — no merge, release or secret without the
owner's word.
- Guides and reference agree on `Authorization: Token <key>`.

## Left to the builder

- How the tag description reaches the page (page metadata at generation time
  from `lib/openapi.ts`, or the layout's render context). Either way it is read
  from the spec, not copied into the docs repo.
- The Callout's exact component and whether it sits above or below the
  operation's own description.
- Whether the QR page's "Try it" is worth keeping; the default response is
  `svg`. Reasonable to leave it.
- `meta.json` entry order inside each new group.
