# Team Handoff

This file carries short-lived working context between teammates and agents. Canonical architecture belongs in `PROJECT_CONTEXT.md`; durable decisions belong in `DECISIONS.md`.

## Current state

- Active objective: finish moving data access from Prisma-in-Next.js to FastAPI endpoints
- Active owner: unassigned
- Branch: main working tree contains the service split, containerization, and the auth rework
- Last verified (2026-09-17): `npm run lint` (one pre-existing unused-variable warning in `profile-view.tsx`), `npm run type-check`, `npm run build`, 80 frontend unit tests, 95 backend pytest tests, and `docker compose up -d --build backend frontend` with all containers healthy after `20260916225140_add_noc_admin_remarks` applied.
- Not yet exercised: signed-in journeys against the running stack. The four defect fixes below are covered by unit tests and, for the application export, by running its SQL against the development database; nobody has clicked Export CSV or approved a NOC in the browser.
- External blocker: resume/document storage provider has not been selected

## Four defect fixes, 2026-09-17

Each has a dated entry in `DECISIONS.md` with the reasoning.

1. **Eligibility now evaluates `allowedDegrees` and `allowedGenders`.** Both were stored and ignored, so a B.Tech-only job admitted an MBA student. Every criterion is now a required argument to both engines, which is what forced all six call sites to be updated.
2. **The application CSV comes from the backend.** The Export CSV control links to `/api/admin/applications/export`, which proxies `GET /api/v1/applications/admin/export`; the Resume Label column is back, and the endpoint gained a `search` parameter so the export matches the screen's free-text box.
3. **`NocRequest.adminRemarks` splits decision remarks from the student's `message`.** Approving or rejecting used to overwrite the student's text. Requests decided before this change keep whatever is in `message` and have a null `adminRemarks`; no data migration tries to guess which is which.
4. **`/admin/interview-experiences` is registered in `ROUTE_PERMISSIONS`, and the admin sidebar is derived from it.** A route missing from that map is now hidden from the navigation rather than visible and ungated.

## What changed in this pass

1. Split the repository into `frontend/`, `backend/`, and `database/`. `frontend` and `database` are npm workspaces sharing the root lockfile.
2. Added `frontend/Dockerfile`, `frontend/Dockerfile.dev`, `backend/Dockerfile`, `backend/Dockerfile.dev`, and `database/Dockerfile`, plus `docker-compose.yml` and `docker-compose.dev.yml`. Migrations run in a one-shot `migrate` container that must exit successfully before the backend starts.
3. Removed the Auth.js credentials provider and the hardcoded `placements@iiitl.ac.in` administrator. `ADMIN_EMAILS` is now the only source of the `ADMIN` role, roles are recomputed per request, and `require_admin` in the backend re-checks the allowlist.
4. Pinned `@auth/core` to `0.41.2` in root `overrides`. `next-auth` and `@auth/prisma-adapter` otherwise resolve different patch versions, which makes their `Adapter` and `JWT` types structurally incompatible and breaks `npm run type-check`.
5. Removed committed `__pycache__` bytecode and expanded `.gitignore`.
6. Made the `AUTH_SECRET` check lazy in `frontend/src/lib/auth.ts`. Throwing at module load broke `next build` inside the image, because the build runs with `NODE_ENV=production` and no secret. The check now runs when a session is actually issued.

## Known next work

1. Port the remaining direct Prisma call sites to FastAPI endpoints. `docs/FEATURE_STATUS.md` lists them under the "Prisma direct" data path; the admin surfaces and the dashboard are the bulk of it.
2. Sign in against the running stack and walk the student and admin journeys end to end, starting with Export CSV on `/admin/applications` and an approve/reject on `/admin/noc-requests`.
3. Select a storage provider and implement PDF-only resume upload with ownership checks.
4. Add persistent announcement publishing and administrator application review.
5. Add encrypted Aadhaar/PAN profile actions using the existing encryption helper.

## Watch out for

- `frontend/next.config.ts` loads the root `.env` through `process.loadEnvFile`, because Next only reads `.env` from its own directory. Removing that breaks host-side `npm run dev`.
- Compose deliberately ignores the root `DATABASE_URL` and builds an in-cluster URL from `POSTGRES_*`. The `.env` value points at `localhost` and is only correct for host-side tooling.
- Next.js workspace builds nest the standalone server at `.next/standalone/frontend/server.js`, which is why the runner stage copies that layout and runs `node frontend/server.js`.
- `TEST_LOGIN_ENABLED`, `TEST_STUDENT_EMAIL`, `TEST_STUDENT_PASSWORD`, `TEST_ADMIN_EMAIL`, and `TEST_ADMIN_PASSWORD` are dead variables, and so are `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` since sign-in became password-only on 2026-09-17.
- An administrator seeded from `ADMIN_EMAILS` has no password and therefore cannot sign in until someone runs `npm run db:set-password -- <email>`. This is the first thing to do on a fresh deployment, and the usual cause of "nobody can log in".
- Do not reintroduce module-scope environment validation in `frontend/src/lib/auth.ts`. `next build` evaluates that module without runtime secrets, so any throw there fails the image build. Compose already fails fast on missing secrets through `${VAR:?}`.

## Handoff template

Copy this section when handing off active work:

```text
Objective:
Owner/agent:
Branch:
Files changed:
Behavior completed:
Verification run:
Known failures:
Blockers/credentials needed:
Recommended next action:
```

Do not place secrets, tokens, private student information, or uploaded files in this document.
