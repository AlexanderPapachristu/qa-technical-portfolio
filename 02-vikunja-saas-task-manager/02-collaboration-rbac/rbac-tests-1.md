# RBAC Tests 1: How to run TC-RBAC-01 to TC-RBAC-30

This guide covers how to set up and run every test in [test-matric-permissions.md](test-matric-permissions.md), and what each test does step by step.

| File | Tool | What it covers |
|---|---|---|
| [tests/rbac-tests-1.spec.ts](../tests/rbac-tests-1.spec.ts) | Playwright | All 30 cases: UI steps plus API steps through Playwright's `request` context |
| [api-artifacts/rbac-tests-1.json](../../api-artifacts/rbac-tests-1.json) | Postman / Newman | API steps for all 30 cases, one folder per test case |
| [api-artifacts/fixtures/rbac-attachment.txt](../../api-artifacts/fixtures/rbac-attachment.txt) | Postman | File uploaded in TC-RBAC-19 |

The UI-only parts of the matrix (hidden controls, missing menu items, password prompt, behaviour during an open session) are only in Playwright. The Postman collection checks the API side of the same cases.

---

## 1. One-time setup

### 1.1 Start a local Vikunja (recommended)
try.vikunja.io resets at irregular intervals and deletes your accounts. A local instance in Docker keeps them until you choose to wipe it.

1. Install Docker Desktop (`winget install Docker.DockerDesktop`) and start it.
2. Fill in `.env` as in 1.2 below, with `VIKUNJA_URL=http://localhost:3456`. Passwords must be at least 8 characters.
3. From `02-vikunja-saas-task-manager/`:
   ```bash
   npm run vikunja:up
   ```
   This starts Vikunja 2.7.1 and Postgres from [docker-compose.yml](../docker-compose.yml) and runs [scripts/seed-accounts.js](../scripts/seed-accounts.js), which registers every account in `.env`. Accounts that can already log in are skipped, so it's safe to run every time.
4. Open `http://localhost:3456` to use the UI.

| Command | What it does |
|---|---|
| `npm run vikunja:up` | Start the containers and create any missing accounts |
| `npm run vikunja:seed` | Create missing accounts only (e.g. after adding one to `.env`) |
| `npm run vikunja:down` | Stop the containers. Accounts and data are kept. |
| `npm run vikunja:clean` | Delete the projects, tasks, teams and labels left by test runs (runs automatically after each suite) |
| `npm run vikunja:reset` | Delete the containers **and all data**. Run `vikunja:up` again to start fresh. |
| `npm run vikunja:logs` | Follow the Vikunja server log |

The instance only listens on `127.0.0.1`, so nothing on your network can reach it. The seed script refuses to run against any host other than localhost.

### 1.1b Or use try.vikunja.io
Set `VIKUNJA_URL=https://try.vikunja.io` and register each account by hand at `https://try.vikunja.io/register`. You'll have to do this again whenever the demo resets.

| Account | Username | `.env` keys | Postman variable |
|---|---|---|---|
| A | `User-Owner` | `OWNER_USER` / `OWNER_PASS` | `owner_pass` |
| B | `User-Write` | `WRITE_USER` / `WRITE_PASS` | `write_pass` |
| C | `User-Read` | `READ_USER` / `READ_PASS` | `read_pass` |
| D | `User-Unrelated` | `UNRELATED_USER` / `UNRELATED_PASS` | `unrelated_pass` |
| E | `User-ShareAdmin` | `SHAREADMIN_USER` / `SHAREADMIN_PASS` | `admin_pass` |
| F | `User-Team` | `TEAM_USER` / `TEAM_PASS` | `team_pass` |

`TASK_USER` / `TASK_PASS` (`test_account`) is the account the task-lifecycle specs log in with. Add it if you want those specs to run locally too.

### 1.2 Fill in `.env`
Copy `.env.example` to `.env` in `02-vikunja-saas-task-manager/` and fill in all six passwords. `.env` is git-ignored. Never commit it. `VIKUNJA_URL` decides which instance every Playwright spec and the seed script use.

### 1.3 Project data (you don't create this yourself)
Both suites build their own test data on every run, so you never set up projects by hand. `beforeAll` (Playwright) or the `00 Setup` folder (Postman) does the following:

