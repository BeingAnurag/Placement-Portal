# Architectural Decisions

This is a lightweight decision log. Append a dated entry when changing a decision; do not rewrite history.

## 2026-07-12 — Full-stack Next.js

Use the Next.js App Router for UI, server actions, and route handlers so authorization and validation remain close to each workflow.

## 2026-07-12 — PostgreSQL and Prisma

Use PostgreSQL as the sole application database and Prisma as the sole ORM. Local development uses PostgreSQL 16 through Docker Compose.

## 2026-07-12 — Auth.js with JWT sessions

Use Google OAuth for institute accounts and JWT sessions for compatibility with database-free development credentials. Server-side route guards enforce roles.

## 2026-07-12 — Development credentials

Expose documented student/admin credentials only outside production so contributors can work before Google credentials are available.

## 2026-07-12 — Encrypted identity fields

Encrypt Aadhaar and PAN using AES-256-GCM with a 32-byte environment key. Store IV, authentication tag, and ciphertext together; never store plaintext.

## 2026-07-13 — Repository as shared agent memory

Treat `AGENTS.md` and `docs/PROJECT_CONTEXT.md` as the canonical onboarding context for humans and AI agents. Tool-specific instruction files must point back to these canonical files rather than duplicating project facts.

## 2026-07-17 — External administrator allowlist

Keep student Google access restricted to `@iiitl.ac.in`, while permitting explicitly trusted external Google accounts to receive `ADMIN` through the comma-separated `ADMIN_EMAILS` environment variable. Authorization remains enforced in the Auth.js callback and JWT role assignment.

## 2026-08-20 — FastAPI owns data access; Prisma owns the schema

Supersedes the data-access half of *2026-07-12 — Full-stack Next.js*. A FastAPI service had already been added under `backend/` without a decision entry, leaving two ORMs against one database: Prisma called directly from Next.js server actions, and SQLAlchemy behind FastAPI. That split is now resolved deliberately.

- `backend/` (FastAPI + SQLAlchemy) is the single owner of application data access. All remaining direct Prisma calls in the frontend are to be ported to backend endpoints.
- `database/` (Prisma) remains the single owner of the schema, migrations, and seed data. The SQLAlchemy models in `backend/app/models/db.py` mirror `schema.prisma` and must never run `create_all()` or otherwise migrate.
- `frontend/` is a Next.js UI client. It keeps Prisma only for the Auth.js adapter and the not-yet-ported pages listed in `docs/FEATURE_STATUS.md`.
- The frontend authenticates to the backend with a short-lived HS256 JWT signed with the shared `AUTH_SECRET`.

The Next.js App Router, server actions, and server-side authorization decisions from 2026-07-12 still stand; only the location of data access changed.

## 2026-08-20 — Service-per-container repository layout

Split the repository into `frontend/`, `backend/`, and `database/`, each with its own Dockerfile, plus `docker-compose.yml` for a production-style stack and `docker-compose.dev.yml` for hot reload. `frontend` and `database` are npm workspaces sharing one root lockfile, because a single Prisma schema cannot resolve a client across two independent `node_modules` trees. Compose builds the in-cluster `DATABASE_URL` from the `POSTGRES_*` values rather than passing the root `.env` value through, which points at `localhost` for host-side tooling.

Schema migrations run in a dedicated one-shot `migrate` container that must exit successfully before the backend starts, so no service ever boots against an out-of-date schema.

## 2026-08-20 — Google-only sign-in; `ADMIN_EMAILS` is the only admin source

Supersedes *2026-07-12 — Development credentials*.

- The Auth.js credentials provider is removed. Google is the only sign-in method in every environment. The previous development accounts returned synthetic user ids that did not exist in the database, which broke Prisma-backed admin pages.
- `placements@iiitl.ac.in` is no longer hardcoded as an administrator. `ADMIN_EMAILS` is the only source of the `ADMIN` role; when it is empty, nobody is an administrator.
- The student domain is configurable through `STUDENT_EMAIL_DOMAIN` and matched on the exact domain rather than a suffix, so lookalike domains cannot pass.
- Roles are recomputed from `ADMIN_EMAILS` on every request and reconciled in the database on every sign-in, so removing an address revokes access immediately instead of when the session expires. `require_admin` in the backend re-checks the allowlist rather than trusting the signed role claim alone.

