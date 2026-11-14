---
title: Wedding Website
description: a password-protected wedding site built with angular, lambda@edge and aws cdk
category: technical
date: 2026-11-10
---

This is a password-protected wedding website made of three prerendered [Angular](https://angular.dev/) apps served from one private S3 bucket through CloudFront. A Lambda@Edge function checks every request for a valid guest token before anything is served. A small API on API Gateway and Lambda handles login, after-party access and RSVPs, and AWS CDK defines all of it. [This blog post](/blog/2026/cs-wedding-site/) covers how it was built.

Check out the demo site for an "anonymized" version of the original site and the GitHub repo for more detailed information and extended documentation about the site. 

- Demo: [https://wedding.ineedmoreinformation.com/](https://wedding.ineedmoreinformation.com/)
- GitHub: [billythemoose/wedding-demo](https://github.com/billythemoose/wedding-demo)

## Tech Stack

| Layer | Technology |
|---|---|
| Front ends | Angular 21 (static output, every route prerendered), TypeScript 5.9, RxJS |
| UI libraries | ngx-toastr, google-libphonenumber (E.164 phone validation) |
| Hosting | Amazon S3 (private, OAC), CloudFront, ACM, Route 53 |
| Edge auth | Lambda@Edge (viewer request), Node 24 |
| API | API Gateway REST API on a custom `api.` domain, Lambda (Node 24, bundled with esbuild) |
| Data | DynamoDB (on-demand): auth tokens with TTL, RSVPs |
| Secrets | AWS Secrets Manager |
| Protection | AWS WAF (geo-block plus AWS managed rule sets), API Gateway throttling |
| Infrastructure | AWS CDK v2 in TypeScript, four stacks |
| Tests | Jest 30 with ts-jest and a mocked AWS SDK (Lambdas); Karma and Jasmine (apps) |

## Architecture

### Components

- **Three Angular apps** in one bucket: login at `/` (`login/` prefix), the main site at `/w/*` (party details, RSVP, story, travel, registry), and the hidden after-party site at `/s/*`. Both of the last two live under the `wed/` prefix.
- **Route 53 stack:** imports the existing hosted zone and issues a DNS-validated ACM certificate for the apex and a wildcard.
- **Secret stack:** imports a hand-made Secrets Manager secret holding the main and after-party passwords. Their values never appear in a template.
- **Api stack:** `POST /auth` and `POST /secret` (validate handler) and `PUT /rsvp` (RSVP handler), on stage `prod`, mapped to `api.<domain>/v1`. Login endpoints are throttled to 5 requests/second, with a burst of 10. CORS allows only the apex.
- **CloudFront stack:** private bucket with OAC, three cache behaviours, the Lambda@Edge validator on all of them, a WAF web ACL that only allows the US and Canada (plus the IP reputation, common and known-bad-inputs rule sets), and A/AAAA aliases.
- **DynamoDB:** `wedding-auth-table` (key `uuid`, 60-day TTL, fixed name because Lambda@Edge has no environment variables) and an RSVP table (key `firstName` + `lastName`).

<figure>
<svg viewBox="0 0 760 428" role="img" aria-labelledby="wa-title wa-desc" class="dg-warch" style="width:100%;height:auto">
<title id="wa-title">Wedding site architecture</title>
<desc id="wa-desc">A guest's browser reaches CloudFront through AWS WAF, which only admits traffic from the US and Canada. CloudFront has three behaviours, for the login app at /, the main site at /w/* and the after-party site at /s/*, all served from one private S3 bucket through Origin Access Control. A Lambda@Edge function runs on every viewer request and looks the guest's token up in the DynamoDB auth table. Separately, the browser calls API Gateway on api.domain/v1. A login Lambda handles POST /auth and POST /secret, reading both passwords from Secrets Manager and writing tokens to the auth table. An RSVP Lambda handles PUT /rsvp, reading the auth table and writing to the RSVP table. Route 53 holds aliases for the apex and api subdomain, and one ACM certificate covers the apex and a wildcard.</desc>
<defs><marker id="wa-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="head" d="M0 0 L10 5 L0 10 Z"/></marker></defs>
<style>
.dg-warch text{fill:var(--global-text-color);font-size:12px;text-anchor:middle}
.dg-warch .name{font-weight:500;font-size:13px}
.dg-warch .sub{fill:var(--global-text-color-light);font-size:11.5px}
.dg-warch .note{text-anchor:start;font-size:11.5px;fill:var(--global-text-color-light)}
.dg-warch .box{fill:var(--global-card-bg-color);stroke:var(--global-text-color-light);stroke-width:1}
.dg-warch .aws{fill:var(--global-card-bg-color);stroke:var(--global-theme-color);stroke-width:2}
.dg-warch .ln{stroke:var(--global-text-color-light);stroke-width:1.5;fill:none}
.dg-warch .dash{stroke:var(--global-text-color-light);stroke-width:1.5;fill:none;stroke-dasharray:4 4}
.dg-warch .life{stroke:var(--global-text-color-light);stroke-width:1;stroke-dasharray:3 4}
.dg-warch .call{stroke:var(--global-text-color);stroke-width:1.5}
.dg-warch .reply{stroke:var(--global-text-color-light);stroke-width:1.5;stroke-dasharray:5 3}
.dg-warch .head{fill:var(--global-text-color-light)}
.dg-warch .msg{paint-order:stroke;stroke:var(--global-bg-color);stroke-width:4px}
.dg-warch .frame{fill:none;stroke:var(--global-text-color-light);stroke-width:1}
.dg-warch .tag{text-anchor:start;font-size:11px;font-weight:500;fill:var(--global-text-color-light)}
</style>
<rect class="aws" x="150" y="20" width="150" height="40" rx="4"/>
<text class="name" x="225" y="40">Route 53</text>
<text class="sub" x="225" y="57">apex + api. aliases</text>
<rect class="aws" x="560" y="14" width="160" height="40" rx="4"/>
<text class="name" x="640" y="34">ACM certificate</text>
<text class="sub" x="640" y="51">apex + wildcard</text>
<path class="dash" d="M300 40 H385 V80"/>
<rect class="box" x="20" y="190" width="100" height="50" rx="4"/>
<text class="name" x="70" y="220">Guest’s browser</text>
<path class="ln" d="M120 215 H135 M135 112 V318"/>
<line class="ln" x1="135" y1="112" x2="148" y2="112" marker-end="url(#wa-arrow)"/>
<line class="ln" x1="135" y1="318" x2="148" y2="318" marker-end="url(#wa-arrow)"/>
<rect class="aws" x="150" y="90" width="110" height="44" rx="4"/>
<text class="name" x="205" y="110">AWS WAF</text>
<text class="sub" x="205" y="127">US + Canada only</text>
<line class="ln" x1="260" y1="112" x2="298" y2="112" marker-end="url(#wa-arrow)"/>
<rect class="aws" x="300" y="80" width="170" height="64" rx="4"/>
<text class="name" x="385" y="100">CloudFront</text>
<text class="sub" x="385" y="117">/  ·  /w/*  ·  /s/*</text>
<text class="sub" x="385" y="133">3 behaviours</text>
<path class="ln" d="M385 144 V164"/>
<rect class="aws" x="300" y="164" width="170" height="48" rx="4"/>
<text class="name" x="385" y="184">Lambda@Edge</text>
<text class="sub" x="385" y="201">viewer request</text>
<line class="ln" x1="470" y1="112" x2="518" y2="112" marker-end="url(#wa-arrow)"/>
<rect class="aws" x="520" y="66" width="220" height="84" rx="4"/>
<text class="name" x="630" y="86">S3 bucket (private, OAC)</text>
<text class="sub" x="630" y="103">login/  ←  /</text>
<text class="sub" x="630" y="119">wed/w/  ←  /w/*</text>
<text class="sub" x="630" y="135">wed/s/  ←  /s/*</text>
<path class="ln" d="M470 188 H752 V308 H740"/>
<text class="sub msg" x="640" y="192">GetItem</text>
<rect class="aws" x="150" y="290" width="130" height="56" rx="4"/>
<text class="name" x="215" y="310">API Gateway</text>
<text class="sub" x="215" y="327">api.&lt;domain&gt;/v1</text>
<path class="ln" d="M280 318 H300 M300 264 V354"/>
<line class="ln" x1="300" y1="264" x2="318" y2="264" marker-end="url(#wa-arrow)"/>
<line class="ln" x1="300" y1="354" x2="318" y2="354" marker-end="url(#wa-arrow)"/>
<rect class="aws" x="320" y="240" width="170" height="48" rx="4"/>
<text class="name" x="405" y="260">Login Lambda</text>
<text class="sub" x="405" y="277">POST /auth  ·  POST /secret</text>
<rect class="aws" x="320" y="330" width="170" height="48" rx="4"/>
<text class="name" x="405" y="350">RSVP Lambda</text>
<text class="sub" x="405" y="367">PUT /rsvp</text>
<path class="ln" d="M490 256 L540 254"/>
<path class="ln" d="M490 272 L540 300"/>
<path class="ln" d="M490 346 L540 318"/>
<path class="ln" d="M490 362 H540"/>
<rect class="aws" x="540" y="232" width="200" height="44" rx="4"/>
<text class="name" x="640" y="252">Secrets Manager</text>
<text class="sub" x="640" y="269">both passwords</text>
<rect class="aws" x="540" y="286" width="200" height="44" rx="4"/>
<text class="name" x="640" y="306">DynamoDB</text>
<text class="sub" x="640" y="323">wedding-auth-table · TTL</text>
<rect class="aws" x="540" y="340" width="200" height="44" rx="4"/>
<text class="name" x="640" y="360">DynamoDB</text>
<text class="sub" x="640" y="377">RSVP table</text>
<text class="note" x="20" y="414">Four CDK stacks, all in us-east-1, deployed in order: Route53 → Secret → Api → CloudFront.</text>
</svg>
</figure>

### Login sequence

<figure>
<svg viewBox="0 0 760 410" role="img" aria-labelledby="wl-title wl-desc" class="dg-wlogin" style="width:100%;height:auto">
<title id="wl-title">Login sequence</title>
<desc id="wl-desc">The login app posts the password to API Gateway at api.domain/v1/auth, which is throttled to 5 requests per second. API Gateway invokes the login Lambda, which reads both passwords from Secrets Manager on its first call and caches them for the life of the container. If the password matches, the Lambda writes a random UUID to DynamoDB with a 60-day expiry and TTL, and returns 200 with an HttpOnly, Secure, SameSite=None api-token cookie scoped to the apex domain. The browser then goes to /w/.</desc>
<defs><marker id="wl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="head" d="M0 0 L10 5 L0 10 Z"/></marker></defs>
<style>
.dg-wlogin text{fill:var(--global-text-color);font-size:12px;text-anchor:middle}
.dg-wlogin .name{font-weight:500;font-size:13px}
.dg-wlogin .sub{fill:var(--global-text-color-light);font-size:11.5px}
.dg-wlogin .note{text-anchor:start;font-size:11.5px;fill:var(--global-text-color-light)}
.dg-wlogin .box{fill:var(--global-card-bg-color);stroke:var(--global-text-color-light);stroke-width:1}
.dg-wlogin .aws{fill:var(--global-card-bg-color);stroke:var(--global-theme-color);stroke-width:2}
.dg-wlogin .ln{stroke:var(--global-text-color-light);stroke-width:1.5;fill:none}
.dg-wlogin .dash{stroke:var(--global-text-color-light);stroke-width:1.5;fill:none;stroke-dasharray:4 4}
.dg-wlogin .life{stroke:var(--global-text-color-light);stroke-width:1;stroke-dasharray:3 4}
.dg-wlogin .call{stroke:var(--global-text-color);stroke-width:1.5}
.dg-wlogin .reply{stroke:var(--global-text-color-light);stroke-width:1.5;stroke-dasharray:5 3}
.dg-wlogin .head{fill:var(--global-text-color-light)}
.dg-wlogin .msg{paint-order:stroke;stroke:var(--global-bg-color);stroke-width:4px}
.dg-wlogin .frame{fill:none;stroke:var(--global-text-color-light);stroke-width:1}
.dg-wlogin .tag{text-anchor:start;font-size:11px;font-weight:500;fill:var(--global-text-color-light)}
</style>
<rect class="box" x="20" y="16" width="120" height="34" rx="4"/><text class="name" x="80" y="38">Browser</text>
<rect class="aws" x="170" y="16" width="120" height="34" rx="4"/><text class="name" x="230" y="38">API Gateway</text>
<rect class="aws" x="320" y="16" width="120" height="34" rx="4"/><text class="name" x="380" y="38">Login Lambda</text>
<rect class="aws" x="470" y="16" width="120" height="34" rx="4"/><text class="name" x="530" y="38">Secrets Manager</text>
<rect class="aws" x="620" y="16" width="120" height="34" rx="4"/><text class="name" x="680" y="38">DynamoDB</text>
<line class="life" x1="80" y1="50" x2="80" y2="396"/><line class="life" x1="230" y1="50" x2="230" y2="396"/><line class="life" x1="380" y1="50" x2="380" y2="396"/><line class="life" x1="530" y1="50" x2="530" y2="396"/><line class="life" x1="680" y1="50" x2="680" y2="396"/>
<line class="call" x1="80" y1="88" x2="228" y2="88" marker-end="url(#wl-arrow)"/><text class="msg" x="155" y="81">POST /v1/auth · password</text>
<text class="msg sub" x="155" y="104">throttled: 5 req/s, burst 10</text>
<line class="call" x1="230" y1="138" x2="378" y2="138" marker-end="url(#wl-arrow)"/><text class="msg" x="305" y="131">invoke</text>
<line class="call" x1="380" y1="174" x2="528" y2="174" marker-end="url(#wl-arrow)"/><text class="msg" x="455" y="167">GetSecretValue</text>
<text class="msg sub" x="455" y="190">first call only, then cached</text>
<line class="reply" x1="530" y1="224" x2="382" y2="224" marker-end="url(#wl-arrow)"/><text class="msg" x="455" y="217">both passwords</text>
<line class="call" x1="380" y1="260" x2="678" y2="260" marker-end="url(#wl-arrow)"/><text class="msg" x="530" y="253">PutItem · random UUID</text>
<text class="msg sub" x="530" y="276">expire in 60 days, TTL set</text>
<line class="reply" x1="380" y1="310" x2="82" y2="310" marker-end="url(#wl-arrow)"/><text class="msg" x="230" y="303">200 · Set-Cookie: api-token=&lt;uuid&gt;</text>
<text class="msg sub" x="230" y="326">HttpOnly; Secure; SameSite=None; Domain=&lt;apex&gt;</text>
<path class="call" d="M80 360 H110 V384 H84" fill="none" marker-end="url(#wl-arrow)"/>
<text class="msg" x="118" y="376" style="text-anchor:start">go to /w/</text>
</svg>
<figcaption>A wrong password gets a 401 and no cookie. The cookie is scoped to the apex, so the browser sends it to both <code>api.</code> and the site itself.</figcaption>
</figure>

### Request sequence

<figure>
<svg viewBox="0 0 760 540" role="img" aria-labelledby="wr-title wr-desc" class="dg-wreq" style="width:100%;height:auto">
<title id="wr-title">Request sequence for a protected page</title>
<desc id="wr-desc">The browser requests a page under /w/ with its api-token cookie, through AWS WAF. CloudFront runs the Lambda@Edge function on the viewer request, before checking its cache. The function looks the token up in the DynamoDB auth table in us-east-1. If the token is valid, it rewrites the path to index.html and hands the request back to CloudFront, which serves it from the cache or, on a miss, from the private S3 bucket through Origin Access Control. A missing, unknown or expired token gets a 401. A request to /s/* without party approval gets a 302 to /w/secret, and a failed lookup gets a 500.</desc>
<defs><marker id="wr-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="head" d="M0 0 L10 5 L0 10 Z"/></marker></defs>
<style>
.dg-wreq text{fill:var(--global-text-color);font-size:12px;text-anchor:middle}
.dg-wreq .name{font-weight:500;font-size:13px}
.dg-wreq .sub{fill:var(--global-text-color-light);font-size:11.5px}
.dg-wreq .note{text-anchor:start;font-size:11.5px;fill:var(--global-text-color-light)}
.dg-wreq .box{fill:var(--global-card-bg-color);stroke:var(--global-text-color-light);stroke-width:1}
.dg-wreq .aws{fill:var(--global-card-bg-color);stroke:var(--global-theme-color);stroke-width:2}
.dg-wreq .ln{stroke:var(--global-text-color-light);stroke-width:1.5;fill:none}
.dg-wreq .dash{stroke:var(--global-text-color-light);stroke-width:1.5;fill:none;stroke-dasharray:4 4}
.dg-wreq .life{stroke:var(--global-text-color-light);stroke-width:1;stroke-dasharray:3 4}
.dg-wreq .call{stroke:var(--global-text-color);stroke-width:1.5}
.dg-wreq .reply{stroke:var(--global-text-color-light);stroke-width:1.5;stroke-dasharray:5 3}
.dg-wreq .head{fill:var(--global-text-color-light)}
.dg-wreq .msg{paint-order:stroke;stroke:var(--global-bg-color);stroke-width:4px}
.dg-wreq .frame{fill:none;stroke:var(--global-text-color-light);stroke-width:1}
.dg-wreq .tag{text-anchor:start;font-size:11px;font-weight:500;fill:var(--global-text-color-light)}
</style>
<rect class="box" x="20" y="16" width="120" height="34" rx="4"/><text class="name" x="80" y="38">Browser</text>
<rect class="aws" x="170" y="16" width="120" height="34" rx="4"/><text class="name" x="230" y="38">CloudFront</text>
<rect class="aws" x="320" y="16" width="120" height="34" rx="4"/><text class="name" x="380" y="38">Lambda@Edge</text>
<rect class="aws" x="470" y="16" width="120" height="34" rx="4"/><text class="name" x="530" y="38">DynamoDB</text>
<rect class="aws" x="620" y="16" width="120" height="34" rx="4"/><text class="name" x="680" y="38">S3 bucket</text>
<line class="life" x1="80" y1="50" x2="80" y2="526"/><line class="life" x1="230" y1="50" x2="230" y2="526"/><line class="life" x1="380" y1="50" x2="380" y2="526"/><line class="life" x1="530" y1="50" x2="530" y2="526"/><line class="life" x1="680" y1="50" x2="680" y2="526"/>
<line class="call" x1="80" y1="88" x2="228" y2="88" marker-end="url(#wr-arrow)"/><text class="msg" x="155" y="81">GET /w/travel · Cookie: api-token</text>
<text class="msg sub" x="155" y="104">through AWS WAF</text>
<line class="call" x1="230" y1="138" x2="378" y2="138" marker-end="url(#wr-arrow)"/><text class="msg" x="305" y="131">viewer request, before the cache</text>
<line class="call" x1="380" y1="174" x2="528" y2="174" marker-end="url(#wr-arrow)"/><text class="msg" x="455" y="167">GetItem uuid</text>
<text class="msg sub" x="455" y="190">in us-east-1, from any edge</text>
<line class="reply" x1="530" y1="224" x2="382" y2="224" marker-end="url(#wr-arrow)"/><text class="msg" x="455" y="217">item: expire, party</text>
<line class="reply" x1="380" y1="260" x2="232" y2="260" marker-end="url(#wr-arrow)"/><text class="msg" x="305" y="253">valid · uri → /w/travel/index.html</text>
<line class="call" x1="230" y1="296" x2="678" y2="296" marker-end="url(#wr-arrow)"/><text class="msg" x="455" y="289">cache miss: GetObject, signed by OAC</text>
<line class="reply" x1="680" y1="332" x2="232" y2="332" marker-end="url(#wr-arrow)"/><text class="msg" x="455" y="325">index.html</text>
<line class="reply" x1="230" y1="368" x2="82" y2="368" marker-end="url(#wr-arrow)"/><text class="msg" x="155" y="361">page</text>
<rect class="frame" x="30" y="392" width="420" height="132"/>
<text class="tag" x="38" y="406">otherwise</text>
<line class="reply" x1="380" y1="432" x2="82" y2="432" marker-end="url(#wr-arrow)"/><text class="msg" x="231" y="425">no cookie, unknown or expired → 401</text>
<line class="reply" x1="380" y1="468" x2="82" y2="468" marker-end="url(#wr-arrow)"/><text class="msg" x="231" y="461">/s/* without party approval → 302 /w/secret</text>
<line class="reply" x1="380" y1="504" x2="82" y2="504" marker-end="url(#wr-arrow)"/><text class="msg" x="231" y="497">lookup fails → 500</text>
</svg>
<figcaption>Requests to the login app at <code>/</code> pass straight through. <code>/w</code> and <code>/s</code> without a trailing slash get a 301 before any check. The 401 is a JSON body, not a redirect to the login page.</figcaption>
</figure>

### After-party unlock

- `POST /secret` with the second password runs a conditional `UpdateItem SET party=true` on the guest's existing token. After that, the edge function lets `/s/*` through.

## Deployment

### Infrastructure (manual)

1. **One-time:** bootstrap CDK in `us-east-1` and create the secret by hand.
2. **Deploy:** `npm run deploy` (`tsc --noEmit && cdk deploy --all`), which deploys Route53 → Secret → Api → CloudFront in order.

### Site content (manual)

1. `ng build` each app.
2. `aws s3 sync` each build to its prefix.
3. CloudFront invalidation of `/*`.
4. Run the 7-step checklist in `docs/deployment.md`.

## Estimated Cost

| Item | Estimate |
|---|---|
| AWS WAF web ACL + rules | ~$15 / month + $0.60 per million requests |
| Secrets Manager (1 secret) | ~$0.40 / month |
| Route 53 hosted zone | ~$0.50 / month |
| API Gateway | free for 12 months, then ~$3.50 per million calls |
| DynamoDB (on-demand) | pennies at wedding traffic |
| Lambda@Edge | free-ish tier |
| S3, CloudFront, ACM | free-ish tier |
| Domain registration | ~$20 |
| **Total** | ~$160 |

## Highlights

- No guest can load any page or asset, not even from the cache, without a valid token checked at the edge.
- Passwords live only in Secrets Manager. The CDK templates don't contain them, the real domain stays out of the docs, and the stacks never hard-code the account ID.
- Guests log in once and stay logged in for 60 days through an HttpOnly cookie shared between `api.` and the apex.
- A second, hidden tier unlocks on the same token.
- The WAF and API throttling protect a public login form on a tiny budget.
- Each Lambda has a Jest unit test with the AWS SDK mocked.

## Known Limitations

- No logout and no way to revoke one token. Old passwords keep working until Lambda containers recycle.
- RSVPs are keyed by name and a plus-one is saved in two separate writes.
- An expired token shows raw JSON instead of the login page.
- Every request makes a cross-region DynamoDB lookup from the edge, even for cached assets.
- The API isn't behind the WAF, and the throttle is shared by everyone.

[How it got built: blog →](/blog/2026/cs-wedding-site/)
