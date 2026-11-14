---
title: Building the Wedding Website
date: 2026-11-10 12:00:00
description: a password-protected wedding site on angular, lambda@edge and aws cdk
tags: angular typescript aws cdk lambda
categories: project
---

## One-Line Summary

What started out as a simple wedding announcement page slowly morphed into a multi-staged password-protected registration and wedding party coordination site. 

## Why Build It

1. **I was bored**. Sure, there was a ton of other planning and work that needed to be done, but why not procrastinate a little and make a simple website for fun?
2. **Try to save money**. There are free, or mostly free, website hosting options readily available but I thought it would be more fun to see if creating it myself would be at or under the price of the "competition". 
3. **It's fun**. If you do it yourself, you have full creative freedom to create your own problems, problem solve, and see how much you can shitpost. Sounded good to me.

Check it out yourself if you're *real* bored. 
- Demo: [https://wedding.ineedmoreinformation.com/](https://wedding.ineedmoreinformation.com/)
- GitHub: [billythemoose/wedding-demo](https://github.com/billythemoose/wedding-demo)


## Constraints
- **Static hosting**. See what still functions and what constraints happen with static hosting.

No real plan outside of that. See what happens as the build progresses and figure out how to make it work. 

## Process

The site grew in four stages. Each one added a feature, and most of them added a piece of AWS to support it.

| Stage | Front end | AWS added |
|---|---|---|
| 1. Announcement | one Angular app | S3, CloudFront, Route 53 |
| 2. Gated site | login app at `/`, main site at `/w/` | Lambda@Edge, API Gateway, a Lambda for login, DynamoDB token table, Secrets Manager, WAF, ACM, all moved into CDK |
| 3. Registration | RSVP form | a Lambda for RSVPs, DynamoDB RSVP table |
| 4. After party | after-party app at `/s/` | a third CloudFront behaviour, `POST /secret`, a party flag on the token |

### 1. Initial public announcement page

The first version was a single public page with the announcement on it. It was meant as a public message about the marriage. More formal invitations would go out later, so the page didn't need to carry any details.

The first version was an Angular app with a photo, a nav bar and a background. Hosting was as simple as it gets: the built files in an S3 bucket with CloudFront in front of it for HTTPS and caching.

**Architecture at this stage:**

- One Angular app, built to static files
- An S3 bucket holding the build
- CloudFront in front of the bucket for HTTPS and caching
- A Route 53 alias record pointing the domain at CloudFront

<figure>
<svg viewBox="0 0 760 165" role="img" aria-labelledby="ws1-title ws1-desc" class="dg-ws1" style="width:100%;height:auto">
<title id="ws1-title">Stage 1 architecture: the public announcement</title>
<desc id="ws1-desc">A guest's browser requests the domain. Route 53 points it at CloudFront, which serves the built Angular app from an S3 bucket over HTTPS with caching.</desc>
<style>
.dg-ws1 text{fill:var(--global-text-color);font-size:13px;text-anchor:middle}
.dg-ws1 .t{font-weight:500}
.dg-ws1 .sub{fill:var(--global-text-color-light);font-size:11.5px}
.dg-ws1 .hl{fill:var(--global-theme-color)}
.dg-ws1 .lg{text-anchor:start;font-size:12px;fill:var(--global-text-color-light)}
.dg-ws1 .note{text-anchor:start;font-size:11.5px;fill:var(--global-text-color-light)}
.dg-ws1 .box{fill:var(--global-card-bg-color);stroke:var(--global-text-color-light);stroke-width:1}
.dg-ws1 .new{fill:var(--global-card-bg-color);stroke:var(--global-theme-color);stroke-width:2}
.dg-ws1 .ln{stroke:var(--global-text-color-light);stroke-width:1.5;fill:none}
.dg-ws1 .dash{stroke:var(--global-text-color-light);stroke-width:1.5;fill:none;stroke-dasharray:4 4}
.dg-ws1 .hd{fill:var(--global-text-color-light)}
</style>
<rect class="new" x="560" y="16" width="16" height="12" rx="2"/>
<text class="lg" x="584" y="27">Added in this stage</text>
<rect class="new" x="150" y="20" width="150" height="40" rx="4"/>
<text class="t" x="225" y="45">Route 53</text>
<path class="dash" d="M300 40 H385 V80"/>
<rect class="box" x="20" y="87" width="100" height="50" rx="4"/>
<text class="t" x="70" y="117">Guest’s browser</text>
<path class="ln" d="M120 112 H296"/>
<path class="hd" d="M300 112 L290 107 L290 117 Z"/>
<rect class="new" x="300" y="80" width="170" height="64" rx="4"/>
<text class="t" x="385" y="100">CloudFront</text>
<text class="sub" x="385" y="117">HTTPS + caching</text>
<path class="ln" d="M470 112 H516"/>
<path class="hd" d="M520 112 L510 107 L510 117 Z"/>
<rect class="new" x="520" y="80" width="220" height="64" rx="4"/>
<text class="t" x="630" y="100">S3 bucket</text>
<text class="sub" x="630" y="117">Angular build</text>
</svg>
</figure>


### 2. Pivot to hosting all information

Why not actually host all the wedding party information on the site?

Over the next couple of weeks the one page became a full site: home, story, travel, registry and RSVP pages, with a hamburger menu for mobile.

All of that information needed to be gated, so authentication came next. The first attempt was a login page inside the same app with an Angular route guard in front of every other page. That hid the information without protecting it. A route guard only decides what the Angular router renders. Every page, image and script was still in the bucket, and CloudFront would serve any of them to anyone who asked for the URL directly.

The fix was to move the check into CloudFront. That caused the split into a second "app", with edge validation to separate the assets being served. CloudFront chooses how to handle a request by its path, so the public part and the protected part had to live under different paths:

- **Login app at `/`:** public, served from the bucket's `login/` prefix. It's a single password form, and the only thing anyone can load without a cookie.
- **Main site at `/w/*`:** served from the `wed/` prefix, with Angular's `baseHref` set to `/w/` so its links and assets resolve under that path.

Both apps live in one private S3 bucket. CloudFront reads it through Origin Access Control, and all public access is blocked. The client-side route guards and the in-app login page were deleted in the same change that added the edge check.

**Architecture added at this stage:**

- **Lambda@Edge**, on the *viewer request* event, so it runs before CloudFront checks its cache. For `/w/*` it reads the `api-token` cookie and looks it up in DynamoDB. It returns a 401 if the token is missing, unknown or expired. It also rewrites folder-style URLs to `index.html`, since S3 has no directory indexes.
- **API Gateway and a login Lambda** on an `api.` subdomain. `POST /auth` compares the submitted password against one stored in **Secrets Manager**. If it matches, the Lambda stores a random UUID in a **DynamoDB** table with a 60-day expiry and a TTL. It then returns the UUID as an `HttpOnly`, `Secure` cookie scoped to the parent domain, so the edge function on the apex can read a cookie set by `api.`.
- **AWS WAF** on the distribution because the login form is public. It only allows traffic from the US and Canada and adds AWS's managed IP reputation, common and known-bad-inputs rule sets.
- **An ACM certificate** for the apex and a wildcard, covering both the site and `api.`.
- **CDK.** All of it moved into four stacks, deployed in order: Route 53 → Secret → Api → CloudFront. Everything is in `us-east-1`, because Lambda@Edge, CloudFront certificates and CloudFront-scoped WAF all require it. The password secret is created by hand and imported, so its value never appears in a template.

Caching started out disabled while the edge function was being debugged, and was turned on (`CachingOptimized`) a few days later. That was safe because the token check runs before the cache. A cached page still can't be served without a valid cookie.

The move to S3 hosting also shrank the photos from about 3.5–4 MB each to about 700 KB.

<figure>
<svg viewBox="0 0 760 388" role="img" aria-labelledby="ws2-title ws2-desc" class="dg-ws2" style="width:100%;height:auto">
<title id="ws2-title">Stage 2 architecture: the gated site</title>
<desc id="ws2-desc">Requests to the domain pass through AWS WAF, which only admits US and Canadian traffic, to CloudFront. CloudFront serves the login app at / and the main site at /w/* from one private S3 bucket. A Lambda@Edge function checks the guest's token cookie against a DynamoDB token table before serving /w/*. The login form posts to API Gateway on the api subdomain, where a login Lambda checks the password in Secrets Manager and writes a token to DynamoDB. Everything is defined in four CDK stacks in us-east-1.</desc>
<style>
.dg-ws2 text{fill:var(--global-text-color);font-size:13px;text-anchor:middle}
.dg-ws2 .t{font-weight:500}
.dg-ws2 .sub{fill:var(--global-text-color-light);font-size:11.5px}
.dg-ws2 .hl{fill:var(--global-theme-color)}
.dg-ws2 .lg{text-anchor:start;font-size:12px;fill:var(--global-text-color-light)}
.dg-ws2 .note{text-anchor:start;font-size:11.5px;fill:var(--global-text-color-light)}
.dg-ws2 .box{fill:var(--global-card-bg-color);stroke:var(--global-text-color-light);stroke-width:1}
.dg-ws2 .new{fill:var(--global-card-bg-color);stroke:var(--global-theme-color);stroke-width:2}
.dg-ws2 .ln{stroke:var(--global-text-color-light);stroke-width:1.5;fill:none}
.dg-ws2 .dash{stroke:var(--global-text-color-light);stroke-width:1.5;fill:none;stroke-dasharray:4 4}
.dg-ws2 .hd{fill:var(--global-text-color-light)}
</style>
<rect class="new" x="560" y="16" width="16" height="12" rx="2"/>
<text class="lg" x="584" y="27">Added in this stage</text>
<rect class="box" x="150" y="20" width="150" height="40" rx="4"/>
<text class="t" x="225" y="40">Route 53</text>
<text class="sub hl" x="225" y="57">apex + api. records</text>
<path class="dash" d="M300 40 H385 V80"/>
<rect class="box" x="20" y="190" width="100" height="50" rx="4"/>
<text class="t" x="70" y="220">Guest’s browser</text>
<path class="ln" d="M120 215 H135 M135 112 V318 M135 112 H146 M135 318 H146"/>
<path class="hd" d="M150 112 L140 107 L140 117 Z"/>
<path class="hd" d="M150 318 L140 313 L140 323 Z"/>
<rect class="new" x="150" y="90" width="110" height="44" rx="4"/>
<text class="t" x="205" y="110">WAF</text>
<text class="sub" x="205" y="127">US + Canada only</text>
<path class="ln" d="M260 112 H296"/>
<path class="hd" d="M300 112 L290 107 L290 117 Z"/>
<rect class="box" x="300" y="80" width="170" height="64" rx="4"/>
<text class="t" x="385" y="100">CloudFront</text>
<text class="sub hl" x="385" y="117">/  ·  /w/*</text>
<path class="ln" d="M385 144 V164"/>
<rect class="new" x="300" y="164" width="170" height="48" rx="4"/>
<text class="t" x="385" y="184">Lambda@Edge</text>
<text class="sub" x="385" y="201">token check</text>
<path class="ln" d="M470 112 H516"/>
<path class="hd" d="M520 112 L510 107 L510 117 Z"/>
<rect class="box" x="520" y="70" width="220" height="64" rx="4"/>
<text class="t" x="630" y="90">S3 bucket (private)</text>
<text class="sub hl" x="630" y="108">login/  ←  /</text>
<text class="sub hl" x="630" y="125">wed/w/  ←  /w/*</text>
<path class="ln" d="M470 188 H752 V308 H740"/>
<rect class="new" x="150" y="290" width="130" height="56" rx="4"/>
<text class="t" x="215" y="310">API Gateway</text>
<text class="sub" x="215" y="327">api.&lt;domain&gt;</text>
<path class="ln" d="M280 318 H300 M300 264 V318 M300 264 H316"/>
<path class="hd" d="M320 264 L310 259 L310 269 Z"/>
<rect class="new" x="320" y="240" width="170" height="48" rx="4"/>
<text class="t" x="405" y="260">Login Lambda</text>
<text class="sub" x="405" y="277">POST /auth</text>
<path class="ln" d="M490 256 L540 254"/>
<path class="ln" d="M490 272 L540 300"/>
<rect class="new" x="540" y="232" width="200" height="44" rx="4"/>
<text class="t" x="640" y="252">Secrets Manager</text>
<text class="sub" x="640" y="269">guest password</text>
<rect class="new" x="540" y="286" width="200" height="44" rx="4"/>
<text class="t" x="640" y="306">DynamoDB</text>
<text class="sub" x="640" y="323">token table</text>
<text class="note" x="20" y="374">All in CDK, in us-east-1: Route 53 → Secret → Api → CloudFront stacks, plus an ACM certificate for the apex and a wildcard.</text>
</svg>
</figure>


### 3. Registration

Add components to actually RSVP for the event with the required information.

The RSVP form went into the main site alongside the move to edge auth, and its backend followed shortly after. Spinners, toasts and a success message came later, as polish.

- **The form** collects a first name, last name, phone number and whether the guest is attending, with an optional plus-one. Phone numbers are checked as E.164 with google-libphonenumber for easy validation.
- **`PUT /rsvp`** goes to a second Lambda behind the same API Gateway. The cookie goes with the request, because the browser sends it to `api.` as well. The Lambda checks the token against the same DynamoDB auth table the edge function uses, so only a logged-in guest can RSVP.
- **A second DynamoDB table** stores each RSVP, keyed on first and last name, lowercased, with the phone number and attendance.
- A plus-one is a second `PUT`, sent in parallel with the first.
- The RSVP Lambda can write RSVPs but only *read* the auth table.

There's no admin page. RSVPs were read straight out of the table in the DynamoDB console or with `aws dynamodb scan`.

<figure>
<svg viewBox="0 0 760 400" role="img" aria-labelledby="ws3-title ws3-desc" class="dg-ws3" style="width:100%;height:auto">
<title id="ws3-title">Stage 3 architecture: registration</title>
<desc id="ws3-desc">Adds an RSVP Lambda behind the same API Gateway at PUT /rsvp. It reads the token table to confirm the guest is logged in and writes to a new DynamoDB RSVPs table. The rest of the stage 2 architecture is unchanged.</desc>
<style>
.dg-ws3 text{fill:var(--global-text-color);font-size:13px;text-anchor:middle}
.dg-ws3 .t{font-weight:500}
.dg-ws3 .sub{fill:var(--global-text-color-light);font-size:11.5px}
.dg-ws3 .hl{fill:var(--global-theme-color)}
.dg-ws3 .lg{text-anchor:start;font-size:12px;fill:var(--global-text-color-light)}
.dg-ws3 .note{text-anchor:start;font-size:11.5px;fill:var(--global-text-color-light)}
.dg-ws3 .box{fill:var(--global-card-bg-color);stroke:var(--global-text-color-light);stroke-width:1}
.dg-ws3 .new{fill:var(--global-card-bg-color);stroke:var(--global-theme-color);stroke-width:2}
.dg-ws3 .ln{stroke:var(--global-text-color-light);stroke-width:1.5;fill:none}
.dg-ws3 .dash{stroke:var(--global-text-color-light);stroke-width:1.5;fill:none;stroke-dasharray:4 4}
.dg-ws3 .hd{fill:var(--global-text-color-light)}
</style>
<rect class="new" x="560" y="16" width="16" height="12" rx="2"/>
<text class="lg" x="584" y="27">Added in this stage</text>
<rect class="box" x="150" y="20" width="150" height="40" rx="4"/>
<text class="t" x="225" y="40">Route 53</text>
<text class="sub" x="225" y="57">apex + api. records</text>
<path class="dash" d="M300 40 H385 V80"/>
<rect class="box" x="20" y="190" width="100" height="50" rx="4"/>
<text class="t" x="70" y="220">Guest’s browser</text>
<path class="ln" d="M120 215 H135 M135 112 V318 M135 112 H146 M135 318 H146"/>
<path class="hd" d="M150 112 L140 107 L140 117 Z"/>
<path class="hd" d="M150 318 L140 313 L140 323 Z"/>
<rect class="box" x="150" y="90" width="110" height="44" rx="4"/>
<text class="t" x="205" y="110">WAF</text>
<text class="sub" x="205" y="127">US + Canada only</text>
<path class="ln" d="M260 112 H296"/>
<path class="hd" d="M300 112 L290 107 L290 117 Z"/>
<rect class="box" x="300" y="80" width="170" height="64" rx="4"/>
<text class="t" x="385" y="100">CloudFront</text>
<text class="sub" x="385" y="117">/  ·  /w/*</text>
<path class="ln" d="M385 144 V164"/>
<rect class="box" x="300" y="164" width="170" height="48" rx="4"/>
<text class="t" x="385" y="184">Lambda@Edge</text>
<text class="sub" x="385" y="201">token check</text>
<path class="ln" d="M470 112 H516"/>
<path class="hd" d="M520 112 L510 107 L510 117 Z"/>
<rect class="box" x="520" y="70" width="220" height="64" rx="4"/>
<text class="t" x="630" y="90">S3 bucket (private)</text>
<text class="sub" x="630" y="108">login/  ←  /</text>
<text class="sub" x="630" y="125">wed/w/  ←  /w/*</text>
<path class="ln" d="M470 188 H752 V308 H740"/>
<rect class="box" x="150" y="290" width="130" height="56" rx="4"/>
<text class="t" x="215" y="310">API Gateway</text>
<text class="sub" x="215" y="327">api.&lt;domain&gt;</text>
<path class="ln" d="M280 318 H300 M300 264 V354 M300 264 H316"/>
<path class="hd" d="M320 264 L310 259 L310 269 Z"/>
<rect class="box" x="320" y="240" width="170" height="48" rx="4"/>
<text class="t" x="405" y="260">Login Lambda</text>
<text class="sub" x="405" y="277">POST /auth</text>
<path class="ln" d="M300 354 H316"/>
<path class="hd" d="M320 354 L310 349 L310 359 Z"/>
<rect class="new" x="320" y="330" width="170" height="48" rx="4"/>
<text class="t" x="405" y="350">RSVP Lambda</text>
<text class="sub" x="405" y="367">PUT /rsvp</text>
<path class="ln" d="M490 346 L540 318"/>
<path class="ln" d="M490 362 H540"/>
<rect class="new" x="540" y="340" width="200" height="44" rx="4"/>
<text class="t" x="640" y="360">DynamoDB</text>
<text class="sub" x="640" y="377">RSVPs table</text>
<path class="ln" d="M490 256 L540 254"/>
<path class="ln" d="M490 272 L540 300"/>
<rect class="box" x="540" y="232" width="200" height="44" rx="4"/>
<text class="t" x="640" y="252">Secrets Manager</text>
<text class="sub" x="640" y="269">guest password</text>
<rect class="box" x="540" y="286" width="200" height="44" rx="4"/>
<text class="t" x="640" y="306">DynamoDB</text>
<text class="sub" x="640" y="323">token table</text>
</svg>
</figure>


### 4. After party

Only certain groups should have information about the after party. A second section was added to support that, mirroring the authentication and app split between the main site and the bucket.

Instead of issuing a second token, the after-party is a second tier on the guest's existing one:

- **A second password** sits in the same Secrets Manager secret as the first.
- **A hidden page at `/w/secret`** in the main site has a form that sends the second password to `POST /secret`. The same login Lambda handles it. If the password matches, it marks the guest's existing token as approved. It uses a conditional DynamoDB update that only sets `party = true` if the token exists and hasn't expired, so a made-up or expired token can't be approved.
- **A third Angular app** for the after-party, built with `baseHref` `/s/` and served from a third CloudFront behavior, `/s/*`, in the same bucket.
- **One more check in the edge function.** For `/s/*`, a valid token isn't enough. If the token isn't party-approved, the guest gets a 302 back to `/w/secret` instead of the page.

The result is one cookie and one login, with two levels of access. Approval lives on the server, so there's nothing in the browser for a guest to change to unlock it.

<figure>
<svg viewBox="0 0 760 400" role="img" aria-labelledby="ws4-title ws4-desc" class="dg-ws4" style="width:100%;height:auto">
<title id="ws4-title">Stage 4 architecture: the after party</title>
<desc id="ws4-desc">Adds a /s/* CloudFront behaviour serving the after-party app from the same bucket. The Lambda@Edge function additionally checks a party flag on the token for /s/*. The login Lambda handles POST /secret, checking a second password in Secrets Manager and setting the party flag on the guest's existing token.</desc>
<style>
.dg-ws4 text{fill:var(--global-text-color);font-size:13px;text-anchor:middle}
.dg-ws4 .t{font-weight:500}
.dg-ws4 .sub{fill:var(--global-text-color-light);font-size:11.5px}
.dg-ws4 .hl{fill:var(--global-theme-color)}
.dg-ws4 .lg{text-anchor:start;font-size:12px;fill:var(--global-text-color-light)}
.dg-ws4 .note{text-anchor:start;font-size:11.5px;fill:var(--global-text-color-light)}
.dg-ws4 .box{fill:var(--global-card-bg-color);stroke:var(--global-text-color-light);stroke-width:1}
.dg-ws4 .new{fill:var(--global-card-bg-color);stroke:var(--global-theme-color);stroke-width:2}
.dg-ws4 .ln{stroke:var(--global-text-color-light);stroke-width:1.5;fill:none}
.dg-ws4 .dash{stroke:var(--global-text-color-light);stroke-width:1.5;fill:none;stroke-dasharray:4 4}
.dg-ws4 .hd{fill:var(--global-text-color-light)}
</style>
<rect class="new" x="560" y="16" width="16" height="12" rx="2"/>
<text class="lg" x="584" y="27">Added in this stage</text>
<rect class="box" x="150" y="20" width="150" height="40" rx="4"/>
<text class="t" x="225" y="40">Route 53</text>
<text class="sub" x="225" y="57">apex + api. records</text>
<path class="dash" d="M300 40 H385 V80"/>
<rect class="box" x="20" y="190" width="100" height="50" rx="4"/>
<text class="t" x="70" y="220">Guest’s browser</text>
<path class="ln" d="M120 215 H135 M135 112 V318 M135 112 H146 M135 318 H146"/>
<path class="hd" d="M150 112 L140 107 L140 117 Z"/>
<path class="hd" d="M150 318 L140 313 L140 323 Z"/>
<rect class="box" x="150" y="90" width="110" height="44" rx="4"/>
<text class="t" x="205" y="110">WAF</text>
<text class="sub" x="205" y="127">US + Canada only</text>
<path class="ln" d="M260 112 H296"/>
<path class="hd" d="M300 112 L290 107 L290 117 Z"/>
<rect class="box" x="300" y="80" width="170" height="64" rx="4"/>
<text class="t" x="385" y="100">CloudFront</text>
<text class="sub" x="385" y="117">/  ·  /w/*  ·  <tspan class="hl">/s/*</tspan></text>
<path class="ln" d="M385 144 V164"/>
<rect class="new" x="300" y="164" width="170" height="48" rx="4"/>
<text class="t" x="385" y="184">Lambda@Edge</text>
<text class="sub" x="385" y="201">token check + <tspan class="hl">party check</tspan></text>
<path class="ln" d="M470 112 H516"/>
<path class="hd" d="M520 112 L510 107 L510 117 Z"/>
<rect class="box" x="520" y="70" width="220" height="81" rx="4"/>
<text class="t" x="630" y="90">S3 bucket (private)</text>
<text class="sub" x="630" y="108">login/  ←  /</text>
<text class="sub" x="630" y="125">wed/w/  ←  /w/*</text>
<text class="sub hl" x="630" y="142">wed/s/  ←  /s/*</text>
<path class="ln" d="M470 188 H752 V308 H740"/>
<rect class="box" x="150" y="290" width="130" height="56" rx="4"/>
<text class="t" x="215" y="310">API Gateway</text>
<text class="sub" x="215" y="327">api.&lt;domain&gt;</text>
<path class="ln" d="M280 318 H300 M300 264 V354 M300 264 H316"/>
<path class="hd" d="M320 264 L310 259 L310 269 Z"/>
<rect class="new" x="320" y="240" width="170" height="48" rx="4"/>
<text class="t" x="405" y="260">Login Lambda</text>
<text class="sub" x="405" y="277">POST /auth  ·  <tspan class="hl">/secret</tspan></text>
<path class="ln" d="M300 354 H316"/>
<path class="hd" d="M320 354 L310 349 L310 359 Z"/>
<rect class="box" x="320" y="330" width="170" height="48" rx="4"/>
<text class="t" x="405" y="350">RSVP Lambda</text>
<text class="sub" x="405" y="367">PUT /rsvp</text>
<path class="ln" d="M490 346 L540 318"/>
<path class="ln" d="M490 362 H540"/>
<rect class="box" x="540" y="340" width="200" height="44" rx="4"/>
<text class="t" x="640" y="360">DynamoDB</text>
<text class="sub" x="640" y="377">RSVPs table</text>
<path class="ln" d="M490 256 L540 254"/>
<path class="ln" d="M490 272 L540 300"/>
<rect class="box" x="540" y="232" width="200" height="44" rx="4"/>
<text class="t" x="640" y="252">Secrets Manager</text>
<text class="sub hl" x="640" y="269">guest passwords</text>
<rect class="new" x="540" y="286" width="200" height="44" rx="4"/>
<text class="t" x="640" y="306">DynamoDB</text>
<text class="sub" x="640" y="323">token table  ·  <tspan class="hl">party flag</tspan></text>
</svg>
</figure>

## Result

| | |
|---|---|
| Front end | 3 Angular 21 apps, fully prerendered |
| Infrastructure | 4 CDK stacks, 3 Lambda handlers, 2 DynamoDB tables |
| Auth | shared password → 60-day HttpOnly cookie, checked at the edge on every request |
| Deploy | manual: CDK, then `ng build` + `s3 sync` + invalidation |
| Tests | 5 Jest unit-test files for the Lambdas |
| Image assets | about 7.6 MB in the main app, plus a single 14 MB image in the after-party app |
| Monthly cost | ~$15 per month. The biggest fixed cost is WAF, at about $9/month. |


## What I'd Change

- It's not mobile optimized, at all.
- Throw the entire thing into Amplify or Lightsail instead of static-ish on S3. 
- Compress the images (WebP or AVIF would cut them by roughly 70–90%).
- Make it pretty. It's a fairly ugly website but that's fine. It got the job done. 
- Set a budget and actually try to keep the site under that budget. 
- Fully flesh out security management and token rotation.

## Was it worth it? 

Yeah, why not. It was fun to muck around, trying to solve problems I intentionally created for myself by enforcing limitations for no reason other than it sounded interesting. It also got me back into building things for myself and just for the fun of it. 


