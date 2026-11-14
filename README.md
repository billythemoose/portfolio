# portfolio

Personal portfolio, blog and CV for Michael Thomas, built with [Astro](https://astro.build/) and [Tailwind CSS](https://tailwindcss.com/).

## Development

Requires Node 24 (see `.nvmrc`).

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # static site in dist/
npm run preview    # serve dist/ locally
npm run check      # type-check .astro and .ts files
npm run check:urls # confirm every URL from the old Jekyll site still exists in dist/
```

## Content

| What               | Where                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| Blog posts         | `src/content/blog/YYYY-MM-DD-slug.md` → `/blog/YYYY/slug/`            |
| Projects           | `src/content/projects/slug.md` → `/projects/slug/`                    |
| CV                 | `src/content/cv.yml` (sections of type `map`, `time_table` or `list`) |
| Resume PDF         | `public/assets/pdf/resume.pdf`                                        |
| About page bio     | `src/content/about.md`                                                |
| Profile photo      | `src/assets/prof_pic.jpg`                                             |
| Name, socials, nav | `src/config.ts`                                                       |

Front matter is validated by the schemas in `src/content.config.ts`, so a typo fails the build.

A blog post:

```md
---
title: My Post
date: 2026-11-02
description: one-line summary shown in the post list
tags: aws migration # space-separated or a YAML list
categories: case-study
draft: true # optional; drafts only appear in `npm run dev`
---
```

A project:

```md
---
title: My Project
description: short summary for the project card
category: technical
date: 2026-11-10 # newest sorts first
repo: https://github.com/billythemoose/my-project
demo: https://demo.example.com
---
```

## Deployment

`.github/workflows/deploy.yml` type-checks, builds and checks URLs on every pull request, and on pushes to `master` syncs `dist/` to S3 and invalidates CloudFront. It signs in to AWS through GitHub OIDC and reads the role, bucket and distribution from the repository secrets `AWS_DEPLOY_ROLE_ARN`, `SITE_BUCKET` and `DISTRIBUTION_ID`.

The AWS infrastructure is a CDK app in `infra/`. Account-specific settings live in `infra/.env` (gitignored; see `infra/.env.example`):

```sh
cd infra
npm install
npx cdk synth                           # writes the template to cdk.out/ (gitignored)
npx cdk deploy --profile <aws-profile>  # prints the values for the three secrets
```
