# DocTracker E2E (Playwright)

End-to-end tests against a running local stack.

## Prerequisites

1. Backend on `http://localhost:4003`
2. Frontend on `http://localhost:3000` with same-origin API proxy:
   - `NEXT_PUBLIC_API_URL=/api-backend`
   - `BACKEND_URL=http://localhost:4003`
3. Seeded demo users (`frontend/TEST_USERS.md`); Master `aisha@example.com` is enough for smoke tests

```bash
# from repo root (example)
cd backend && npm run start:dev
cd frontend && npm run dev
./scripts/bootstrap-contracts-api.sh   # optional: richer demo data
```

## Setup

```bash
cp e2e/.env.example e2e/.env
npm install
npx playwright install chromium
```

## Run

```bash
npm run test:e2e
# headed:
npm run test:e2e:ui
```

Auth setup writes `e2e/.auth/staff.json` (gitignored).
