# Fumadocs Docs Site (Plan 2 of 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** docs.dynalinks.app is rebuilt with Fumadocs in `dynalinks/dynalinks-docs`: the same guide content, a Miget/Stripe-style layout, static search, and every old URL still working.

**Architecture:** A Next.js static export scaffolded from Fumadocs' `+next+fuma-docs-mdx+static` template, serving the guides at the site root (`baseUrl: '/'`). The 37 Jekyll pages are converted once by a script into MDX under `content/docs/<section>/`. A postbuild script writes meta-refresh pages for every old URL whose path changed. GitHub Actions builds and deploys to GitHub Pages; the base path comes from `actions/configure-pages`, so the same build works at `dynalinks.github.io/dynalinks-docs` and at docs.dynalinks.app.

**Tech Stack:** Next.js 16, fumadocs-core/ui 16.17.5, fumadocs-mdx 15.4.7, Tailwind 4, Node 24, `node:test` for tests, GitHub Pages.

**Spec:** `dynalinks/dynalinks-backend` → `docs/superpowers/specs/2026-10-16-docs-site-and-api-reference-design.md` (Part 2). A copy is committed at `docs/superpowers/specs/` in this repo in Task 1.

## Global Constraints

- Repo `dynalinks/dynalinks-docs` (private, org plan Team, so Pages works). Local clone: `~/Projects/dynalinks-docs`. Old site source: `pzmudzinski/dynalinks-docs` (clone to `/tmp/old-docs`).
- Content is moved as it is: no rewriting. Only front matter, callout syntax, Liquid includes and links change.
- No hosted services: no Algolia/Orama Cloud, no Google Fonts CDN at runtime (`next/font` self-hosts), no Font Awesome CDN.
- Top bar links: Home `https://dynalinks.app`, API `https://dynalinks.readme.io` (until Plan 3), Pricing `https://dynalinks.app/pricing`, FAQ `https://dynalinks.app/faq`, Console `https://dynalinks.app/users/sign_in`, GitHub `https://github.com/dynalinks`.
- Brand: primary `#0d6efd` (hover `#0b5ed7`), dark `#212529`, font Open Sans. Logo `assets/img/logo.webp`, favicon `favicon.ico` from the old repo.
- **URL rule.** Section folder = the Jekyll collection with `_` → `-` (`react_native` → `react-native`). Page slug = file name with `_` → `-`. The URL is `/<section>/<slug>`, and the static export writes `out/<section>/<slug>.html`.
- **Old URLs** are the 38 entries of the live sitemap (listed in Task 4). Each must resolve in `out/`: either it is the new page's own file, or it is a redirect page.
- Anything that touches GitHub settings, `main`, or the old repo is confirmed with the user first (marked **STOP** below).

## Review Focus

1. **MDX parse failures from prose `{`, `}` or `<`** (page templates and Android pages contain Liquid and HTML). The build is the test: Task 3 Step 4 must build with zero MDX errors, and fixes escape characters rather than reword.
2. **Base path leaks**: under `NEXT_PUBLIC_BASE_PATH=/dynalinks-docs`, links, the search index URL, images and redirect targets must all carry the prefix. Test in Task 5.
3. **In-page anchors in old links** (`/fallbacks/fallback.html#using-a-play-store-url-as-the-android-fallback`, `/start/getting_started.html#5-test-the-link-on-a-phone`): the target heading's slug must still exist. Test in Task 3.
4. **An old URL that equals a new page file** (e.g. `/start/plans.html`) must not get a redirect page that overwrites the real page. Test in Task 4.
5. **Pages without `nav_order`** (deferred, fallbacks, team) must still appear in the sidebar, in title order like just-the-docs. Test in Task 3.

---

### Task 1: Bootstrap the repo and scaffold Fumadocs at the site root

