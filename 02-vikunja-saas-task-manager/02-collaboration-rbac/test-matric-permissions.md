# Test Case Matrix: Role-Based Access Control (RBAC) & Project Collaboration

**Target Application:** Vikunja (SAAS Task Management)
**Component:** Collaboration, RBAC, Project Sharing
**Designed By:** Alexander Papachristu  
**Execution Type:** Automated Playwright, Postman, Chrome DevTools
**Techniques:** Boundary Value Analysis (BVA), Equivalence Partitioning (EP), Role-Based Access Control (RBAC) Isolation, Negative Testing, Insecure Direct Object Reference (IDOR) Probing  
**Testing Levels:** Functional UI, REST API Integration, Authorization / Security
**Browsers / OS:** Chromium / Firefox / WebKit / Windows 11

---

### Execution Summary

| | |
|---|---|
| **Date run** | 2026-11-02 |
| **Application version** | Vikunja v2.7.1 (`vikunja/vikunja:2.7.1` Docker image, Postgres 17) |
| **Environment** | Local Docker instance, `http://localhost:3456` ([docker-compose.yml](../docker-compose.yml)) |
| **Automation** | Playwright [rbac-tests-1.spec.ts](../tests/rbac-tests-1.spec.ts) on Chromium, Firefox and WebKit; Postman [rbac-tests-1.json](../../api-artifacts/rbac-tests-1.json) via Newman |
| **How to run** | [rbac-tests-1.md](rbac-tests-1.md) |
| **Result** | 28 / 30 **Pass**, 2 / 30 **Fail: known defect** ([BUG-002](bug-reports/BUG-002-Parent_Admin_Overrides_Child_Read_Share.md), [BUG-003](bug-reports/BUG-003-Deleted_Link_Share_Token_Returns_400.md)) |
| **Playwright** | 90 / 90 green (30 cases × 3 browsers), first attempt, no retries or flaky tests. Known defects are pinned, so they report green. |
| **Newman** | 123 requests, 161 / 161 assertions green (known defects pinned) |

Status values: **Pass** = behaves as expected. **Fail: known defect** = deviates from the expected result. A bug report is filed, and the test pins today's behaviour so CI stays green until it's fixed.

---

### Accounts & Test Setup

To validate authorization boundaries, the execution environment requires six isolated test accounts. [scripts/seed-accounts.js](../scripts/seed-accounts.js) creates them on the local instance (`npm run vikunja:up`):
| Account | Account Name | Role | Setup|
|---|---|---|---|
| **Account A** | `User-Owner` | Owner | Creates the test project| 
| **Account B** | `User-Write` | Read and Write | Direct user share |
| **Account C** | `User-Read` | Read (0) | Direct user share |
| **Account D** | `User-Unrelated` | None | No shares |
| **Account E** | `User-ShareAdmin` | Admin (2) | Direct user share (not the owner of the project) |
| **Account F** | `User-Team` | Via team | Member of a team shared at Read (0) |

Each run builds a fresh project P (with child C1, project Q and a team) and runs destructive cases on their own throwaway project, so the cases don't depend on each other. Everything a run creates is deleted when it finishes ([scripts/cleanup-test-data.js](../scripts/cleanup-test-data.js)).

---

### Permission Values

* **Read** = 0
* **Read & Write** = 1
* **Admin** = 2

---

### API Notes (Vikunja v2.7.1)
Found while automating. The Request / Steps column keeps the original design, and the tests use the endpoints below.
* `GET /projects/{P}/tasks` doesn't exist in v2. Tasks are listed with `GET /projects/{P}/views/{view}/tasks`, using the project's list view.
* The `{user id}` segment in `/projects/{P}/users/{…}` is the **username**, not a numeric ID.
* `POST /tasks/{id}` replaces the whole task. The tests send the full task with one field changed, so the only possible failure is the permission check.
* The effective permission is returned in the `x-max-permission` response header, not in the JSON body.
* The web UI calls both `/api/v1` and `/api/v2` endpoints.
* Login and register are rate-limited, by default to a few requests per minute. The local instance raises the limit so a run can log in six accounts.

---

