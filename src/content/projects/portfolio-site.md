---
title: Portfolio Site
description: this site, built with astro and served from s3 and cloudfront
category: technical
date: 2026-11-04
repo: https://github.com/billythemoose/portfolio
---

This site is a static [Astro](https://astro.build/) site served from Amazon S3 and CloudFront at `ineedmoreinformation.com`. Every push to `master` is checked, built and deployed by GitHub Actions in under a minute, without any stored AWS credentials. It started as a Jekyll site on GitHub Pages; [this blog post](/blog/2026/cs-portfolio-rebuild/) covers how and why it moved.

## Tech Stack

| Layer | Technology |
|---|---|
| Site | Astro 7 (static output), TypeScript 6 |
| Content | Markdown and YAML in content collections, with front matter validated by Zod schemas |
| Styling | Tailwind CSS 4, self-hosted Roboto, Font Awesome icons rendered to inline SVG at build time |
| Markdown | Astro's Sätteri processor, Shiki syntax highlighting with light and dark themes |
| Hosting | Amazon S3 (private), CloudFront, ACM, Route 53 |
| Infrastructure | AWS CDK in TypeScript |
| CI/CD | GitHub Actions, GitHub OIDC to an IAM role |
| Upkeep | Dependabot, with grouped weekly and monthly updates |

## Architecture

### Components

- **Route 53** holds the domain's hosted zone. The stack imports the zone instead of creating it, so deleting the stack can never delete DNS. Apex and `www` both have IPv4 and IPv6 alias records pointing to CloudFront.
- **CloudFront** serves HTTPS with HTTP/2 and HTTP/3, adds AWS's managed security headers, and uses the cheapest price class (North America and Europe edge locations). An ACM certificate covers the apex and `*.` wildcard, so future demo subdomains can share it. It lives in `us-east-1`, as CloudFront requires.
- **A CloudFront Function** runs on every request. It redirects `www` to the apex, adds a trailing slash to extensionless paths, and maps `/foo/` to `/foo/index.html`, since S3 has no directory indexes.
- **The S3 bucket** blocks all public access, enforces TLS and is encrypted at rest. Only CloudFront can read it, through Origin Access Control. CloudFront's access doesn't include listing the bucket, so S3 answers a missing key with 403, and CloudFront serves `404.html` for both 403 and 404. The bucket is kept if the stack is ever deleted.
- **An AWS Budget** emails me at 80% of actual and 100% of forecasted monthly spend.


### Request sequence

<figure>
<svg viewBox="0 0 760 448" role="img" aria-labelledby="rq-title rq-desc" class="dg-req" style="width:100%;height:auto">
<title id="rq-title">Request sequence when a visitor loads a page</title>
<desc id="rq-desc">The browser resolves the domain in Route 53, which returns the nearest CloudFront edge. The browser requests the page over HTTPS. A CloudFront Function rewrites the path to an index.html key. On a cache miss CloudFront fetches the object from the private S3 bucket through Origin Access Control, then returns the HTML with security headers. Hashed assets are then served from the edge cache.</desc>
<defs><marker id="rq-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="head" d="M0 0 L10 5 L0 10 Z"/></marker></defs>
<style>
.dg-req text{fill:var(--global-text-color);font-size:12px;text-anchor:middle}
.dg-req .name{font-weight:500;font-size:13px}
.dg-req .box{fill:var(--global-card-bg-color);stroke:var(--global-text-color-light);stroke-width:1}
.dg-req .aws{fill:var(--global-card-bg-color);stroke:var(--global-theme-color);stroke-width:2}
.dg-req .life{stroke:var(--global-text-color-light);stroke-width:1;stroke-dasharray:3 4}
.dg-req .call{stroke:var(--global-text-color);stroke-width:1.5}
.dg-req .reply{stroke:var(--global-text-color-light);stroke-width:1.5;stroke-dasharray:5 3}
.dg-req .head{fill:var(--global-text-color-light)}
.dg-req .msg{paint-order:stroke;stroke:var(--global-bg-color);stroke-width:4px}
</style>
<rect class="box" x="20" y="16" width="120" height="34" rx="4"/><text class="name" x="80" y="38">Browser</text>
<rect class="aws" x="170" y="16" width="120" height="34" rx="4"/><text class="name" x="230" y="38">Route 53</text>
<rect class="aws" x="320" y="16" width="120" height="34" rx="4"/><text class="name" x="380" y="38">CloudFront</text>
<rect class="aws" x="470" y="16" width="120" height="34" rx="4"/><text class="name" x="530" y="38">CF Function</text>
<rect class="aws" x="620" y="16" width="120" height="34" rx="4"/><text class="name" x="680" y="38">S3 bucket</text>
<line class="life" x1="80" y1="50" x2="80" y2="434"/><line class="life" x1="230" y1="50" x2="230" y2="434"/><line class="life" x1="380" y1="50" x2="380" y2="434"/><line class="life" x1="530" y1="50" x2="530" y2="434"/><line class="life" x1="680" y1="50" x2="680" y2="434"/>
<line class="call" x1="80" y1="88" x2="228" y2="88" marker-end="url(#rq-arrow)"/><text class="msg" x="155" y="81">DNS lookup, A / AAAA</text>
<line class="reply" x1="230" y1="124" x2="82" y2="124" marker-end="url(#rq-arrow)"/><text class="msg" x="155" y="117">alias → nearest edge</text>
<line class="call" x1="80" y1="160" x2="378" y2="160" marker-end="url(#rq-arrow)"/><text class="msg" x="230" y="153">GET /blog/ · TLS with ACM certificate</text>
<line class="call" x1="380" y1="196" x2="528" y2="196" marker-end="url(#rq-arrow)"/><text class="msg" x="455" y="189">viewer request</text>
<line class="reply" x1="530" y1="232" x2="382" y2="232" marker-end="url(#rq-arrow)"/><text class="msg" x="455" y="225">/blog/index.html</text>
<line class="call" x1="380" y1="268" x2="678" y2="268" marker-end="url(#rq-arrow)"/><text class="msg" x="530" y="261">cache miss: GetObject, signed by OAC</text>
<line class="reply" x1="680" y1="304" x2="382" y2="304" marker-end="url(#rq-arrow)"/><text class="msg" x="530" y="297">index.html</text>
<line class="reply" x1="380" y1="340" x2="82" y2="340" marker-end="url(#rq-arrow)"/><text class="msg" x="230" y="333">HTML + security headers · HTTP/2 or 3</text>
<line class="call" x1="80" y1="376" x2="378" y2="376" marker-end="url(#rq-arrow)"/><text class="msg" x="230" y="369">GET /_astro/* (CSS, fonts)</text>
<line class="reply" x1="380" y1="412" x2="82" y2="412" marker-end="url(#rq-arrow)"/><text class="msg" x="230" y="405">from edge cache · 1 year, immutable</text>
</svg>
<figcaption>On a cache hit CloudFront answers from the edge and never calls S3. Requests for <code>www</code> or a path without a trailing slash get a 301 from the Function instead of a rewrite.</figcaption>
</figure>

</br>


## Deployment

### Site changes (automatic)

1. **Pull request:** GitHub Actions installs dependencies with `npm ci`, type-checks with `astro check`, builds, and runs a URL check that fails if any page from the original site is missing from the build. Nothing deploys.
2. **Merge to `master`:** the same checks run, then the deploy job starts. A newer push cancels a deploy that's still running, so only the latest commit goes out.
3. **Sign in:** the deploy job asks GitHub for an OIDC token and exchanges it with AWS STS for one-hour credentials. The IAM role only accepts tokens for this repository's immutable owner and repo IDs on `master`. A renamed repo, a fork, or a new repo reusing the name can't assume it.
4. **Upload:** `aws s3 sync --delete` uploads the build twice. The `_astro/` assets have content-hashed names and get a one-year immutable cache. Everything else (HTML, feeds, the resume PDF) tells browsers to revalidate and lets CloudFront cache it for a day.
5. **Invalidate:** a CloudFront invalidation of `/*` makes the new HTML live at the edge within a minute or so.

The deploy role can list, put and delete objects in the site bucket and invalidate the site distribution, and nothing else. The role ARN, bucket and distribution ID are repository secrets, so GitHub masks them in the public logs.

### Infrastructure changes (manual, rare)

The infrastructure is a CDK app in [`infra/`](https://github.com/billythemoose/portfolio/tree/master/infra).

1. **Configure:** account-specific settings live in a gitignored `infra/.env`: domain, hosted zone, the repository in its immutable `owner@ownerId/repo@repoId` form, deploy branch, and budget. `infra/.env.example` lists them. The app checks every value before it builds a template, and rejects a plain `owner/repo`.
2. **Review:** `npx cdk diff` shows exactly what will change.
3. **Apply:** `npx cdk deploy` with an AWS profile. The stack has termination protection, and the template never contains the account ID.
4. **First deploy only:** copy the three stack outputs (bucket name, distribution ID, deploy role ARN) into the repository secrets the workflow reads.


### Deploy sequence

<figure>
<svg viewBox="0 0 760 340" role="img" aria-labelledby="sq-title sq-desc" class="dg-seq" style="width:100%;height:auto">
<title id="sq-title">Deploy sequence on a push to master</title>
<desc id="sq-desc">GitHub Actions requests an OIDC token from GitHub, exchanges it with AWS STS for temporary credentials, syncs hashed assets and then everything else to S3, and creates a CloudFront invalidation.</desc>
<defs><marker id="sq-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="head" d="M0 0 L10 5 L0 10 Z"/></marker></defs>
<style>
.dg-seq text{fill:var(--global-text-color);font-size:12px;text-anchor:middle}
.dg-seq .name{font-weight:500;font-size:13px}
.dg-seq .box{fill:var(--global-card-bg-color);stroke:var(--global-text-color-light);stroke-width:1}
.dg-seq .aws{fill:var(--global-card-bg-color);stroke:var(--global-theme-color);stroke-width:2}
.dg-seq .life{stroke:var(--global-text-color-light);stroke-width:1;stroke-dasharray:3 4}
.dg-seq .call{stroke:var(--global-text-color);stroke-width:1.5}
.dg-seq .reply{stroke:var(--global-text-color-light);stroke-width:1.5;stroke-dasharray:5 3}
.dg-seq .head{fill:var(--global-text-color-light)}
.dg-seq .msg{paint-order:stroke;stroke:var(--global-bg-color);stroke-width:4px}
.dg-seq .step{fill:var(--global-text-color-light);font-size:11px;text-anchor:start}
</style>
<rect class="box" x="20" y="16" width="120" height="34" rx="4"/><text class="name" x="80" y="38">GitHub Actions</text>
<rect class="box" x="170" y="16" width="120" height="34" rx="4"/><text class="name" x="230" y="38">GitHub OIDC</text>
<rect class="aws" x="320" y="16" width="120" height="34" rx="4"/><text class="name" x="380" y="38">AWS STS</text>
<rect class="aws" x="470" y="16" width="120" height="34" rx="4"/><text class="name" x="530" y="38">S3 bucket</text>
<rect class="aws" x="620" y="16" width="120" height="34" rx="4"/><text class="name" x="680" y="38">CloudFront</text>
<line class="life" x1="80" y1="50" x2="80" y2="326"/><line class="life" x1="230" y1="50" x2="230" y2="326"/><line class="life" x1="380" y1="50" x2="380" y2="326"/><line class="life" x1="530" y1="50" x2="530" y2="326"/><line class="life" x1="680" y1="50" x2="680" y2="326"/>
<line class="call" x1="80" y1="88" x2="228" y2="88" marker-end="url(#sq-arrow)"/><text class="msg" x="155" y="81">request token</text>
<line class="reply" x1="230" y1="124" x2="82" y2="124" marker-end="url(#sq-arrow)"/><text class="msg" x="162" y="117">JWT, subject = repo IDs</text>
<line class="call" x1="80" y1="160" x2="378" y2="160" marker-end="url(#sq-arrow)"/><text class="msg" x="230" y="153">AssumeRoleWithWebIdentity</text>
<line class="reply" x1="380" y1="196" x2="82" y2="196" marker-end="url(#sq-arrow)"/><text class="msg" x="230" y="189">temporary credentials (1 hour)</text>
<line class="call" x1="80" y1="232" x2="528" y2="232" marker-end="url(#sq-arrow)"/><text class="msg" x="305" y="225">sync _astro/ · cache 1 year, immutable</text>
<line class="call" x1="80" y1="268" x2="528" y2="268" marker-end="url(#sq-arrow)"/><text class="msg" x="305" y="261">sync everything else · revalidate</text>
<line class="call" x1="80" y1="304" x2="678" y2="304" marker-end="url(#sq-arrow)"/><text class="msg" x="380" y="297">create invalidation /*</text>
</svg>
</figure>

</br>

## Estimated Cost

| Item | Estimate |
|---|---|
| Route 53 hosted zone | $0.50 / month |
| Domain registration (`.com`) | about $15 / year (~$1.25 / month) |
| CloudFront requests, transfer and Function invocations | $0, inside the always-free tier |
| S3 storage and requests (under 2 MB stored) | a few cents |
| ACM certificate, DNS alias queries, invalidations, the budget | $0 |
| **Total** | **about $1.75 / month** |

The original GitHub Pages site cost nothing. The new cost is almost entirely the domain. Estimates use AWS list prices as of November 2026.

## Highlights

- Blog posts, projects and the CV live in type-checked content collections, so bad front matter fails the build instead of breaking a page.
- Every page is static HTML. The only client-side JavaScript is the theme toggle, the mobile menu and the reading progress bar, and the site makes no third-party requests.
- The build needs only Node. The Ruby, Python and ImageMagick dependencies from the Jekyll setup are gone.
- CI checks that every URL from the old site still resolves.
- Deploys use short-lived OIDC credentials and a least-privilege role tied to immutable repository IDs. No AWS keys are stored in GitHub.
- Cache headers are split by file type, so repeat visitors re-download only what changed.

[How it got here: blog →](/blog/2026/cs-portfolio-rebuild/)