## 2026-08-21 — Link Google accounts to existing users by email

Refines *2026-08-20 — Google-only sign-in*. The seed creates a `User` row for every address in `ADMIN_EMAILS` before that person has ever signed in. Auth.js refuses by default to attach an OAuth account to an existing user row with the same email, so every administrator's first Google sign-in failed with `OAuthAccountNotLinked`.

`allowDangerousEmailAccountLinking` is therefore enabled on the Google provider. The flag is only dangerous when a second, non-verifying provider can assert an address that already belongs to somebody else. Google is the only provider, the credentials provider is gone, and the `signIn` callback rejects a profile whose `email_verified` claim is `false`, so an address cannot be claimed without Google having verified ownership.

Do not add a second provider without revisiting this. Any provider that does not verify email ownership would, combined with this flag, allow account takeover by email collision.

## 2026-08-21 — Palette derived from the institute logo

Supersedes the navy/orange palette recorded under *UI system* in `docs/PROJECT_CONTEXT.md`. The previous colours (`#102A43`, `#2563EB`, `#F97316`) were generic Tailwind-family values chosen before the institute logo was available, and they did not match the mark shown in the header.

The palette is now sampled directly from `frontend/public/iiitl-logo.png`: blue `#005F99`, deep blue `#00446D`, circuit green `#008325`, arch orange `#DE6C1A`, brown `#782D0D`. These are declared as CSS custom properties in `globals.css` and the previously hardcoded brand hex values throughout `globals.css` and `admin.css` were migrated onto the same family.

Two consequences worth keeping:

- Success states moved from the teal-leaning emerald family to the logo's green, so positive feedback reads as part of the brand rather than as a generic Tailwind accent.
- Brand marks render the logo on a white tile. The logo's blue and green have too little contrast against the dark sidebar to sit directly on it, and recolouring the logo is not an option.

Add new colour work as tokens. Literal brand hex values in component styles are what made this migration a 108-replacement change rather than a one-line one.

## 2026-08-25 — Semantic light/dark theme system & left-aligned application funnel

- **Theme Architecture**: Added dark mode support across student and admin surfaces via semantic CSS custom properties in `globals.css` and `admin.css`. A React `ThemeProvider` (`theme-provider.tsx`) synchronized with `localStorage` and the OS `prefers-color-scheme` media query via `useSyncExternalStore` manages `'light' | 'dark' | 'system'` modes with zero hydration flash.
- **Application Funnel**: Redesigned the admin dashboard application funnel from a centered staggered layout to a left-aligned horizontal stage breakdown with proportional volume bars, stage indicators, and guarded conversion percentage calculations.

## 2026-08-25 — Hierarchical RBAC & Granular User Management

- Extended the database role hierarchy from binary `[STUDENT, ADMIN]` to `[STUDENT, COORDINATOR, OFFICER, ADMIN, SUPER_ADMIN]`.
- Implemented a 16-permission RBAC catalog across all portal domains with category groupings, role defaults, and custom per-user permission overrides (`customPermissions String[]` on `User`).
- Added full user management capabilities on `/admin/users` (user provisioning, role elevation & de-elevation, custom permission matrix configuration, account activation/suspension, and safe user deletion).
- Built security guardrails against self-demotion, self-deactivation, self-deletion, and removal of the last active super-administrator, while preserving `ADMIN_EMAILS` as the emergency bootstrap superadmin source.

## 2026-08-25 — Persistent Announcement Lifecycle Management

- Implemented persistent announcement management (`add`, `edit`, `delete`, `preview`, `filter`, and `tag`) across FastAPI (`/api/v1/announcements`) and Next.js admin & student surfaces.
- Secured administrative operations with `announcements:manage` permission checks (`SUPER_ADMIN`, `ADMIN`, `OFFICER`, `COORDINATOR` by default).
- Added multi-category classification (`COMPANY_EVENT` vs `GENERAL`), associated company tagging, and preset/custom pill tags (Shortlists, Interviews, Drive, PPT, Policies, Urgent).
- Enhanced student dashboard feed with search by title/content/tags/company, category filtering, tag indicators, and a detail inspection modal for multi-line instructions and test links.

