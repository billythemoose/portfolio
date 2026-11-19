---
title: Building shotparty
date: 2026-11-14 12:00:00
description: a self-hosted qr-code photo drop, built in three days for one event and then made public
tags: typescript aws sam lambda s3
categories: project
---

## One-Line Summary

What started as "a website to upload party photos and videos so people don't have to install an app can't be that complicated or expensive, right?" turned into shotparty: a QR-code photo drop that anyone can deploy into their own AWS account with one command.


## Why Build It

1. **Get the photos.** Every guest leaves an event with a phone full of photos, and almost none of them get sent to the people who hosted it. A QR code on a card is about as low-effort as it gets: scan, pick photos, done.
2. **An app is overkill.** There's no reason someone attending a party should have to install an app they're going to use one time then forget about. 
3. **Own the photos.** The hosted products for this cost $30–$100 and keep the files in *their* cloud for anywhere from one month to two years. A Google Photos shared album needs every guest to have a Google account. I wanted the original files, at full quality, in a bucket I control.
4. **It's fun.** Same reason as [the wedding website](/blog/2026/cs-wedding-site/). There aren't that many moving pieces so let's see what we can throw together.

Check it out yourself. Deploy your own and test it out!
- GitHub: [billythemoose/shotparty](https://github.com/billythemoose/shotparty)

## Constraints

- **No app and no guest accounts.** Scan, pick, upload. Nothing to install and nothing to sign up for.
- **Full quality.** No compression and no re-encoding. HEIC, video and later camera RAW all go in exactly as they came off the phone.
- **Cheap.** Free or nearly free AWS services only, and anything with a recurring cost had to be called out before it went in.
- **Never lose a photo.** The app should be safe to change, break or even delete without touching the files.
- **A public form that writes to my S3 bucket can't turn into a big bill.** This one drove most of the design.

## How It Was Built

This one was built differently from the wedding site. Before writing any code, I wrote an architecture baseline and a staged development plan, then worked through it stage by stage. The rules were short:

- Every stage is small, ends in a working, deployable state and is one commit.
- Each stage has to pass the automated checks (lint, typecheck, tests, `cfn-lint`) first.
- Then it has to pass the stage's *Verify* steps, on a real phone, with `curl` or in the AWS console, and only then does it get committed.
- The plan is a living document. Every deviation, bug and verification result is written down under its stage.

That last rule is why this post can quote exact numbers. It ended up as 35 stages over about five weeks. Two of them were skipped and one was descoped.

<figure>
<svg viewBox="0 0 760 210" role="img" aria-labelledby="sp-tl-title sp-tl-desc" class="dg-sptl" style="width:100%;height:auto">
<title id="sp-tl-title">Timeline of shotparty, September 24 to October 29, 2026</title>
<desc id="sp-tl-desc">September 24: plan, AWS account and first stages. September 25: uploads, bot checks and quotas. September 26: production deploy, load tests and the first event. Two quiet weeks follow. October 12 to 13: generic events and one-command setup. October 14 to 21: CI, RAW photos and duplicate detection. October 25: the fresh public repo. October 29: the last stage.</desc>
<style>
.dg-sptl text{fill:var(--global-text-color);font-size:12px;text-anchor:middle}
.dg-sptl .date{font-weight:500}
.dg-sptl .axis{stroke:var(--global-text-color-light);stroke-width:2}
.dg-sptl .gap{stroke:var(--global-text-color-light);stroke-width:2;stroke-dasharray:4 4}
.dg-sptl .tick{stroke:var(--global-text-color-light);stroke-width:1}
.dg-sptl .old{fill:var(--global-text-color-light)}
.dg-sptl .new{fill:var(--global-theme-color)}
.dg-sptl .ring{stroke:var(--global-bg-color);stroke-width:2}
.dg-sptl .lg{text-anchor:start;font-size:12px;fill:var(--global-text-color-light)}
</style>
<line class="axis" x1="30" y1="95" x2="285" y2="95"/>
<line class="gap" x1="285" y1="95" x2="365" y2="95"/>
<line class="axis" x1="365" y1="95" x2="730" y2="95"/>
<text x="325" y="88" style="font-size:11px;fill:var(--global-text-color-light)">2 weeks</text>
<line class="tick" x1="50" y1="75" x2="50" y2="89"/><circle class="old ring" cx="50" cy="95" r="6"/>
<text class="date" x="50" y="40">Sep 24</text><text x="50" y="55">Plan, account,</text><text x="50" y="69">first stages</text>
<line class="tick" x1="160" y1="101" x2="160" y2="115"/><circle class="old ring" cx="160" cy="95" r="6"/>
<text class="date" x="160" y="132">Sep 25</text><text x="160" y="147">Uploads, bot</text><text x="160" y="161">checks, quotas</text>
<line class="tick" x1="270" y1="75" x2="270" y2="89"/><circle class="old ring" cx="270" cy="95" r="6"/>
<text class="date" x="270" y="40">Sep 26</text><text x="270" y="55">Prod, load tests,</text><text x="270" y="69">first event</text>
<line class="tick" x1="380" y1="101" x2="380" y2="115"/><circle class="new ring" cx="380" cy="95" r="6"/>
<text class="date" x="380" y="132">Oct 12–13</text><text x="380" y="147">Generic events,</text><text x="380" y="161">one-command setup</text>
<line class="tick" x1="490" y1="75" x2="490" y2="89"/><circle class="new ring" cx="490" cy="95" r="6"/>
<text class="date" x="490" y="40">Oct 14–21</text><text x="490" y="55">CI, RAW photos,</text><text x="490" y="69">duplicates</text>
<line class="tick" x1="600" y1="101" x2="600" y2="115"/><circle class="new ring" cx="600" cy="95" r="6"/>
<text class="date" x="600" y="132">Oct 25</text><text x="600" y="147">Fresh public</text><text x="600" y="161">repo</text>
<line class="tick" x1="705" y1="75" x2="705" y2="89"/><circle class="new ring" cx="705" cy="95" r="6"/>
<text class="date" x="705" y="40">Oct 29</text><text x="705" y="55">Stage 35,</text><text x="705" y="69">the last one</text>
<circle class="old" cx="36" cy="192" r="6"/><text class="lg" x="48" y="196">Built for the event</text>
<circle class="new" cx="196" cy="192" r="6"/><text class="lg" x="208" y="196">Made self-hostable and public</text>
</svg>
</figure>

## Process

The project went through four phases. The first three took three days and got it ready for the event. The fourth took most of October and turned it into something other people could run.

| Phase | When | What it added |
|---|---|---|
| 1. Upload something | Sep 24–25 | AWS account, two stacks, presigned uploads, the guest page, file validation |
| 2. Make it hard to abuse | Sep 25–26 | event tokens, Turnstile, signed sessions, quotas, throttles, alarms, the CloudFront Free plan |
| 3. Event day | Sep 26 | prod deploy, load tests, a solo rehearsal, the real event, download tools |
| 4. Make it anyone's | Oct 12–29 | one config file, generic events, `npm run setup`, RAW photos, duplicate detection, CI, docs, a public repo |

### 1. Upload something

The first day was mostly writing the plan. A quick look at the competition set the feature list: QR code, no login, original quality, video, bulk download, an upload window and moderation.

The AWS side started with a fresh member account under my existing AWS Organization. It has no root credentials, and a service control policy denies every region except `us-east-1`. The new account sat in "activation pending" for most of a day, so the first few stacks were committed unverified and deployed the next morning.

The core idea: **photo bytes never pass through Lambda.** The browser asks a `presign` Lambda for permission to upload one file, and gets back an S3 presigned POST locked to an exact key, content type and byte size, valid for 10 minutes. The browser then posts the file straight to S3. When it lands, EventBridge triggers a `validate` Lambda. It reads the first 64 bytes, checks they're really a photo or video, then copies the file to `accepted/` or deletes it. A zip renamed to `.jpg` is gone within a second.

The other early decision was **two stacks per stage**. The *data* stack holds the media bucket and the DynamoDB table, with termination protection, a stack policy that refuses to replace or delete either one, retain policies, versioning and point-in-time recovery. The *app* stack holds everything else and can be deleted and recreated at will. Ten app deploys later, every test photo was still there.

A couple of bugs showed up as soon as things were deployed:

- **The presign Lambda crashed on import** with `Dynamic require of "node:https"`. esbuild bundled the CommonJS AWS SDK into an ES module with no `require`. The fix was one banner line. The bigger change was a smoke test that imports each bundle the way Lambda does, which now runs before every deploy. The quick `node -e` check I'd used before couldn't catch it, because `node -e` defines a global `require`.
- **S3 returns 403 instead of 404** for a missing object when the caller can't list the bucket. EventBridge sometimes delivers the same event twice, so the second delivery errored and would have retried 8 times. The validator now has list permission, and a replayed event is a no-op.

The guest page uploads three files at a time, with per-file progress and automatic retries. It holds a screen wake lock while it works, because phones suspend uploads when the screen locks.

### 2. Make it hard to abuse

A public page that writes to my bucket is a free file host for anyone who finds it. Nothing public can be made fully bot-proof, so the goal was to make scripted abuse impractical and **put a hard ceiling on the worst case**. Every request has to get through a stack of layers:

- **An unguessable event token** in the QR URL (128-bit random), and optionally a PIN printed on the card but not in the QR code.
- **Cloudflare Turnstile**, verified server-side before a session is issued. Every PIN guess costs a human check.
- **A signed 12-hour session**, required for every presign.
- **Quotas** per session, per IP per hour and per event, kept as DynamoDB counters.
- **Throttles** at every level: the WAF, API Gateway and reserved Lambda concurrency.
- **An upload window and a kill switch**, checked on every request.
- **CloudWatch alarms and a budget** that email me when anything looks off.

A few things in this phase weren't in the plan:

- **The new account could only run 10 Lambdas at once**, shared by every function. That's AWS's reduced default for new accounts, and too low for a room full of guests uploading at once. A Service Quotas request raised it to 1,000.
- **API Gateway behind CloudFront only sees CloudFront's IP**, so per-IP quotas counted the edge server instead of the guest. Anyone could also skip CloudFront and its WAF by calling the API's own URL. A CloudFront Function now stamps the real viewer IP and a shared secret onto every API request, and the Lambdas refuse any request without the secret.
- **A flood test** sent 9,796 requests in 20 seconds. API Gateway let about 1,400 through and answered 8,352 with a 429 before they ever reached Lambda.
- **The CloudFront Free flat-rate plan** includes a WAF for $0, which normally costs $5/month plus $1 per rule. It has quirks, though. It rejects the `PriceClass` setting, so the first deploy rolled back. And you can't delete a distribution on the plan until you cancel the plan by hand in the console.
- **No custom domain.** Guests get to the site through the QR code, so a `*.cloudfront.net` URL is fine and saves a hosted zone. The catch is that the printed QR codes point at that exact distribution. Recreating the prod app stack would give it a new domain and break every card, so the prod app stack can't be recreated from the time the cards are printed until the upload window closes.

### 3. Event day

Prod went up on the morning of September 26. The plan called for a rehearsal with 3–5 friends on different phones. That wasn't happening on short notice, so it became a load-test script that simulates guests, plus a solo run on my own phone.

**Load test #1** sent 20 simulated guests uploading 10 photos each, all at once. **158 of 200 succeeded.** Two real bugs that no unit test would have found:

- **32 × `TransactionConflict`.** Each presign reserved its quota in one DynamoDB transaction across three counters. When many guests at the same venue upload at once, they all hit the same event counter and the same IP counter, and DynamoDB cancels transactions that collide. The fix was three single-item conditional updates, rolling back the earlier ones when a later counter is full. It has no conflicts and costs half as much.
- **10 × throttled.** 60 presigns arrived at the same moment, each with a ~2-second cold start, against a reserved concurrency of 25. Raising it to 100 fixed it.

The alarms caught both while it happened. Three of them emailed me within minutes, which turned out to be a good real-world test of the alerting. **Load test #2**, after the fixes, sent 30 guests and 300 files: 300 of 300 succeeded, with no errors and no throttles.

The solo rehearsal found one more bug: the PIN field showed up on an event with no PIN. `.field { display: grid }` overrode the `hidden` attribute, and every dev event had a PIN, so nobody had seen it. One global CSS rule and a regression test later, it was gone.

The real event and its QR code were created that same morning. Month-to-date AWS spend at that point: **$0.002**. Afterwards, `npm run download` pulled every file and checked each one's MD5 against S3. The upload window closed itself 30 days later.

### 4. Make it anyone's

After the event, the question was whether to leave it as a one-off. I decided to make it a public project that anyone can self-host from **one config file**, with as few manual steps as possible. The private repo stayed as the archive, and the public one started from a fresh, clean history.

- **One config file.** Every account-specific value (account ID, domains, ARNs, keys) came out of the code and into `shotparty.config.json`, with a JSON schema that reports every error at once.
- **Generic events.** Every guest-facing word now comes from the event: its headline, welcome line, thank-you message and accent color. The page nudges the color just far enough to stay readable in light and dark mode. The wedding copy and the cream-and-serif look went away.
- **A name.** It became *shutterslot*, a mail-slot pun, and later *shotparty*.
- **`npm run setup`** checks the tools, creates the secrets, deploys both stacks, creates the Turnstile widget through Cloudflare's API, makes the first event and its QR code, and runs a health check. It's safe to re-run. Before running a deploy, it checks the change set and refuses anything that would replace the data stack or the CloudFront distribution the QR codes point at.
- **RAW photos.** Some guests shoot RAW, and every layer refused it. Now DNG, CR2, CR3, NEF, ARW, RAF, ORF and RW2 get through. It was tested with ProRAW from an iPhone 13 Pro, a DNG from a Pixel 9 Pro and a NEF from a Nikon D7100, and all of them arrived byte-for-byte.
- **Duplicate uploads.** The same photo could be uploaded again and again. The page now fingerprints each file and skips repeats, and the validator drops a second copy with the same MD5 in the same guest's folder.
- **CI, CodeQL and Dependabot**, plus documentation explaining how each part works.

Running setup for real turned up a new crop of bugs, mostly in bash:

- macOS still ships bash 3.2, which treats an empty array as an unbound variable under `set -u`.
- bash ignores `set -e` inside a function on the left of `&&`, so a failed deploy reported success.
- A deploy step printed a secret's value to the terminal.
- `npm run setup` printed nothing for 15½ minutes while CloudFormation created a CloudFront distribution. It now shows progress.

Two things were cut. An automated AWS Organizations setup script was built and tested, then deleted before it was committed. Few people would use it, and it would have been the riskiest code in the repo. Continuous deployment through GitHub OIDC was skipped too. The deploy script's change-set guard already covers the dangerous part, so it wasn't worth adding a deploy role that a public repo's workflows could assume.

## Result

| | |
|---|---|
| Guest page | Vite + TypeScript, no runtime dependencies |
| Back end | 5 Lambdas (Node 22, arm64), an HTTP API, one DynamoDB table |
| Infrastructure | AWS SAM: a data stack and an app stack per stage, plus an account budget stack |
| Abuse protection | 9 layers, from the WAF to a kill switch |
| Setup | `npm run setup`: one config file, re-runnable |
| Tests | 445 unit tests, 12 Playwright end-to-end tests |
| Build | 35 planned stages, 2 skipped, ~5 weeks |
| Cost | about $1–$2/month while an event is live, well under $1 once archived |

## What I'd Change

- **Get a domain before printing anything.** Tying the printed cards to one CloudFront distribution froze the prod app stack for a month.
- **Ask for the Lambda concurrency increase on day one.** A new account's limit of 10 is a surprise you don't want during an event.
- **Do a real rehearsal with people.** The load test found the bugs, but it can't tell you whether someone's aunt can work the file picker.
- **Resumable uploads.** A single presigned POST is simple and lets S3 enforce the size, but a large video that drops halfway has to start over.
- **A live slideshow.** It's the obvious next feature, and it's been on the "later" list since day one.

## Was it worth it?

Yes. The photos ended up in a bucket I own, at full quality, for about the cost of a coffee. Making it public turned out to be the bigger project, and most of the interesting problems came from the second part. Building something for one event and then for everyone else are pretty different problems.

The architecture, abuse layers, deployment and costs are on the [project page](/projects/shotparty/).
