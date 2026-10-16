# Unified docs site with self-hosted API reference — design

Issue: dynalinks/dynalinks-backend#195

## Why

The API reference is hosted on ReadMe (dynalinks.readme.io), separate from the
guides on docs.dynalinks.app. We want:

- one docs site that holds both the guides and the API reference;
- a modern look for both. The current Jekyll site (just-the-docs theme) looks
  clumsy. Reference points the owner likes: docs.miget.com (built on Mintlify)
  and docs.stripe.com;
- no more depending on a hosted docs vendor. Today ReadMe's "Try it" sends
  customers' API keys through ReadMe's proxy.

## Goals

- docs.dynalinks.app rebuilt with **Fumadocs**, in the style of Miget and Stripe:
  sidebar nav, content in the middle, table of contents on the right, ⌘K search,
  dark mode, and "Guides" / "API reference" as top-level tabs.
- The API reference is part of that site, generated from the OpenAPI spec the
  backend serves, with a working "Try it" for every endpoint.
- The backend is the single source of the spec (`docs/dynalinks.yaml`) and
  serves a cleaned, public version of it.
- ReadMe shut down, with its old URLs sent to the new reference.

## Non-goals

- Rewriting guide content. Pages are moved over as they are. Only the layout,
  front matter and links change.
- Documenting the Page Templates API publicly, for now.
- Documenting master-API-key features. Projects and API keys endpoints are
  hidden from the public reference. How the one master-key customer gets
  their docs is deliberately left open.
- A staging copy of the docs site.

## Anti-goals

- Using a hosted docs vendor again (Mintlify, GitBook, ReadMe, …).
- Any "Try it" proxy, telemetry or third-party CDN that sees customer
  requests or API keys.
- Breaking existing links: old docs.dynalinks.app URLs, dynalinks.readme.io
  URLs, and links from the app and blog posts.

## Current state

- Guides: `pzmudzinski/dynalinks-docs`, Jekyll + just-the-docs on GitHub
  Pages, custom domain docs.dynalinks.app via `CNAME`. 40 Markdown pages in
  collections (`_start`, `_links`, `_api`, `_ios`, `_android`, `_flutter`,
  `_react_native`, `_deferred`, `_fallbacks`, `_analytics`, `_integrations`,
  `_advanced`, `_team`). Colour scheme `dynalinks` in `_sass`.
- New repo: `dynalinks/dynalinks-docs` is empty. A local clone is at
  `~/Projects/dynalinks-docs`.
- Spec: `docs/dynalinks.yaml` in the backend. `servers` is hard-coded to
  `https://dynalinks.app/api/v1`. It defines two auth schemes: `api_key` in the
  query string and `Authorization` in a header. It has no `operationId`s.
- Upload: `.github/workflows/readme.yml` pushes the spec to ReadMe on every
  push to `production`.
- CORS: `config/initializers/cors.rb` allows any origin with methods
  `get, post, patch, put, options`, so no DELETE. `OPTIONS /api/v1/*` is also
  routed to `Api::V1::CorsController#preflight_check`. The API authenticates
  only with the API key, not with cookies or sessions, so opening CORS to any
  origin gives no extra access.

## Design

### Part 1: Backend serves the public spec (dynalinks-backend)

1. **Fix the Android app paths.** `PATCH` and `DELETE /android_apps/{id}` are
   currently nested under `/links/{id}/qr` (`docs/dynalinks.yaml` ~1825 and
   ~1902). Move them back under `/android_apps/{id}`.
2. **Mark internal parts with `x-internal: true`** in `docs/dynalinks.yaml`:
   - every Projects and API keys operation (master key only);
   - every `/page_template/*` operation (9 in total). The feature is only
     enabled for some projects, so we don't promote it yet;
   - `GET /links/{id}/qr`.
   Remove the master-access note from `info.description`.
   Add a line to the API Changes section of `CLAUDE.md` saying that
   master-key and unpromoted endpoints must be marked `x-internal: true`.
3. **Add `operationId` to every operation.** The new reference uses them in
   URLs, and they must not change after launch. Use readable names in
   camelCase, e.g. `upsertLink`, `deleteLink`, `listIosApps`.
4. **Serve `GET /api/v1/openapi.json`.** No auth needed. Built from the YAML
   with these changes:
   - every operation marked `x-internal` is removed, plus any path left
     empty, any tag no longer used, and the `x-internal` keys themselves;
   - `servers` is set to the host serving the request plus `/api/v1`, so
     staging returns dynalinks.ovh.
   Cache the result in memory and send cache headers.