1. Logs in all six accounts and stores a token for each.
2. As `User-Owner`, creates project **P** (`RBAC Test Project <timestamp>`) with a seed task, child project **C1** under P (with its own task), and project **Q**.
3. Shares P with `User-Write` at Write (1) and with `User-ShareAdmin` at Admin (2). Playwright also shares P with `User-Read` at Read (0). In Postman, that share is the TC-RBAC-01 request itself.
4. Shares Q with `User-Write` at Read (0).
5. Creates a team, adds `User-Team` to it, and shares P with the team at Read (0).

Destructive tests (TC-07, 11, 23, 25, 26, 30) create their own throwaway project, so they never change P. That means you never need to rebuild P between runs. When a run finishes, [scripts/cleanup-test-data.js](../scripts/cleanup-test-data.js) deletes everything the suites created. It runs as Playwright's global teardown and at the end of `npm run test:api`, and you can run it yourself with `npm run vikunja:clean`. For every test account it deletes all owned projects (with their tasks), the tasks in the Inbox, its teams and its `rbac-` labels. It keeps the accounts, each Inbox, and the seeded `RBAC Test Project`. To keep the data for debugging, set `KEEP_TEST_DATA=1` before the run.

---

## 2. Running the tests

### Playwright (from `02-vikunja-saas-task-manager/`)
```bash
npx playwright test tests/rbac-tests-1.spec.ts --project=rbac-chromium
```
To run all three browsers use `npm run test:ui`. The spec is matched by the `RBAC` pattern in `playwright.config.ts`, so it runs without the saved login from `auth.setup.ts`. Open the report with `npx playwright show-report`.

### Postman / Newman (from the repository root)
```bash
newman run api-artifacts/rbac-tests-1.json --env-var owner_pass=YOUR_PASS --env-var write_pass=YOUR_PASS --env-var read_pass=YOUR_PASS --env-var unrelated_pass=YOUR_PASS --env-var admin_pass=YOUR_PASS --env-var team_pass=YOUR_PASS
```
`base_url` defaults to the local instance (`http://localhost:3456/api/v1`). To run against the public demo, add `--env-var base_url=https://try.vikunja.io/api/v1`. In the Postman app, set `base_url` in your environment instead.

In the Postman app, import the file, create a local environment with the six `*_pass` variables, and run the whole collection with the Collection Runner. **Run the folders in order:** each folder depends on the IDs saved by `00 Setup`. Run from the repository root so the TC-RBAC-19 attachment path resolves.

---

## 3. Differences from the matrix (Vikunja v2.7 API)

| Matrix says | What the tests use | Why |
|---|---|---|
| `GET /projects/{P}/tasks` | `GET /projects/{P}/views/{list view}/tasks` | Vikunja v2 lists tasks through a project view. The suites look up the list view's ID during setup. |
| `/projects/{P}/users/{user id}` | `/projects/{P}/users/{username}` | Vikunja's `{userID}` path segment is matched against the username. |
| TC-06 label edit returns `200` | `201 Created` | Adding a label (`PUT /tasks/{id}/labels`) is a create endpoint. |
| `POST /tasks/{id}` with a partial body | The full task object with one field changed | Vikunja's update replaces the whole task. The tests send what `GET /tasks/{id}` returned and change only the field under test, so the only possible failure is the permission check. |

---

## 4. Step-by-step for each test case

Actors are written as A–F from the Accounts table. "Owner check" means a follow-up request made as `User-Owner` to prove nothing changed.

### Core sharing
**TC-RBAC-01: Share project at Read**
1. A: `PUT /projects/{P}/users` with `{"username":"User-Read","permission":0}`. Expect `201` with permission `0`.
2. A: `GET /projects/{P}/users`. `User-Read` is listed at `0`.
3. C: `GET /projects?s=<P title>`. P is in the list.
4. *Playwright only:* A opens `/projects/{P}/settings/share`. The `User-Read` row shows "Read only".

### Read user (C)
**TC-RBAC-02: Read user views the project**
1. C: `GET /projects/{P}` gives `200` (Postman also checks `max_permission` is `0`).
2. C: list P's tasks. `200` and the seed task is listed.
3. *Playwright:* C opens P in the UI. The seed task renders and the "Add a task…" input isn't there. The task detail opens without a "Mark task done" button.

