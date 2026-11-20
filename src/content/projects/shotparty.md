---
title: shotparty
description: a self-hosted qr-code photo and video drop for events, serverless on aws
category: technical
date: 2026-11-14
repo: https://github.com/billythemoose/shotparty
demo: https://shotparty.ineedmoreinformation.com/
---

shotparty is a self-hosted photo and video drop for events. Guests scan a QR code, pick photos and videos on their phone, and the files land at full quality in an S3 bucket in **your own AWS account**. There's no app, no guest account and no subscription. It's serverless: CloudFront in front of a static page and a small API on API Gateway and Lambda, with a DynamoDB table, all defined in AWS SAM and deployed with one command. [This blog post](/blog/2026/cs-shotparty/) covers how it was built.

The project site gives the short tour. The GitHub repo has the quick start, the operations guide and a detailed "how it works" walkthrough of every subsystem.

- Site: [https://shotparty.ineedmoreinformation.com/](https://shotparty.ineedmoreinformation.com/)
- GitHub: [billythemoose/shotparty](https://github.com/billythemoose/shotparty)

## Tech Stack

| Layer | Technology |
|---|---|
| Guest page | Vite + TypeScript, no runtime dependencies, mobile-first, light and dark |
| Hosting | CloudFront on the Free flat-rate plan (CDN, WAF, TLS), private S3 site bucket with OAC |
| API | API Gateway HTTP API, 5 Lambdas (Node 22, arm64, bundled with esbuild) |
| Uploads | S3 presigned POST, straight from the browser to the media bucket |
| Validation | EventBridge `Object Created` → a Lambda that checks magic bytes |
| Data | DynamoDB single table (on-demand, TTL, PITR) |
| Secrets | SSM Parameter Store SecureStrings |
| Bot check | Cloudflare Turnstile, verified server-side |
| Monitoring | CloudWatch alarms and log metric filters, SNS email, AWS Budgets |
| Infrastructure | AWS SAM (CloudFormation), three stacks |
| Tooling | TypeScript CLI scripts and bash, `npm run setup` |
| Tests and CI | Vitest (445 unit tests), Playwright (12 end-to-end tests), GitHub Actions, CodeQL, Dependabot |

## Architecture

### Components

- **Guest page** at `/e/<token>`. A static page from the site bucket. A CloudFront Function rewrites `/e/*` to `index.html`. It uploads three files at a time with per-file progress, retries and a screen wake lock.
- **HTTP API** at `/api/*` on the same CloudFront distribution, throttled to 50 requests/second with a burst of 100 per route.
- **Lambdas:**
  - `event`: returns the event's name, text, accent color, open/closed status and Turnstile site key.
  - `session`: verifies Turnstile, then the gate (kill switch, token, window, PIN), and issues a signed 12-hour session.
  - `presign`: checks the session, reserves quota, and returns a presigned POST for one file.
  - `validate`: checks each upload's first bytes and moves it to `accepted/` or deletes it.
  - `health`: for monitoring.
- **Media bucket:** private, versioned and TLS-only, with CORS for the site only. Files are stored under `uploads/<event>/<guest>/<uuid>.<ext>` and moved to `accepted/` once they're validated. An optional lifecycle rule moves them to Glacier Instant Retrieval after N days.
- **DynamoDB single table:** events, event ID reservations, sessions, quota counters, rejected uploads and duplicate claims.
- **SSM:** the Turnstile secret, the session HMAC key, the origin secret, the alert email and the `uploads_enabled` kill switch.
- **Organizer tools:** `event:create` / `event:update` / `event:close` with QR codes, a local gallery page of presigned links, an MD5-verified download, the kill switch, and load-test, abuse-test and recovery scripts.

<figure>
<svg viewBox="0 0 760 470" role="img" aria-labelledby="spa-title spa-desc" class="dg-sparch" style="width:100%;height:auto">
<title id="spa-title">shotparty architecture</title>
<desc id="spa-desc">A guest's phone reaches CloudFront, on the Free plan with its WAF and TLS. CloudFront serves the upload page from a private S3 site bucket and sends /api/* to an API Gateway HTTP API. The HTTP API invokes the event, session and presign Lambdas, which use a DynamoDB table and SSM parameters, and the session Lambda verifies the guest with Cloudflare Turnstile. The presign Lambda returns a presigned POST, and the phone uploads the file straight to the S3 media bucket. The bucket sends an Object Created event through EventBridge to the validate Lambda, which copies real media to accepted/ or deletes the upload.</desc>
<defs><marker id="spa-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="head" d="M0 0 L10 5 L0 10 Z"/></marker></defs>
<style>
.dg-sparch text{fill:var(--global-text-color);font-size:12px;text-anchor:middle}
.dg-sparch .name{font-weight:500;font-size:13px}
.dg-sparch .sub{fill:var(--global-text-color-light);font-size:11.5px}
.dg-sparch .note{text-anchor:start;font-size:11.5px;fill:var(--global-text-color-light)}
.dg-sparch .box{fill:var(--global-card-bg-color);stroke:var(--global-text-color-light);stroke-width:1}
.dg-sparch .aws{fill:var(--global-card-bg-color);stroke:var(--global-theme-color);stroke-width:2}
.dg-sparch .ln{stroke:var(--global-text-color-light);stroke-width:1.5;fill:none}
.dg-sparch .dash{stroke:var(--global-text-color-light);stroke-width:1.5;fill:none;stroke-dasharray:4 4}
.dg-sparch .head{fill:var(--global-text-color-light)}
.dg-sparch .msg{paint-order:stroke;stroke:var(--global-bg-color);stroke-width:4px}
</style>
<rect class="box" x="20" y="200" width="110" height="56" rx="4"/>
<text class="name" x="75" y="224">Guest’s phone</text>
<text class="sub" x="75" y="241">browser, no app</text>
<path class="ln" d="M130 212 H145 V122 H168" marker-end="url(#spa-arrow)"/>
<rect class="aws" x="170" y="90" width="150" height="64" rx="4"/>
<text class="name" x="245" y="112">CloudFront</text>
<text class="sub" x="245" y="129">Free plan: WAF + TLS</text>
<text class="sub" x="245" y="145">CF Function on /api/*</text>
<path class="ln" d="M245 90 V46 H338" marker-end="url(#spa-arrow)"/>
<rect class="aws" x="340" y="20" width="160" height="52" rx="4"/>
<text class="name" x="420" y="42">Site bucket</text>
<text class="sub" x="420" y="60">S3 · OAC · upload page</text>
<line class="ln" x1="320" y1="126" x2="338" y2="126" marker-end="url(#spa-arrow)"/>
<rect class="aws" x="340" y="100" width="160" height="52" rx="4"/>
<text class="name" x="420" y="122">HTTP API</text>
<text class="sub" x="420" y="140">/api/* · 50 rps</text>
<line class="ln" x1="500" y1="126" x2="538" y2="126" marker-end="url(#spa-arrow)"/>
<rect class="aws" x="540" y="90" width="200" height="72" rx="4"/>
<text class="name" x="640" y="112">Lambdas</text>
<text class="sub" x="640" y="130">event · session · presign</text>
<text class="sub" x="640" y="147">reserved concurrency</text>
<line class="ln" x1="640" y1="162" x2="640" y2="178" marker-end="url(#spa-arrow)"/>
<rect class="aws" x="540" y="180" width="200" height="44" rx="4"/>
<text class="name" x="640" y="200">DynamoDB</text>
<text class="sub" x="640" y="217">events · sessions · quotas</text>
<path class="ln" d="M740 126 H752 V258 H742" marker-end="url(#spa-arrow)"/>
<rect class="aws" x="540" y="236" width="200" height="44" rx="4"/>
<text class="name" x="640" y="256">SSM Parameter Store</text>
<text class="sub" x="640" y="273">secrets · kill switch</text>
<path class="dash" d="M540 150 H520 V208 H322" marker-end="url(#spa-arrow)"/>
<text class="sub msg" x="420" y="204">siteverify</text>
<rect class="box" x="170" y="186" width="150" height="44" rx="4"/>
<text class="name" x="245" y="206">Cloudflare Turnstile</text>
<text class="sub" x="245" y="223">bot check</text>
<path class="ln" d="M130 244 H155 V352 H338" marker-end="url(#spa-arrow)"/>
<text class="sub msg" x="250" y="346">presigned POST</text>
<rect class="aws" x="340" y="320" width="160" height="64" rx="4"/>
<text class="name" x="420" y="342">S3 media bucket</text>
<text class="sub" x="420" y="359">uploads/ → accepted/</text>
<text class="sub" x="420" y="375">data stack</text>
<line class="ln" x1="500" y1="330" x2="538" y2="330" marker-end="url(#spa-arrow)"/>
<rect class="aws" x="540" y="310" width="200" height="40" rx="4"/>
<text class="name" x="640" y="327">EventBridge</text>
<text class="sub" x="640" y="343">Object Created</text>
<line class="ln" x1="640" y1="350" x2="640" y2="370" marker-end="url(#spa-arrow)"/>
<rect class="aws" x="540" y="372" width="200" height="48" rx="4"/>
<text class="name" x="640" y="392">validate Lambda</text>
<text class="sub" x="640" y="409">magic bytes · duplicates</text>
<path class="ln" d="M540 404 H420 V386" marker-end="url(#spa-arrow)"/>
<text class="sub msg" x="480" y="408">copy or delete</text>
<text class="note" x="20" y="452">Per stage: a data stack (media bucket, table) and an app stack (everything else), plus one account budget stack. All in us-east-1.</text>
</svg>
</figure>

### Upload sequence

<figure>
<svg viewBox="0 0 760 680" role="img" aria-labelledby="sps-title sps-desc" class="dg-spseq" style="width:100%;height:auto">
<title id="sps-title">Upload sequence</title>
<desc id="sps-desc">The page fetches the event from the API through CloudFront and API Gateway and gets its name, status and Turnstile site key. It then posts a Turnstile token, plus a PIN if needed, to /api/session. The session Lambda verifies the token with Cloudflare, runs the gate checks, stores the session in DynamoDB and returns a signed 12-hour session. For each file, the page posts to /api/presign with the session. The presign Lambda makes three conditional quota updates in DynamoDB and returns a presigned POST for the exact key, type and size, valid for 10 minutes. The page posts the file straight to S3, which returns 204. S3 then sends an Object Created event through EventBridge to the validate Lambda, which reads the first 64 bytes and either copies the file to accepted/ or deletes it.</desc>
<defs><marker id="sps-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="head" d="M0 0 L10 5 L0 10 Z"/></marker></defs>
<style>
.dg-spseq text{fill:var(--global-text-color);font-size:12px;text-anchor:middle}
.dg-spseq .name{font-weight:500;font-size:13px}
.dg-spseq .sub{fill:var(--global-text-color-light);font-size:11.5px}
.dg-spseq .box{fill:var(--global-card-bg-color);stroke:var(--global-text-color-light);stroke-width:1}
.dg-spseq .aws{fill:var(--global-card-bg-color);stroke:var(--global-theme-color);stroke-width:2}
.dg-spseq .life{stroke:var(--global-text-color-light);stroke-width:1;stroke-dasharray:3 4}
.dg-spseq .call{stroke:var(--global-text-color);stroke-width:1.5}
.dg-spseq .reply{stroke:var(--global-text-color-light);stroke-width:1.5;stroke-dasharray:5 3}
.dg-spseq .head{fill:var(--global-text-color-light)}
.dg-spseq .msg{paint-order:stroke;stroke:var(--global-bg-color);stroke-width:4px}
.dg-spseq .frame{fill:none;stroke:var(--global-text-color-light);stroke-width:1}
.dg-spseq .tag{text-anchor:start;font-size:11px;font-weight:500;fill:var(--global-text-color-light)}
</style>
<rect class="box" x="15" y="16" width="100" height="34" rx="4"/><text class="name" x="65" y="38">Browser</text>
<rect class="aws" x="145" y="16" width="100" height="34" rx="4"/><text class="name" x="195" y="38">API Lambdas</text>
<rect class="box" x="275" y="16" width="100" height="34" rx="4"/><text class="name" x="325" y="38">Turnstile</text>
<rect class="aws" x="405" y="16" width="100" height="34" rx="4"/><text class="name" x="455" y="38">DynamoDB</text>
<rect class="aws" x="535" y="16" width="100" height="34" rx="4"/><text class="name" x="585" y="38">S3 media</text>
<rect class="aws" x="650" y="16" width="100" height="34" rx="4"/><text class="name" x="700" y="38">validate</text>
<line class="life" x1="65" y1="50" x2="65" y2="666"/><line class="life" x1="195" y1="50" x2="195" y2="666"/><line class="life" x1="325" y1="50" x2="325" y2="666"/><line class="life" x1="455" y1="50" x2="455" y2="666"/><line class="life" x1="585" y1="50" x2="585" y2="666"/><line class="life" x1="700" y1="50" x2="700" y2="666"/>
<line class="call" x1="65" y1="88" x2="193" y2="88" marker-end="url(#sps-arrow)"/><text class="msg" x="130" y="81">GET /api/event/{token}</text>
<text class="msg sub" x="130" y="104">via CloudFront + API Gateway</text>
<line class="reply" x1="195" y1="134" x2="67" y2="134" marker-end="url(#sps-arrow)"/><text class="msg" x="130" y="127">name, status, site key</text>
<line class="call" x1="65" y1="176" x2="193" y2="176" marker-end="url(#sps-arrow)"/><text class="msg" x="130" y="169">POST /api/session</text>
<text class="msg sub" x="130" y="192">Turnstile token (+ PIN)</text>
<line class="call" x1="195" y1="222" x2="323" y2="222" marker-end="url(#sps-arrow)"/><text class="msg" x="260" y="215">siteverify</text>
<line class="reply" x1="325" y1="252" x2="197" y2="252" marker-end="url(#sps-arrow)"/><text class="msg" x="260" y="245">success</text>
<line class="call" x1="195" y1="288" x2="453" y2="288" marker-end="url(#sps-arrow)"/><text class="msg" x="325" y="281">gate checks · PutItem SESSION</text>
<line class="reply" x1="195" y1="324" x2="67" y2="324" marker-end="url(#sps-arrow)"/><text class="msg" x="130" y="317">signed 12 h session</text>
<rect class="frame" x="20" y="346" width="610" height="212"/>
<text class="tag" x="28" y="360">for each file</text>
<line class="call" x1="65" y1="388" x2="193" y2="388" marker-end="url(#sps-arrow)"/><text class="msg" x="130" y="381">POST /api/presign</text>
<text class="msg sub" x="130" y="404">Bearer session</text>
<line class="call" x1="195" y1="424" x2="453" y2="424" marker-end="url(#sps-arrow)"/><text class="msg" x="325" y="417">3 conditional quota updates</text>
<line class="reply" x1="195" y1="462" x2="67" y2="462" marker-end="url(#sps-arrow)"/><text class="msg" x="130" y="455">presigned POST</text>
<text class="msg sub" x="130" y="478">exact key, type, size · 10 min</text>
<line class="call" x1="65" y1="512" x2="583" y2="512" marker-end="url(#sps-arrow)"/><text class="msg" x="325" y="505">POST file, straight to S3</text>
<line class="reply" x1="585" y1="540" x2="67" y2="540" marker-end="url(#sps-arrow)"/><text class="msg" x="325" y="533">204</text>
<line class="call" x1="585" y1="592" x2="698" y2="592" marker-end="url(#sps-arrow)"/><text class="msg" x="642" y="585">Object Created</text>
<text class="msg sub" x="642" y="608">via EventBridge</text>
<line class="reply" x1="700" y1="638" x2="587" y2="638" marker-end="url(#sps-arrow)"/><text class="msg" x="642" y="631">read 64 bytes</text>
<text class="msg sub" x="642" y="654">copy to accepted/ or delete</text>
</svg>
<figcaption>Requests that go straight to the API Gateway URL, skipping CloudFront, get a 403. The validator also claims each file's MD5 in DynamoDB, so the same photo from the same guest is stored once.</figcaption>
</figure>

### Abuse protection

The page is public and writes to your bucket, so it's protected in layers. The goal is to make scripted abuse impractical and to put a hard ceiling on the worst case.

| # | Layer | What it stops |
|---|---|---|
| 1 | WAF (3,000 requests / 5 min per IP plus AWS managed rules), API throttling, reserved Lambda concurrency | Floods. Also caps the API and Lambda bill |
| 2 | 128-bit event token in the QR URL, plus an optional PIN printed on the card | Scanners and crawlers that never saw the card |
| 3 | Cloudflare Turnstile, verified server-side before a session is issued | Headless scripts and simple bots |
| 4 | Signed 12-hour session, required on every presign | Reusing one human check across many bots |
| 5 | Quotas: 500 files / 10 GiB per session, 3,000 files/hour per IP, 20,000 files / 100 GiB per event | One guest or bot filling the bucket |
| 6 | Presigned POST policy: server-chosen key, exact type and byte size, 10-minute expiry | Oversized files, overwrites, arbitrary paths |
| 7 | Magic-byte validation after upload | Junk, executables and archives renamed as photos |
| 8 | Upload window and an SSM kill switch, checked on every request | Uploads after the event. Gives an instant off switch |
| 9 | CloudWatch alarms emailing through SNS, and an account budget | Surprises of any kind |

**Worst case:** S3 doesn't charge for incoming data, so filling an event's 100 GiB cap with junk costs about $2.30/month until it's deleted.

### Supported files

JPEG, PNG, HEIC/HEIF, WebP, GIF, MP4, MOV, WebM and 3GP, plus camera RAW: DNG (including iPhone ProRAW), CR2, CR3, NEF, ARW, RAF, ORF and RW2. The default limit is 1 GiB per file, and the config can raise it to 5 GiB.

## Deployment

### Stacks

| Stack | Contains | Protection |
|---|---|---|
| `<prefix>-<stage>-data` | Media bucket, DynamoDB table | Termination protection, a stack policy denying replace and delete, `Retain` policies, S3 versioning, DynamoDB deletion protection and PITR |
| `<prefix>-<stage>-app` | Lambdas, HTTP API, CloudFront, site bucket, alarms | None needed. Safe to delete and recreate without losing data |
| `<prefix>-account` | The account budget, shared by the stages | None needed |

The data stack publishes its resource names to SSM, and the app stack reads them from there. CloudFormation exports aren't used, because they lock both stacks against edits. Every deploy creates a change set first, and a guard refuses any change that would replace or remove the bucket or table, or replace the CloudFront distribution the printed QR codes point at.

### Setup

1. **Log in:** `aws sso login` (or any AWS CLI credentials), and export a Cloudflare API token for prod.
2. **Run setup:** `npm run setup` asks a few questions and saves `shotparty.config.json`. It then creates the secrets, deploys the data and app stacks, creates the Turnstile widget through Cloudflare's API, creates the first event with its QR code, and runs a health check. Re-running it resumes after a failure and changes nothing on a finished install.
3. **By hand:** confirm the alert email, print the QR code, and optionally subscribe the distribution to the CloudFront Free plan in the console (there's no API for it), then run setup again to attach its WAF.

### After the event

1. `npm run download` pulls every accepted file and verifies each one's MD5 against S3.
2. The upload window closes on its own, or `scripts/uploads.sh prod off` closes it early.
3. Optionally, archive to Glacier Instant Retrieval, or tear down the app stack and keep the data.

## Estimated Cost

For a typical event of ~100–200 guests and 15–25 GB.

| Item | Estimate |
|---|---|
| CloudFront Free plan (CDN, WAF, TLS, 5 GB S3 credit) | $0 |
| S3 Standard, ~25 GB | ~$0.46 / month |
| S3 requests | < $0.05 |
| API Gateway, Lambda, DynamoDB on-demand | pennies |
| Uploads in, and downloading everything once | $0 |
| CloudWatch alarms | ~$0.30 for one stage, ~$1.60 for dev + prod |
| Cloudflare Turnstile | $0 |
| **Total** | **~$1–$2 / month** while live. About $0.10/month archived, or $0 after download and delete |

Not used, on purpose: a custom domain, Secrets Manager, WAF CAPTCHA and Bot Control, and a standalone WAF web ACL.

## Highlights

- Photo bytes never pass through Lambda. S3 enforces the exact key, type and size of every upload.
- The app stack can be deleted and recreated without risk to the photos. A stack policy and a change-set guard enforce that, and a drill proved it.
- Nine layers of abuse protection with a known worst-case cost.
- The real viewer IP is passed from CloudFront with a shared secret, so per-IP quotas work and the API can't be reached around the WAF. Counters store an HMAC of the IP, never the IP itself.
- Quotas use single-item conditional updates with rollback instead of transactions. That change came from a load test that failed 32 uploads with `TransactionConflict`.
- One-command, re-runnable setup from one config file, including the Cloudflare Turnstile widget.
- Load-tested with simulated guests: 300 of 300 uploads, with the validator finishing 5 seconds after the last one.
- Every download is MD5-verified against S3.

## Known Limitations

- Anyone with the QR code (and PIN) can upload. A leaked code means closing the event early or turning uploads off.
- Validation checks that a file is a real photo or video, not what it shows. There's no content moderation.
- Without a custom domain, the printed QR codes are tied to one CloudFront distribution, so the prod app stack can't be recreated while an event is live.
- No mid-file resume. A dropped upload restarts from the beginning.
- The CloudFront Free plan has to be subscribed to and canceled in the console, and a distribution can't be deleted while it's on the plan.
- Each stage reserves 205 concurrent Lambda executions, so new accounts need a quota increase before the first deploy.
- The WAF rate rule was verified by its configuration, not by a real flood.

[How it got built: blog →](/blog/2026/cs-shotparty/)