**Files:**
- Create: everything from `npx create-fumadocs-app@16.2.22 . --template +next+fuma-docs-mdx+static --search orama --pm npm --linter biome --no-git -y`
- Delete: `app/(home)/`, `content/docs/test.mdx`
- Move: `app/docs/layout.tsx` → `app/(docs)/layout.tsx`, `app/docs/[[...slug]]/page.tsx` → `app/(docs)/[[...slug]]/page.tsx`; `app/llms.mdx/docs/[[...slug]]` → `app/llms.mdx/[[...slug]]`; `app/og/docs/[...slug]` → `app/og/[...slug]`
- Modify: `lib/shared.ts`: `appName = 'Dynalinks'`, `docsRoute = '/'`, `docsImageRoute = '/og'`, `docsContentRoute = '/llms.mdx'`, `gitConfig = { user: 'dynalinks', repo: 'dynalinks-docs', branch: 'main' }`
- Modify: `package.json`: `"name": "dynalinks-docs"`, scripts `"test": "node --test tests/"`
- Create: `tests/helpers.mjs`, `tests/build.test.mjs`, `docs/superpowers/specs/2026-10-16-docs-site-and-api-reference-design.md` (copied), this plan

**Interfaces:**
- Produces: `tests/helpers.mjs` exports `OUT` (absolute path of `out/`), `readOut(relPath: string): string`, `outFileFor(urlPath: string): string | null` (maps `/a/b` or `/a/b.html` or `/` to the existing file in `out/`, honouring the GitHub Pages rule that `/a/b` serves `a/b.html` or `a/b/index.html`; returns null if none).

- [ ] **Step 0 (STOP):** The repo has no commits and no `main`. Ask the user to approve pushing one commit (`README.md`: "Dynalinks documentation, built with Fumadocs.") straight to `main`, so PRs have a base. Then create branch `feat/fumadocs-site`.
- [ ] **Step 1:** Run the scaffold command above inside the repo, then the deletes, moves and edits. Copy the spec and this plan into `docs/superpowers/`.
- [ ] **Step 2: Write the failing test** `tests/build.test.mjs`:
  - `test('home page is at the site root')`: `outFileFor('/')` is not null, and its HTML includes `Dynalinks`.
  - `test('search index is exported')`: `outFileFor('/api/search')` is not null and parses as JSON.
  - `test('no /docs prefix')`: `outFileFor('/docs')` is null.
- [ ] **Step 3:** `npm run build && npm test`. Expected: FAIL. `content/docs/index.mdx` is the template's placeholder and doesn't mention Dynalinks.
- [ ] **Step 4:** Replace `content/docs/index.mdx` with the old `index.md` body (title `Home`), keeping its links as-is for now.
- [ ] **Step 5:** `npm run build && npm test && npm run types:check && npm run lint`. Expected: all PASS.
- [ ] **Step 6: Commit** `feat: scaffold Fumadocs static site at the site root`

### Task 2: Branding and top bar

**Files:**
- Create: `public/logo.webp`, `app/favicon.ico` (both from the old repo)
- Modify: `app/layout.tsx`: `Open_Sans` from `next/font/google` (weights 400/600/700) instead of Inter; `metadata.title.template = '%s | Dynalinks documentation'`, `metadata.metadataBase = new URL('https://docs.dynalinks.app')`
- Modify: `lib/layout.shared.tsx`: `nav.title` = logo `<img>` (height 24) + "Dynalinks"; `links` = the six top bar links from Global Constraints, with `type: 'main'` for all but GitHub (`type: 'icon'`, label "GitHub", lucide `Github` icon); drop `githubUrl`
- Modify: `app/global.css`: after the imports, set `--color-fd-primary: #0d6efd` in `:root`, `--color-fd-primary: #4d94ff` in `.dark`, and `--color-fd-primary-foreground: #ffffff`
- Test: `tests/branding.test.mjs`