## 2026-08-25 — NOC Requests & Support Feedback Lifecycle Workflows

- **NOC Requests Architecture**: Implemented full student lifecycle (`POST /api/v1/noc`, `PATCH /api/v1/noc/{id}/cancel`, inspection modal, signed certificate in-portal preview and download) and administrative management (`GET /api/v1/noc/admin`, `/approve`, `/reject`, `/document`, `/metrics`) guarded by `noc:manage` permission.
- **Signed Certificate Handling**: Signed NOC certificates are uploaded through authenticated multipart endpoints to disk storage (`noc_docs/`) and served with authorization checks allowing student owners and placement administrators to view and download their documents.
- **Feedback & Queries Lifecycle**: Implemented student submission (`POST /api/v1/feedback`) with multi-type categorization (`QUERY`, `FEEDBACK`, `COMPLAINT`) and structured JSON storage; student history with type/resolution filters; and administrative workspace (`GET /api/v1/feedback/admin`, `POST /api/v1/feedback/admin/{id}/respond`, `DELETE`) guarded by `feedbacks:manage` permission.
- **Student Notifications**: Admin NOC approval/rejection and feedback responses trigger automated in-app `Notification` records and background email dispatch.

## 2026-08-25 — Placement Team Lifecycle & Default Permissions Architecture

- **Dynamic Public Directory**: Replaced hardcoded presentation on `/team` and `/contact` with dynamic database loading of `TeamMember` records ordered by `displayOrder`, with photo and tonal initials avatar fallbacks.
- **Administrative Team Workspace**: Implemented full management on `/admin/team` (create, update, delete, reorder) guarded by `team:manage` permission, with linked `User` account indicators and direct links to User Management.
- **Default Permissions Management**: Added `SystemSetting` table (`key`, `value`, `updatedAt`) in Prisma and SQLAlchemy to persist the admin-configurable default permissions set for the single placement team (`placement_team_default_permissions`).
- **Automated Permission Synchronization**: Adding a team member with an email automatically assigns the placement team's default permissions to their `User.customPermissions` (and on new user creation in `auth.ts`). Removing a member automatically revokes the default permissions while preserving any prior custom permissions. Admins retain full control to further adjust individual permissions manually in User Management.

## 2026-09-15 — Interview Experiences (moderated community submissions)

Replaces the manual Google Form previously used to collect company-wise interview questions from students.

- Added an `InterviewExperience` model (Prisma-owned schema, SQLAlchemy mirror) capturing company, role, batch, interview type, and one optional free-text field per question category from the old form (DSA, OOPS, DBMS, OS, CN, SQL, system design, CS fundamentals, resume, projects, coding, aptitude, HR, behavioral, resources, unanswered questions, tips).
- **Moderation, not open publishing**: submissions start `PENDING` and are only visible to other students once an admin/coordinator with the new `interview_experiences:manage` permission (`SUPER_ADMIN`, `ADMIN`, `OFFICER` by default) approves them, mirroring the NOC request review workflow rather than the always-visible Feedback pattern. This keeps a single Placement Cell as the quality gate against copy-pasted or low-effort submissions, same as review of NOC requests.
- **Company is free text**, not a foreign key to `Company`, because students report on off-campus and pooled-campus interviews at companies the admin may never have added to the portal — the same reasoning already applied to `NocRequest.company`.
- **Submissions are locked after posting**: students cannot edit or delete their own entries once submitted, only admins can (edit is not yet implemented; delete is). This avoids a published, publicly-read record silently changing under readers after the fact.
- Endpoints live under `/api/v1/interview-experiences` (`FastAPI`): student submit/list-mine/browse-approved/company-list, and admin list/approve/reject/delete guarded by the new permission. Approval and rejection notify the author via in-app `Notification` and background email, matching the NOC/Feedback pattern.
- This is the 17th entry in the RBAC permission catalog; the RBAC user-management matrix picks it up automatically from `PERMISSION_METADATA` / `PERMISSION_DEFINITIONS`, no separate UI change needed.