5. **CORS:** add `:delete` to the allowed methods. Check that a real
   `OPTIONS` preflight for DELETE and PATCH from `https://docs.dynalinks.app`
   returns the correct `Access-Control-Allow-Methods`. The issue says it
   currently doesn't, possibly because the `preflight_check` route answers
   first. Fix whatever causes it.
6. **Tests:** the endpoint returns valid OpenAPI 3; no `x-internal` operation
   or Projects/API keys/page template path is in the response; `servers` follows the
   request host; the DELETE preflight succeeds.
7. **Nice to have:** a test comparing the spec's paths with the `/api/v1`
   routes, so an endpoint that is missing or filed under the wrong path fails
   CI. Routes used only by the SDKs stay out of the spec and go on the
   test's allowlist: `POST /links/attribute`, `POST /fingerprints` and
   `POST /fingerprints/match` *(my call)*.

### Part 2: New docs site (dynalinks-docs)

1. **Repo:** `dynalinks/dynalinks-docs`. Archive
   `pzmudzinski/dynalinks-docs` once the new site is live.
2. **Stack:** Fumadocs on Next.js, built as a static export, deployed to
   GitHub Pages with a GitHub Actions workflow. Keep the domain
   docs.dynalinks.app (`CNAME`), so there is no DNS change.
3. **Look:** Fumadocs' default layout, restyled with the Dynalinks logo,
   favicon and brand colours from the current `dynalinks` colour scheme.
   Dark mode is on. Top bar links match the current `aux_links` (Home,
   Pricing, FAQ, Console, GitHub). "API" becomes the API reference tab.
4. **Content:** all 40 pages moved to MDX. Section structure and order
   follow the current collections. Just-the-docs callouts become
   Fumadocs callouts. Images move along with their pages.
5. **Old URLs:** every current page URL redirects to its new URL. GitHub
   Pages can't send server redirects, so use static redirect pages
   (meta refresh + canonical).
6. **Search:** Fumadocs' built-in static search, covering guides and
   reference. No hosted search service.
7. **Cutover** *(my call)*: GitHub Pages lets only one repo use a custom
   domain at a time. Check the new site first at its default
   `dynalinks.github.io/dynalinks-docs` URL, including the redirects. Then,
   in one go, remove the custom domain from `pzmudzinski/dynalinks-docs`
   (Piotr owns that repo) and add it to the new repo. To roll back, reverse
   those two steps.
8. **Ship Part 2 before Part 3.** At this point the "API" link still points
   to ReadMe.

### Part 3: API reference in the docs site

1. Use `fumadocs-openapi` to generate the reference pages at build time from
   `https://dynalinks.app/api/v1/openapi.json`. One page per operation,
   grouped by tag. URLs use the `operationId`.
2. **"Try it"** (Fumadocs' playground) calls the API straight from the
   browser. No proxy. The production server is the default.
3. **Code samples** *(my call)*: Shell (curl), Node, Ruby and Python, the
   same as ReadMe.
4. **Keeping it current:** after the `deploy-production` job in
   `.github/workflows/test-build-deploy.yml` succeeds, a new step sends a
   `repository_dispatch` to `dynalinks/dynalinks-docs`, which rebuilds the
   docs. This replaces `readme.yml`. The default `GITHUB_TOKEN` can't trigger
   another repo, so a fine-grained token limited to the docs repo is stored
   as the backend secret `DOCS_DISPATCH_TOKEN` *(my call)*. Someone with
   admin rights has to create it. The docs repo also rebuilds on its own
   pushes and can be run by hand.
5. **Links:** update the guide pages that link to ReadMe (`_api/*`,
   `_links/creating_links.md`, `_links/named_vs_unnamed.md`), so that
   single-endpoint links go to the same endpoint in the new reference.
6. **Backend links:** point these at the new reference:
   - navbar `app/views/shared/_navbar.html.erb:10`
   - About `app/views/home/about.html.erb:11`
   - FAQ `app/views/home/faq.html.erb:76`
   - both API key pages in the Console
   - the link form hint `app/views/console/links/_form.html.erb:43`
   - the five blog posts in `app/blog_posts/`

### Part 4: Switch off ReadMe

1. Find out if ReadMe can redirect `/reference/*`, ideally per endpoint to
   the matching new page. If it can't, leave a single page there saying the
   reference has moved, with a link to it.
2. Delete `.github/workflows/readme.yml` and the `README_API_KEY` secret.
3. Close the ReadMe project, but only after the redirect or "moved" page is
   confirmed live.

## Left to the builder

- Exact Fumadocs/Next.js versions and the project layout.
- The `operationId` names, within the rules above.
- How the YAML is turned into JSON and cached in Rails.
- The exact colours, as long as they match the current brand.
- Page URLs in the new site, as long as every old URL redirects.