**TC-RBAC-03: Read user tries to create a task in the UI** *(Playwright)*
1. A records P's task count.
2. C opens P. There's no "Add a task…" input. C presses `t` (add-task shortcut), then `Ctrl+K` (quick actions), types a probe title and presses Enter.
3. Owner check: the task count is unchanged and no probe task exists. (Postman runs only the owner check.)

**TC-RBAC-04: Read user creates a task via API.** C: `PUT /projects/{P}/tasks` `{"title":"rbac-probe"}` gives `403`. Owner check: no `rbac-probe` task.

**TC-RBAC-05: Read user deletes a task via API.** C: `DELETE /tasks/{task}` gives `403`. Owner check: `GET /tasks/{task}` gives `200`.

**TC-RBAC-16: Read user updates a task.** C: `POST /tasks/{id}` with a new title gives `403`. Owner check: title unchanged.

**TC-RBAC-17: Read user marks a task as done.** C: `POST /tasks/{id}` with `done: true` gives `403`. Owner check: `done` is still `false`.

**TC-RBAC-18: Read user adds a comment.** A counts the comments. C: `PUT /tasks/{id}/comments` gives `403`. Owner check: the count is unchanged.

**TC-RBAC-19: Read user adds an assignee, label or attachment**
1. C gets their own user ID (`GET /user`) and creates a label of their own (`PUT /labels`, `201`, which is allowed).
2. C: `PUT /tasks/{id}/assignees`, `PUT /tasks/{id}/labels` and `PUT /tasks/{id}/attachments` (multipart upload) each give `403`.
3. Owner check: the task has no assignees, labels or attachments.

**TC-RBAC-20: Read user moves a task on the Kanban board**
1. A: `GET /projects/{P}/views/{kanban}/tasks`. Finds the bucket that holds the seed task and picks a different bucket.
2. C: `POST /projects/{P}/views/{kanban}/buckets/{other}/tasks` `{"task_id":…}` gives `403`.
3. Owner check: the task is still in its original bucket.

### Write user (B)
**TC-RBAC-06: Write user creates and edits a task**
1. B: `PUT /projects/{P}/tasks` "Draft QA Architecture" gives `201`.
2. B: `POST /tasks/{new}` with a due date gives `200`.
3. B: `PUT /labels` (`201`), then `PUT /tasks/{new}/labels` gives `201`.
4. Owner check: the task, the due date and the label are all visible.

**TC-RBAC-07: Write user deletes the project** *(destructive, throwaway project)*
1. A creates a throwaway project and shares it with B at Write.
2. *Playwright:* B opens the project settings menu. "Edit" is visible but "Delete" isn't.
3. B: `DELETE /projects/{id}` gives `403`. Owner check: `GET` gives `200`.

**TC-RBAC-08: Write user promotes self to Admin.** B: `POST /projects/{P}/users/User-Write` `{"permission":2}` gives `403`. Owner check: B is still at `1`.

**TC-RBAC-13: Write user adds a new share.** B: `PUT /projects/{P}/users` adding D at `0` gives `403`. D: `GET /projects/{P}` gives `403`.

**TC-RBAC-14: Write user reparents a project**
1. B creates their own project B1.
2. B: `POST /projects/{C1}` with `parent_project_id: B1` gives `403`.
3. Owner check: C1's parent is still P. B's `max_permission` on C1 is still `1`.

**TC-RBAC-15: Write user moves a task to a read-only project.** A creates a task in P. B: `POST /tasks/{id}` with `project_id: Q` (B has only Read on Q) gives `403`. Owner check: the task is still in P.

### Unrelated user (D)
**TC-RBAC-09: IDOR.** D: `GET /projects/{P}` and the task list each give `403`. Neither response body contains P's title or the seed task title.

### Link shares
**TC-RBAC-10: Password link share, no password**
1. A: `PUT /projects/{P}/shares` `{"permission":0,"sharing_type":2,"password":…}` gives `201` with a hash.
2. `POST /shares/{hash}/auth` without a password is not `200` and returns no token.
3. *Playwright:* a logged-out browser opens `/share/{hash}/auth`. A password field is shown, and no API response contains P's title or task data.