## 2026-09-16 — Flag students on a missed-eligible-company streak

Added `GET /api/v1/students/admin/flags` (new `students` FastAPI router) and a "needs follow-up" badge/filter on `/admin/students`, so the placement cell can spot students who are eligible but not applying.

- **The rule is a consecutive streak, not a raw count**: a student is flagged when there exist 3 or more companies *in a row*, ordered chronologically by `registrationDeadline`, for which the student was shown eligible (via the existing shared `evaluate_eligibility`/`is_eligible` engine — no third eligibility algorithm) but applied to none of them. A student who skipped companies 1–2 and 6, applied to 3–5, is not flagged even though they skipped 3 total, because the misses aren't consecutive. This was an explicit product clarification, not the more obvious "eligible for 3+, applied to fewer than 3" reading.
- **Grouped by company, not by job profile**: a company posting two roles the student is eligible for counts once, and an application to either role clears that company's slot. Chronological position uses the earliest eligible job's `registrationDeadline` at that company.
- **Eligibility scope is "was ever shown", not "currently open"**: both `ACTIVE` and `ENDED` job profiles count; only `DRAFT` is excluded, since a draft was never visible to any student. This intentionally includes past drives so the flag reflects the whole season, not just what's still open.
- The heavy lifting (`compute_missed_streak`) lives in `app/services/student_flags.py` as a pure, DB-free function over plain dicts, unit tested directly in `backend/tests/test_student_flags.py` — the router only loads rows and shapes them into that function's input.
- The admin students directory (`/admin/students`) itself is still Prisma-direct (legacy, per the 2026-08-20 decision); this feature was added as a new FastAPI endpoint the page additionally calls via `backendFetch`, rather than porting the whole directory or adding a new Prisma call for it.

## 2026-09-17 — `cmdk` for searchable pickers; still no UI component kit

Refines the *UI system* section of `docs/PROJECT_CONTEXT.md` and the 2026-08-21 palette decision. The interview-experience form offers a curated list of ~1000 recruiters (`frontend/src/lib/company-options.ts`), which is unusable as a native `<select>` and awkward as a `<datalist>`.

`cmdk` is added as the single new UI dependency, wrapped by `frontend/src/components/common/company-picker.tsx`. It was chosen over a component kit deliberately:

- **Material UI** was rejected: it ships an Emotion CSS-in-JS runtime, the Material Design visual language, and its own `ThemeProvider`, which would run in parallel with the CSS-custom-property theme system from 2026-08-25 and fight it.
- **HeroUI** was rejected: it is configured as a Tailwind plugin through `tailwind.config.js`, and this repo runs Tailwind 4 with CSS-first config and no JS config file.
- **shadcn/ui** was not adopted wholesale, but is the right choice if a kit is ever wanted, because it copies source into the repository rather than adding a dependency. `cmdk` is the primitive its `Command` component wraps, so adopting shadcn later does not invalidate this.

Components remain styled with repository-owned semantic CSS in `globals.css` using the existing logo-derived tokens; `cmdk` is unstyled and contributes behaviour (filtering, keyboard navigation, `aria-selected`) only. Do not add a component kit without a new entry here.

The picker submits through a hidden input so the company rules stay in the Zod schema at the server boundary rather than being duplicated client-side, and `allowCustom` preserves the free-text company decision from 2026-09-15.

## 2026-09-17 — Teal palette replaces the logo-derived palette

Supersedes *2026-08-21 — Palette derived from the institute logo*. The blue/orange/green sampled from `iiitl-logo.png` is replaced site-wide, in both themes, by a single teal ramp chosen by the placement cell:

`#def7f9 · #92dce2 · #35bdc8 · #2ca0ab · #20808d · #1a6872 · #114f56 · #0b363c · #081f22`, anchored by `#091717` (darkest surface) and `#fbfaf4` (lightest surface).