- [ ] **Step 1: Write the failing tests:**
  - `test('top bar has the six links')`: the home HTML contains each of the six hrefs.
  - `test('logo and favicon are served')`: `out/logo.webp` and `out/favicon.ico` exist, and the home HTML references `logo.webp`.
  - `test('brand colour is set')`: some `out/_next/static/**/*.css` file contains `#0d6efd`.
  - `test('no external font or icon CDN')`: no file in `out/**/*.html` contains `fonts.googleapis.com` or `cdnjs.cloudflare.com`.
- [ ] **Step 2:** `npm run build && npm test`. Expected: the first three FAIL.
- [ ] **Step 3:** Make the edits above.
- [ ] **Step 4:** `npm run build && npm test && npm run types:check`. Expected: PASS. Open `npx serve out` and check light and dark mode by eye; screenshot both into the PR later.
- [ ] **Step 5: Commit** `feat: Dynalinks branding and top bar`

### Task 3: Migrate the 37 guide pages

**Files:**
- Create (then delete in Step 6): `scripts/migrate-jekyll.mjs`
- Create: `content/docs/<section>/<slug>.mdx` × 37, `content/docs/<section>/meta.json` × 13, `content/docs/meta.json`, `public/img/preview.jpg`, `redirects.json`
- Create: `components/pro-feature.tsx`, `components/coming-soon.tsx`; register both in `components/mdx.tsx`
- Test: `tests/content.test.mjs`

**Interfaces:**
- Produces: `redirects.json`, a JSON object `{ "<old path>": "<new path>" }` for all 38 old URLs (including identities like `"/start/plans.html": "/start/plans"` and `"/": "/"`). Task 4 consumes it.
- Produces: `<ProFeature message?: string />` renders a Fumadocs `Callout` titled "Pro feature" with `message` or "This functionality is only available on the Pro plan."; `<ComingSoon />` renders a small yellow "Coming soon" badge.

- [ ] **Step 1: Write the failing tests** in `tests/content.test.mjs`:
  - `test('every old page has a new page')`: for each value in `redirects.json`, `outFileFor(value)` is not null.
  - `test('every internal link resolves')`: for each `out/**/*.html`, every `href` starting with `/` (minus `/_next`, `/api/search`, `/og`, `/llms`) resolves with `outFileFor`. Failure lists `page → href`.
  - `test('old in-page anchors still exist')`: `/fallbacks/fallback` has `id="using-a-play-store-url-as-the-android-fallback"`, and `/start/getting-started` has `id="5-test-the-link-on-a-phone"`.
  - `test('sidebar lists every page')`: the home HTML links to all 37 page URLs (the sidebar is server-rendered).
  - `test('no Jekyll syntax left')`: no `content/docs/**/*.mdx` matches `/\{:\s*\.|\{% include|layout: page|nav_order/`, except inside code fences.
- [ ] **Step 2:** `npm run build && npm test`. Expected: FAIL (`redirects.json` missing).
- [ ] **Step 3: Write and run `scripts/migrate-jekyll.mjs /tmp/old-docs`.** For each `_<collection>/*.md`:
  - Path and URL follow the URL rule. Write the old→new pair into `redirects.json`: the old URL is the `permalink`, or else `/<collection>/<file>.html`.
  - Front matter keeps only `title`.
  - Callouts: `{: .note }` + following `>` block → `<Callout title="Note">`; `.warning` → `<Callout type="warn" title="Warning">`; `.important` → `<Callout type="error" title="Important">`; `.highlight` → `<Callout>`. Strip the `> ` prefixes inside.
  - `{% include pro-feature-callout.md message="X" %}` → `<ProFeature message="X" />`; without `message` → `<ProFeature />`.
  - `Coming soon` + `{: .label .label-yellow }` → `<ComingSoon />`.
  - Delete `{% raw %}` / `{% endraw %}` lines. Their contents are Liquid examples in code fences and stay as they are.
  - Rewrite links: an absolute or relative `.html` link whose path is a key of the map → its new path, keeping `#anchor`. `../assets/img/preview.jpg` → `/img/preview.jpg`.
  - `meta.json` per section: `title` from the `just_the_docs.collections` names in the old `_config.yml`, with the `<i …>` icon removed and `&amp;` → `&`. `pages` sorted by `nav_order`, then by title for pages without one.
  - Root `meta.json` `pages`: `["index", "start", "ios", "android", "react-native", "flutter", "integrations", "deferred", "api", "fallbacks", "links", "analytics", "advanced", "team"]` (the old collections order).
  - Also rewrite the links in `content/docs/index.mdx`.