<!-- When tests are flagged as destructive, setup for the project is required to run again to ensure all tests are run accurately -->
### Test Scenarios Matrix
| Test Case ID | Category | Test Scenario | RBAC Role / Actor | Request / Steps | Expected Result | Destructive | Status | Actual Result | Notes | Date Run |
|:---:|:---:|---|:---:|---|---|:---:|:---:|---|---|---|
| **TC-RBAC-01** | Core Sharing | Share project at Read | A: `User-Owner` | PUT /projects/{P}/users with body {"username":"User-Read","permission":0}. Invite `User-Read` to the project with role set to read only | `201 Created` appears in the share list with read access. C: `User-Read` should see the project in their project list. | No | **Pass** | `201 Created`, response has `permission: 0`. Share list shows `User-Read` at 0. Project appears in `User-Read`'s list (`GET /projects?s=<title>`). UI share settings show "Read only". | Playwright (API + UI) and Postman. Runs on its own project so it doesn't depend on setup. | 2026-11-02 |
| **TC-RBAC-02** | Read user | Read user views project | C: `User-Read` | Open project in the UI; GET /projects/{P} and GET /projects/{P}/tasks | `200 OK` Tasks, labels, and due dates render. Add-task input and task edit controls are hidden / disabled. | No | **Pass** | `200 OK` for the project and its task list (via list view). `x-max-permission: 0`. In the UI the seed task renders, there's no "Add a task…" input, and the task detail has no "Mark task done" button. | Tasks listed with `/projects/{P}/views/{list}/tasks` (see API notes). | 2026-11-02 |
| **TC-RBAC-03** | Read user | Read user tries to create a task in the UI | C: `User-Read` | Look for the quick-add input including keyboard shortcuts | No way to submit a task. User A does a GET request to confirm task count is unchanged. | No | **Pass** | No quick-add input. The `t` shortcut opens nothing, and a title typed into Ctrl+K quick actions + Enter doesn't add a task to P. Owner's task count is unchanged. | UI part in Playwright only. Postman runs the owner-side check. | 2026-11-02 |
| **TC-RBAC-04** | Read user | Read user creates a task via API | C: `User-Read` | PUT /projects/{P}/tasks with body {"title":"rbac-probe"} | `403 Forbidden` Then A submits a request GET /projects/{P}/tasks: no "rbac-probe" task is listed. | No | **Pass** | `403 Forbidden`. No "rbac-probe" task in the owner's list. | | 2026-11-02 |
| **TC-RBAC-05** | Read User | Read user deletes a task via API | C: `User-Read` | DELETE /tasks/{task_id} | `403 Forbidden` Then A submits a request GET /tasks/{task_id}: `200 OK` Task still exists | No | **Pass** | `403 Forbidden`. Owner's `GET /tasks/{id}` returns `200 OK`. | | 2026-11-02 |
| **TC-RBAC-06** | Write User | Write user creates and edits a task | B: `User-Write` | PUT /projects/{P}/tasks with title "Draft QA Architecture"; POST /tasks/{new_id} setting a due date; PUT /tasks/{new_id}/labels to add a label | `201 Created` for the create. `200 OK` for the edits. `User-Owner` sees the task, due date and label. | No | **Pass** | Create `201`, due date `200`, add label `201` (label created first with `PUT /labels`, also `201`). Owner sees the task, the exact due date and the label. | Adding a label is a create endpoint, so `201` is correct rather than the `200` expected here. | 2026-11-02 |
| **TC-RBAC-07** | Write User | Write user deletes the project | B: `User-Write` | Check the project menu in the UI; DELETE /projects/{P} | No delete option in the UI. API returns `403 Forbidden` Then `User-Owner` does GET /projects/{P} : `200 OK`, project exists. | Yes | **Pass** | Project settings menu shows "Edit" but no "Delete". API `403 Forbidden`. Owner's GET returns `200 OK`. | Runs on a throwaway project. | 2026-11-02 |
| **TC-RBAC-08** | Write User | Write user promotes self to Admin | B: `User-Write` | POST /projects/{P}/users/{B's user id} with body {"permission":2} | 403. Then `User-Owner` does GET /projects/{P}/users: `User-Write` still at 1. | No | **Pass** | `403 Forbidden`. Share list still shows `User-Write` at 1. | Path segment is the username (`/users/User-Write`). | 2026-11-02 |
| **TC-RBAC-09** | Unrelated User | Unrelated user reads project (IDOR) | D: `User-Unrelated` | GET /projects/{P} and GET /projects/{P}/tasks | `403 Forbidden` The error body doesn't contain the project title or any task data. | No | **Pass** | `403 Forbidden` for both. Neither error body contains the project title or task titles. | | 2026-11-02 |
| **TC-RBAC-10** | Link Shares | Password link share, no password given | A: `User-Owner` | `User-Owner` creates a read link share with a password via PUT /projects/{P}/shares. Open the link; also call POST /shares/{hash}/auth without a password | UI shows a password prompt. The auth call is rejected and returns no token. No project or task data in any network response before the password is entered. | No | **Pass** | Share created (`201`, `sharing_type: 2`). Auth without a password returns `412 Precondition Failed` with no token. The UI at `/share/{hash}/auth` shows a password field. No API response (v1 or v2) contains project or task data. | | 2026-11-02 |
| **TC-RBAC-11** | Revocation | Access revoked during session | C: `User-Read` , A: `User-Owner` | `User-Read` has P open. `User-Owner` runs DELETE /projects/{P}/users/{C user id}. `User-Read` clicks a task. | `User-Read`'s next API call returns `403 Forbidden`. UI shows an error or redirects with no uncaught errors in the console. | Yes | **Pass** | Revoke `200 OK`. Clicking the task makes the UI call `GET /api/v2/tasks/{id}`, which returns `403 Forbidden`. No uncaught page errors. A follow-up `GET /projects/{id}` returns `403`. | Runs on a throwaway project. The UI uses `/api/v2`, so the test watches every API version. | 2026-11-02 |
| **TC-RBAC-12** | Admin Share | Shared Admin manages shares (replaces ownership transfer) | E: `User-ShareAdmin` | PUT /projects/{P}/users adding `User-Unrelated` at 0; POST changing `User-Unrelated` to 1; DELETE removing `User-Unrelated` | `201 / 200 / 200`. Each change shows in `User-Owner`'s share list. | No | **Pass** | `201 / 200 / 200`. The owner's share list shows 0, then 1, then no entry. | | 2026-11-02 |
| **TC-RBAC-13** | Write User | Write user adds a new share | B: `User-Write` | PUT /projects/{P}/users adding `User-Unrelated` at 0 | `403 Forbidden`. `User-Unrelated` has no access to P. | No | **Pass** | `403 Forbidden`. `User-Unrelated`'s `GET /projects/{P}` returns `403`. | | 2026-11-02 |
| **TC-RBAC-14** | Write User | Write user moves a project under their own (reparenting) | B: `User-Write` | `User-Write` creates project B1. POST /projects/{C1} with body {"parent_project_id": B1} | `403 Forbidden`. C1 is still under P. `User-Write`'s permission on C1 is still Write. | No | **Pass** | B1 created (`201`). Reparent returns `403 Forbidden`. C1's `parent_project_id` is still P. `User-Write` on C1: `x-max-permission: 1`. | | 2026-11-02 |
| **TC-RBAC-15** | Write User | Write user moves a task to a project they can only read | B: `User-Write` | Share project Q with `User-Write` at Read. POST /tasks/{task in P} with body {"project_id": Q} | `403 Forbidden`. The task stays in P. | No | **Pass** | `403 Forbidden`. The task's `project_id` is still P. | | 2026-11-02 |
| **TC-RBAC-16** | Read User | Read user updates a task | C: `User-Read` | POST /tasks/{id} changing the title | `403 Forbidden`. Title unchanged. | No | **Pass** | `403 Forbidden`. Title unchanged. | Full task body sent (see API notes). | 2026-11-02 |
| **TC-RBAC-17** | Read User | Read user marks a task as done | C: `User-Read` | POST /tasks/{id} with body {"done":true} | `403 Forbidden`. Task still open. | No | **Pass** | `403 Forbidden`. `done` is still `false`. | Full task body sent (see API notes). | 2026-11-02 |
| **TC-RBAC-18** | Read User | Read user adds a comment | C: `User-Read` | PUT /tasks/{id}/comments | `403 Forbidden`. No new comment. | No | **Pass** | `403 Forbidden`. Comment count unchanged. | | 2026-11-02 |
| **TC-RBAC-19** | Read User | Read user adds an assignee, label or attachment | C: `User-Read` | PUT /tasks/{id}/assignees; PUT /tasks/{id}/labels; PUT /tasks/{id}/attachments | `403 Forbidden` for each. Nothing added. | No | **Pass** | `403 Forbidden` for the assignee, label and attachment (multipart upload). Task has no assignees, labels or attachments. | `User-Read` can create a label of their own (`201`). It just can't attach it to P's task. | 2026-11-02 |
| **TC-RBAC-20** | Read User | Read user moves a task on the Kanban board | C: `User-Read` | POST /projects/{P}/views/{view}/buckets/{bucket}/tasks | `403 Forbidden`. Task stays in its bucket. | No | **Pass** | `403 Forbidden`. Task is still in its original bucket. | | 2026-11-02 |
| **TC-RBAC-21** | Inheritance | Read on parent applies to child | C: `User-Read` | GET /projects/{C1}/tasks; PUT /projects/{C1}/tasks | `200 OK` for the read, `403 Forbidden` for the create. | No | **Pass** | `200 OK` for the read (via C1's list view), `403 Forbidden` for the create. | | 2026-11-02 |
| **TC-RBAC-22** | Inheritance | Admin on parent, Read set on child | E: `User-ShareAdmin` | `User-Owner` adds a direct Read share on C1 for `User-ShareAdmin`. `User-ShareAdmin` runs PUT /projects/{C1}/users adding `User-Unrelated` | `403 Forbidden`: the direct Read share on C1 wins over Admin inherited from P. Known past bug: this succeeded because the higher parent permission won. | No | **Fail: known defect** | `201 Created`. `User-Unrelated` is added to C1, because the inherited Admin permission still wins over the direct Read share. | [BUG-002](bug-reports/BUG-002-Parent_Admin_Overrides_Child_Read_Share.md). The past bug still reproduces in v2.7.1. The test pins `201` and fails once it's fixed. | 2026-11-02 |
| **TC-RBAC-23** | Admin Share | Shared Admin deletes or archives the project | E: `User-ShareAdmin` | DELETE /projects/{P}, or POST /projects/{P} with body {"is_archived":true} | Confirmed for v2.7.1: a direct Admin share may archive and delete. `200 OK` for both; `User-Owner` then gets `404` on GET. | Yes | **Pass** | Archive `200 OK` (`is_archived: true`), delete `200 OK`. Owner's GET returns `404 Not Found`. | Behaviour confirmed and pinned. Runs on a throwaway project. | 2026-11-02 |
| **TC-RBAC-24** | Team Shares | Team member gets the team's level | F: `User-Team` | GET /projects/{P}/tasks; PUT /projects/{P}/tasks | `200 OK` for the read, `403 Forbidden` for the create. | No | **Pass** | `200 OK` for the read, `403 Forbidden` for the create. | | 2026-11-02 |
| **TC-RBAC-25** | Team Shares | Removed from team loses access | F: `User-Team` | Team admin removes `User-Team` from the team. `User-Team` runs GET /projects/{P} | `403 Forbidden`. | Yes | **Pass** | Before removal `200 OK`. Removal `200 OK`. Afterwards `403 Forbidden`. | Uses its own team and project. | 2026-11-02 |
| **TC-RBAC-26** | Team Shares | Team share and direct share both apply | F: `User-Team` | `User-Owner` also gives `User-Team` a direct Write share | `User-Team` can create tasks. The highest permission wins. | No | **Pass** | Task create `201 Created`. `x-max-permission: 1`. The direct Write share wins over the team's Read. | Highest-permission-wins is the intended rule here, and it is consistent with TC-RBAC-22's behaviour. | 2026-11-02 |
| **TC-RBAC-27** | Link Shares | Read link share tries to write | Link token | Authenticate through the share, then PUT /projects/{P}/tasks using that token | `403 Forbidden`. No task created. | No | **Pass** | Auth `200 OK` with a token. Create with that token `403 Forbidden`. No task created. | | 2026-11-02 |
| **TC-RBAC-28** | Link Shares | Deleted link share token stops working | Link token | `User-Owner` runs DELETE /projects/{P}/shares/{share_id}. Reuse the old token | `401 Unauthorized` or `403 Forbidden` . No data returned. | No | **Fail: known defect** | Token works before the delete (`200`). Delete `200 OK`. The old token gets `400 Bad Request` (`code 13003`, "The provided link share token is invalid."). No project data returned. | [BUG-003](bug-reports/BUG-003-Deleted_Link_Share_Token_Returns_400.md). Access is denied correctly, but with the wrong status code. The test pins `400`. | 2026-11-02 |
| **TC-RBAC-29** | API Tokens | Scoped API token can't exceed its scope | B: `User-Write` | `User-Write` creates an API token with only task read scope, then calls PUT /projects/{P}/tasks with it | `401 Unauthorized` or `403 Forbidden` . No task created. `User-Write`'s own Write access doesn't apply. | No | **Pass** | Token created (`201`, `permissions: {"tasks":["read_all"]}`). Create with the token `401 Unauthorized`. No task created. | Token deleted after the test. | 2026-11-02 |
| **TC-RBAC-30** | Revocation | Downgrade from Write to Read takes effect immediately | B: `User-Write`, A: `User-Owner` | `User-Owner` runs POST /projects/{P}/users/{B's user id} with body {"permission":0}. `User-Write` tries to create a task | `403 Forbidden` on `User-Write`'s next request. | No | **Pass** | Baseline create `201`. Downgrade `200 OK`. Next create `403 Forbidden`. | Runs on a throwaway project. | 2026-11-02 |