- **The ramp is the only place literal brand hex values may appear.** It is declared once in the first `:root` block of `globals.css`; every rule reads a semantic token. The 2026-08-21 warning still applies and is the reason this migration was a token edit rather than another 108-replacement sweep.
- **Token names were kept, values remapped.** `--blue`, `--navy`, `--navy-deep`, and `--brown` now resolve to rungs of the teal ramp. Renaming them would have touched ~400 declarations across `globals.css` and `admin.css` for no behavioural gain; the names are now hue-inaccurate, which is the deliberate cost.
- **`rgba()` tints read channel tokens.** `rgba()` cannot consume a hex custom property, so `--brand-rgb`, `--deep-rgb`, `--shadow-rgb`, `--warning-rgb`, `--success-rgb`, and `--danger-rgb` carry the channels separately and are themed alongside the hex tokens. Previously these tints were frozen hex triplets that silently kept the old blue and orange when the theme changed.
- **Status hues deliberately survive the migration.** Green (success), orange (warning/pending/interview), red (error), and purple (shortlisted) are not teal. A monochrome portal would make the application funnel stages and the resolved/pending badges indistinguishable, so those colours now carry meaning only, never brand identity. Orange in particular was demoted: it was the CTA, eyebrow, and active-nav colour, and all of those are now teal.
- **Both sidebars share one gradient.** The student shell was navy and the admin shell was brown; they now both read `--sidebar-from`/`--sidebar-to`, with `--on-brand`, `--on-brand-soft`, and `--on-brand-muted` for text on those always-dark surfaces.
- The logo still renders on a white tile, for the contrast reason recorded in 2026-08-21. That has not changed and recolouring the logo is still not an option.

## 2026-09-17 — The dark theme is black with teal chrome

Refines *2026-09-17 — Teal palette replaces the logo-derived palette*, which is otherwise unchanged. That migration mapped every dark surface onto the teal ramp itself: the page was `#091717`, cards `#0c2124`, alternate surfaces `#0e2a2e`. The result was a uniformly teal dark theme in which nothing could accent, because the accent and the background shared a hue.

Dark mode is now black underneath with teal on everything layered above it.

- **The base is black and comes from two new tokens** declared alongside the teal ramp in the first `:root` block of `globals.css`: `--black-950` `#000000` for the page and for recessed input wells, and `--black-900` `#0d1112` for cards. `--black-900` keeps a trace of the brand hue (blue channel highest, red lowest) so it does not read as a second, unrelated grey palette. Previously these surfaces were loose inline hexes inside the `[data-theme="dark"]` block, which is why they drifted from the ramp; that block now reads tokens only, and the palette block stays the one place literal colour hexes appear.
- **Chrome is teal, not grey.** `--border` is `--teal-800`, `--border-subtle` and `--surface-highlight` are `--teal-900`, and `--surface-alt` is `--teal-950`. Card outlines, input outlines, table headers, row hovers, chips, and track backgrounds therefore carry the brand at the same lightness a neutral grey would have had. A neutral-bordered version was built first and rejected as too austere: with black surfaces, borders and headers are the only chrome large enough to carry brand identity.
- **Deep-fill tokens invert by theme.** `--navy`/`--navy-deep` are `--teal-800`/`--teal-900` on paper but `--teal-600` (`#20808D`) / `--teal-700` on black, because a deep teal button against a black page is unreadable. The token names describe the role, not the lightness — the same deliberate naming cost recorded in the parent entry.
- **`--blue` is `--teal-500` in dark, not `--teal-400`.** It must survive two jobs: 10px accent text directly on black, and an icon glyph on a `--teal-900` badge tile. `--teal-600` fails the second (2.8:1) and `--teal-400` reads as cyan rather than as the requested `#20808D` family; `--teal-500` clears both (6.7:1 and 4.1:1).
- **The login hero is the one surface with a theme-specific rule.** `.login-story` is a solid brand gradient on paper, but in dark mode it drops to the page black with a faint `--brand-rgb` glow and a `--border` divider, so the dark theme has no large teal field. It is the only place a component rule branches on the theme instead of reading a token; a `--hero-*` token pair for a single element was not worth it.
- Status hues stay untouched, per the parent entry. The light theme is unchanged. Verified in both themes against the admin shell, metrics, funnel, tables, toolbar inputs, form fields, banners, badge chips, and the login page.