**TC-RBAC-27: Read link share tries to write.** A creates a read link share without a password (`sharing_type: 1`) and authenticates through it to get a link token. With that token, `PUT /projects/{P}/tasks` gives `403`. Owner check: no task was created.

**TC-RBAC-28: Deleted link share token stops working.** Same setup as TC-27. The token works (`GET /projects/{P}` gives `200`). A: `DELETE /projects/{P}/shares/{id}` gives `200`. The old token now gets `401` or `403`, and no project data comes back.

### Revocation
**TC-RBAC-11: Access revoked during a session** *(destructive, throwaway project)*
1. A creates a throwaway project with a task and shares it with C at Read.
2. *Playwright:* C opens the project in the UI.
3. A: `DELETE /projects/{id}/users/User-Read` gives `200`.
4. *Playwright:* C clicks the task. The next API response is `403`, and no uncaught page errors are logged.
5. C: `GET /projects/{id}` gives `403`.

**TC-RBAC-30: Downgrade from Write to Read** *(throwaway project)*. B creates a task as a baseline (`201`). A: `POST /projects/{id}/users/User-Write` `{"permission":0}` gives `200`. B's next create gives `403`.

### Admin share (E)
**TC-RBAC-12: Shared Admin manages shares.** E adds D at `0` (`201`), changes D to `1` (`200`) and removes D (`200`). After each step, A's share list reflects the change.

**TC-RBAC-23: Shared Admin archives or deletes the project** *(destructive, throwaway project)*. E: `POST /projects/{id}` `{"is_archived":true}` gives `200`. Then `DELETE /projects/{id}` gives `200`. Owner check: `GET` gives `403` or `404`.
**Pinned behaviour:** an Admin share may archive and delete the project. If your first run shows otherwise, update the matrix and the expected codes in both suites.

### Inheritance
**TC-RBAC-21: Read on the parent applies to the child.** C: list C1's tasks gives `200`. Creating a task in C1 gives `403`.

**TC-RBAC-22: Admin on the parent, Read set on the child**
1. A gives E a direct Read share on C1.
2. E: `PUT /projects/{C1}/users` adding D gives `403`.
3. Cleanup removes D (if it was added) and E's direct share from C1.
**Pinned behaviour:** the direct, more specific Read share on C1 wins. A `201` here reproduces the known past bug where the higher parent permission won.

### Team shares (F)
**TC-RBAC-24: Team member gets the team's level.** F lists P's tasks (`200`). Creating a task gives `403`.

**TC-RBAC-25: Removed from the team loses access** *(destructive, uses its own team)*. A creates a second team with F in it and shares a throwaway project with that team at Read. F can open the project (`200`). A (the team admin) runs `DELETE /teams/{id}/members/User-Team` (`200`). F now gets `403`.

**TC-RBAC-26: Team share and direct share both apply** *(throwaway project)*. The project is shared with the team at Read and with F directly at Write. F creates a task (`201`), and F's `max_permission` is `1`.
**Pinned behaviour:** the highest permission wins.

### API tokens
**TC-RBAC-29: A scoped API token can't exceed its scope**
1. B: `PUT /tokens` with `permissions: {"tasks":["read_all"]}`, expiring in 24 hours. Gives `201`.
2. With that token, `PUT /projects/{P}/tasks` gives `401` or `403`. Owner check: no task was created.
3. Cleanup: B deletes the token.
The valid permission keys are listed by `GET /routes` (requires login).

---

## 5. Recording results
After a run, update the **Status**, **Actual Result** and **Date Run** columns in [test-matric-permissions.md](test-matric-permissions.md). A failed assertion prints the request URL, the status code and the response body, so you can copy the actual result straight from the Playwright report or the Newman output. A failure on a pinned case (22, 23, 26) means one of two things: the app changed, or the pinned decision needs revisiting. Record which it was in **Notes**.

The suites haven't been run against try.vikunja.io yet. UI locators (the project settings menu, the task detail and the share-auth password field) were written from the existing specs and Vikunja's accessible names, so check them on the first run.
