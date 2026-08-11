# DocTracker

A document registry for organisations that run several companies: file scans and
documents, route them through approval workflows, and control who can reach what.

Access is **need-to-know**. Filing a folder under a department records where it
belongs — it does not by itself let that department in. Reaching a folder or
document requires a grant naming you, your department or your division.

**End-user guide:** [USER_MANUAL.md](USER_MANUAL.md)

---

## Running it

Everything runs in Docker.

```bash
cp .env.example .env                       # compose ports and DB credentials
cp backend/.env.example backend/.env       # then set JWT_SECRET
cp frontend/.env.example frontend/.env.local

docker compose up --build
```

Then, once for a new database:

```bash
docker compose exec backend npx prisma db push
docker compose exec backend npm run prisma:seed
```

| Service  | URL                     |
| -------- | ----------------------- |
| Frontend | http://localhost:3001   |
| Backend  | http://localhost:4003   |
| Postgres | `localhost:5433`        |

Ports are set in the root `.env`. The defaults avoid 5432 and 3000, which are
commonly already taken.

Generate a `JWT_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The backend refuses to start without one — a hard-coded fallback would mean
anyone could mint valid tokens against a misconfigured deployment.

### Useful commands

```bash
docker compose logs -f backend        # follow the API
docker compose down                   # stop, keep the database
docker compose down -v                # stop and wipe the database
docker compose exec backend npm run prisma:studio
```

Source is bind-mounted, so both apps hot-reload. `node_modules` and the
backend's `dist/` are named volumes: they are platform- and build-specific, and
sharing them with the host makes host builds and the container's watcher
overwrite each other.

---

## Signing in

`npm run prisma:seed` creates two companies, four departments, four divisions
and one user per role. Password for all of them: `Password123!`
(override with `SEED_PASSWORD` in `backend/.env`).

| Email                  | Role                 | Placement                        |
| ---------------------- | -------------------- | -------------------------------- |
| `alice@example.com`    | Master               | every company                    |
| `grace@example.com`    | Group Secretary      | every company                    |
| `sade@example.com`     | Company Secretary    | Acme Corporation                 |
| `tomas@example.com`    | Company Secretary    | Tech Solutions Ltd               |
| `charlie@example.com`  | Company Admin        | Acme / Legal                     |
| `hannah@example.com`   | Company Admin        | Tech Solutions / Engineering     |
| `bob@example.com`      | Department Head      | Acme / Legal                     |
| `diana@example.com`    | Department Head      | Acme / HR                        |
| `julia@example.com`    | Department Secretary | Acme / Legal                     |
| `edward@example.com`   | Division Head        | Acme / Legal / Contracts         |
| `jane@example.com`     | Manager              | Acme / HR                        |
| `john@example.com`     | Staff                | Acme / Legal / Contracts         |
| `fiona@example.com`    | Staff                | Acme / Legal / Compliance        |
| `george@example.com`   | Staff                | Acme / Finance / Accounting      |
| `ivan@example.com`     | Staff                | Tech Solutions / Eng / Dev       |
| `rita@example.com`     | Receptionist         | Acme                             |

The seed also plants two deliberate exceptions, so the permission UI has real
cases to show:

- **John** is granted read+write on *Compliance Documents*, a division he is not
  in — a grant reaching past his scope.
- **Fiona** is denied *Legal Documents*, which her department grant would
  otherwise open — a deny overriding a grant.

---

## How permissions work

Two independent things decide whether an action is allowed. **Both** must pass.

### 1. Capability — "may this role do this kind of thing at all?"

Defined once, in [`backend/src/permissions/capabilities.ts`](backend/src/permissions/capabilities.ts),
and stored on `Role.permissionsJson` by the seed. Examples: `documents.delete`,
`folders.manage_permissions`, `users.manage`.

The role → capability mapping lives **only** in the backend. The API resolves it
per request and ships the result on the session, and the frontend reads that
list. Nothing in the UI re-derives permissions from a role name, which is what
stops the interface and the server from drifting apart.

### 2. Access — "may they reach this particular folder or document?"

Decided in [`backend/src/permissions/permissions.service.ts`](backend/src/permissions/permissions.service.ts),
in this order:

1. **Master** (`dataScope: 'all'`) reaches everything. This is deliberate: it
   guarantees a resource can always be recovered. Without it, an administrator
   who denied themselves `manage` would lock a folder permanently.
2. Another company's resource is **always** refused below that level.
3. A matching **deny** beats any grant.
4. The role must carry the capability for the verb.
5. **Company-wide roles** (Company Admin, Company Secretary) reach their own
   company. Everyone else needs an ACL entry naming them, their department or
   their division.
6. Failing all that, whoever created a record keeps access to it.

ACL entries live on `Folder.permissionsJson` and `FileFolderLink.permissionsJson`
and cascade down the folder tree. An entry set on a subfolder overrides the one
it inherits for the same subject.

**What a grant reaches**

- **Granting a folder** reaches everything inside it — its files, and its
  subfolders and their files.
- **Granting a single file** reaches only that file. The person can then *open*
  the containing folder, but it shows only the files they were granted; the rest
  stay hidden. Without this they would hold a file they had no way to navigate
  to.
- **Folders you cannot open are still listed**, greyed out with a reason and a
  Request access button. Documents inside them are not listed — folder names are
  organisational, document names are not.
- **A new folder opens to whoever it was filed for.** Creating a folder "for the
  Legal department" writes a real, revocable ACL entry granting that department
  read/write/share. Without it, need-to-know would make every new folder
  invisible to everyone but its creator.

**Folder depth** is capped at three levels (`FilesService.MAX_FOLDER_DEPTH`).
Beyond that the breadcrumb stops being readable and people lose track of where a
document actually lives. The create-folder dialog will not offer a parent that is
already at the limit, and the API rejects it with a 400.

### Rate limits

Configured in [`backend/src/auth/throttle-config.ts`](backend/src/auth/throttle-config.ts).
What each bucket is keyed by matters more than the numbers:

| Bucket             | Keyed by       | Limit                    | Applies to           |
| ------------------ | -------------- | ------------------------ | -------------------- |
| `default`          | client IP      | 600/min                  | the whole API        |
| `credentials`      | account + IP   | 10/min, then 5-min block | sign-in, reset, register |
| `credential-burst` | client IP      | 100/min                  | the same endpoints   |

Keying sign-in on IP alone is the trap: a whole office behind one NAT would
share a single allowance, and the eleventh colleague to arrive would be locked
out having done nothing wrong. Keying on **account + IP** contains a brute-force
attempt to the account being attacked, and the looser IP bucket behind it still
stops one host spraying guesses across many accounts.

`trust proxy` must stay set in `main.ts`, or every request arrives wearing the
proxy's IP and the buckets collapse into one.

### Changing access

`Manage access` on a folder or document grants to a **person, a department or a
division**, as allow or deny. When access is taken away, the person is notified,
the change is written to the audit trail, and the administrator chooses what
happens to work already assigned to them — leave it alone, or flag their open
actions so the action's owner can reassign.

---

## Layout

```
backend/          NestJS + Prisma + Postgres
  src/permissions/  capabilities.ts (the vocabulary), acl.ts, permissions.service.ts
  prisma/seed.ts    demo data, and the role catalogue
frontend/         Next.js App Router
  lib/permissions.ts        mirrors the server decision, for rendering only
  lib/hooks/use-permissions.ts
```

Anything in the frontend decides what the interface *shows*. It is never the
boundary — the API applies the same rules again on every request.