- [ ] **Step 4:** `npm run build`. Expected: MDX errors on prose `{`, `}` or `<` (Review Focus 1). Fix each in the `.mdx` by escaping (`\{`, `&lt;`) or wrapping in inline code where the old page already showed it as code. Repeat until the build passes.
- [ ] **Step 5:** `npm test && npm run types:check`. Expected: PASS. Fix any unresolved-link failures in the `.mdx` files, not in the test.
- [ ] **Step 6:** Delete `scripts/migrate-jekyll.mjs`. The output is the record. **Commit** `feat: migrate guide pages from Jekyll`

### Task 4: Redirect pages for changed URLs

**Files:**
- Create: `scripts/write-redirects.mjs`; `package.json` gets `"postbuild": "node scripts/write-redirects.mjs"`
- Test: `tests/redirects.test.mjs`

**Interfaces:**
- Consumes: `redirects.json` (Task 3), `outFileFor` (Task 1).
- Produces: `writeRedirects({ outDir, redirects, basePath }): string[]`, exported and also run as the script's main. It returns the old paths it wrote.

- [ ] **Step 1: Write the failing tests:**
  - `test('all 38 old URLs resolve')`: hard-code this list and check that each has `outFileFor(...) !== null`: `/`, `/advanced/appearance_settings.html`, `/advanced/apple_app_site_association.html`, `/advanced/custom_domains.html`, `/advanced/page_templates.html`, `/advanced/query_params.html`, `/advanced/root_url.html`, `/analytics/analytics_configuration.html`, `/analytics/analytics.html`, `/api/api_basics.html`, `/api/apps_api.html`, `/api/authorization.html`, `/api/checking_if_link_exists.html`, `/api/link_shortening.html`, `/api/unnamed_links.html`, `/deferred/deferred-android.html`, `/deferred/deferred-ios.html`, `/fallbacks/fallback.html`, `/fallbacks/forced_redirect.html`, `/integrations/android-debugging.html`, `/integrations/android-sdk.html`, `/integrations/android.html`, `/integrations/flutter-debugging.html`, `/integrations/flutter-sdk.html`, `/integrations/ios-debugging.html`, `/integrations/ios-privacy-compliance.html`, `/integrations/ios-sdk.html`, `/integrations/ios.html`, `/integrations/react-native-debugging.html`, `/integrations/react-native-sdk.html`, `/integrations/receiving_link_in_your_app.html`, `/links/creating_links.html`, `/links/named_vs_unnamed.html`, `/links/social_previews.html`, `/start/firebase_migration.html`, `/start/getting_started.html`, `/start/plans.html`, `/team/team_members.html`
  - `test('redirect pages point at the new page')`: for `/start/getting_started.html`, the file contains `http-equiv="refresh" content="0; url=/start/getting-started"`, `rel="canonical" href="https://docs.dynalinks.app/start/getting-started"`, and a visible link.
  - `test('a URL that is already the new page is not overwritten')`: `/start/plans.html` serves the real page (contains the sidebar), not a redirect.
  - `test('redirects keep the base path')`: `writeRedirects` into a temp dir with `basePath: '/dynalinks-docs'` writes `url=/dynalinks-docs/start/getting-started`.
- [ ] **Step 2:** `npm run build && npm test`. Expected: the redirect tests FAIL.
- [ ] **Step 3: Implement `writeRedirects`.** Skip an entry when the file for the old path already exists in `outDir`. Read `basePath` from `process.env.NEXT_PUBLIC_BASE_PATH ?? ''` in main.
- [ ] **Step 4:** `npm run build && npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: redirect old Jekyll URLs`

### Task 5: Base path and the GitHub Pages workflow

**Files:**
- Modify: `next.config.mjs`: `basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined`, `images: { unoptimized: true }`
- Modify: `components/search.tsx`: `useStaticSearch({ locale, from: \`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/search\` })`
- Modify: the logo `src` in `lib/layout.shared.tsx` and image paths in MDX if the test shows they miss the prefix
- Create: `.github/workflows/pages.yml`
- Test: `tests/base-path.test.mjs`

- [ ] **Step 1: Write the failing test.** It only runs when `process.env.NEXT_PUBLIC_BASE_PATH === '/dynalinks-docs'` and otherwise skips. It checks that, in the home HTML, every `href`/`src` starting with `/` starts with `/dynalinks-docs/`, that the search client's bundle contains `/dynalinks-docs/api/search`, and that `out/start/getting_started.html` redirects to `/dynalinks-docs/start/getting-started`.
- [ ] **Step 2:** `NEXT_PUBLIC_BASE_PATH=/dynalinks-docs npm run build && NEXT_PUBLIC_BASE_PATH=/dynalinks-docs npm test`. Expected: FAIL.
- [ ] **Step 3:** Make the config and code edits. Write `pages.yml`:
  - Triggers: `push` to `main` and `workflow_dispatch`.
  - Permissions: `contents: read`, `pages: write`, `id-token: write`. Concurrency group `pages`.
  - Build job: `actions/checkout@v6`, `actions/setup-node@v5` (`node-version: 24`, `cache: npm`), `actions/configure-pages@v5` (id `pages`), `npm ci`, then `npm run build` and `npm test`, both with `NEXT_PUBLIC_BASE_PATH: ${{ steps.pages.outputs.base_path }}`. Finally `actions/upload-pages-artifact@v3` with `path: out`.
  - Deploy job: `actions/deploy-pages@v4`, environment `github-pages`.
- [ ] **Step 4:** Run the Step 2 command, then a plain `npm run build && npm test`. Expected: both PASS.
- [ ] **Step 5: Commit** `ci: deploy to GitHub Pages with a configurable base path`
- [ ] **Step 6 (STOP):** Ask the user, then:
  1. Push the branch and open a PR to `main`.
  2. After they merge it, enable Pages with `gh api -X POST repos/dynalinks/dynalinks-docs/pages -f build_type=workflow`.
  3. Watch the deploy run to green.
  4. Report the github.io URL.

### Task 6: Cutover to docs.dynalinks.app (manual, needs Piotr)

- [ ] **Step 1: Check the github.io site** and send the user a pass/fail line for each:
  - home, three pages from different sections, dark mode;
  - ⌘K search for "deferred";
  - five old URLs from the Task 4 list redirect;
  - the logo shows.
- [ ] **Step 2 (STOP):** Piotr removes the custom domain from `pzmudzinski/dynalinks-docs`. You don't have admin there. Send him: Settings → Pages → Custom domain → Remove.
- [ ] **Step 3:** Immediately afterwards, run `gh api -X PUT repos/dynalinks/dynalinks-docs/pages -f cname=docs.dynalinks.app`. Once the certificate is issued, enable HTTPS with `-F https_enforced=true`. The DNS CNAME already points at GitHub Pages, so DNS doesn't change.
- [ ] **Step 4:** Re-run the Step 1 checks against `https://docs.dynalinks.app`.
- [ ] **Rollback:** reverse Steps 2–3. Archive the old repo only after a week without problems, and only once the user asks for it.
