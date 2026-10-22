# Test Case Matrix: Role-Based Access Control (RBAC) & Project Collaboration

**Target Application:** Vikunja (SAAS Task Management)
**Component:** Collaboration, RBAC, Project Sharing
**Designed By:** Alexander Papachristu  
**Execution Type:** Automated Playwright, Postman, Chrome DevTools
**Techniques:** Boundary Value Analysis (BVA), Equivalence Partitioning (EP), Role-Based Access Control (RBAC) Isolation, Negative Testing, Insecure Direct Object Reference (IDOR) Probing  
**Testing Levels:** Functional UI, REST API Integration, Authorization / Security
**Browsers / OS:** Chromium / Firefox / WebKit / Windows 11

---

### Accounts & Test Setup

To validate authorization boundaries, the execution environment requires four isolated test accounts:
| Account | Account Name | Role | Setup|
|---|---|---|---|
| **Account A** | `User-Owner` | Owner | Creates the test project| 
| **Account B** | `User-Write` | Read and Write | Direct user share |
| **Account C** | `User-Read` | Read (0) | Direct user share |
| **Account D** | `User-Unrelated` | None | No shares |
| **Account E** | `User-ShareAdmin` | Admin (2) | Direct user share (not the owner of the project) |
| **Account F** | `User-Team` | Via team | Member of a team shared at Read (0) |

---

### Permission Values

* **Read** = 0
* **Read & Write** = 1
* **Admin** = 2
---

<!-- When tests are flagged as destructive, setup for the project is required to run again to ensure all tests are run accurately -->
### Test Scenarios Matrix
| Test Case ID | Category | Test Scenario | RBAC Role / Actor | Request / Steps | Expected Result | Destructive | Status | Actual Result | Notes | Date Run |
|:---:|:---:|---|:---:|---|---|:---:|:---:|---|---|---|
| **TC-RBAC-01** | Core Sharing | Share project at Read | A: `User-Owner` | PUT /projects/{P}/users with body {"username":"User-Read","permission":0}. Invite `User-Read` to the project with role set to read only | `201 Created` appears in the share list with read access. C: `User-Read` should see the project in their project list. | No | Untested |
| **TC-RBAC-02** | Read user | Read user views project | C: `User-Read` | Open project in the UI; GET /projects/{P} and GET /projects/{P}/tasks | `200 OK` Tasks, labels, and due dates render. Add-task input and task edit controls are hidden / disabled. | No | Untested | 
| **TC-RBAC-03** | Read user | Read user tries to create a task in the UI | C: `User-Read` | Look for the quick-add input including keyboard shortcuts | No way to submit a task. User A does a GET request to confirm task count is unchanged. | No | Untested |
| **TC-RBAC-04** | Read user | Read user creates a task via API | C: `User-Read` | PUT /projects/{P}/tasks with body {"title":"rbac-probe"} | `403 Forbidden` Then A submits a request GET /projects/{P}/tasks: no "rbac-probe" task is listed. | No | Untested |
| **TC-RBAC-05** | Read User | Read user deletes a task via API | C: `User-Read` | DELETE /tasks/{task_id} | `403 Forbidden` Then A submits a request GET /tasks/{task_id}: `200 OK` Task still exists | No | Untested |
| **TC-RBAC-06** | Write User | Write user creates and edits a task | B: `User-Write` | PUT /projects/{P}/tasks with title "Draft QA Architecture"; POST /tasks/{new_id} setting a due date; PUT /tasks/{new_id}/labels to add a label | `201 Created` for the create. `200 OK` for the edits. `User-Owner` sees the task, due date and label. | No | Untested |
| **TC-RBAC-07** | Write User | Write user deletes the project | B: `User-Write` | Check the project menu in the UI; DELETE /projects/{P} | No delete option in the UI. AOPI returns `403 Forbidden` Then `User-Owner` does GET /projects/{P} : `200 OK`, project exists. | Yes | Untested | 
| **TC-RBAC-08** | Write User | Write user promotes self to Admin | B: `User-Write` | POST /projects/{P}/users/{B's user id} with body {"permission":2} | 403. Then `User-Owner` does GET /projects/{P}/users: `User-Write` still at 1. | No | Untested |
| **TC-RBAC-09** | Unrelated User | Unrelated user reads project (IDOR) | D: `User-Unrelated` | GET /projects/{P} and GET /projects/{P}/tasks | `403 Forbidden` The error body doesn't contain the project title or any task data. | No | Untested |
| **TC-RBAC-10** | Link Shares | Password link share, no password given | A: `User-Owner` | `User-Owner` creates a read link share with a password via PUT /projects/{P}/shares. Open the link; also call POST /shares/{hash}/auth without a password | UI shows a password prompt. The auth call is rejected and returns no tokem. No project or task data in any network response before the password is entered. | No | Untested | 
| **TC-RBAC-11** | Revocation | Access revoked during session | C: `User-Read` , A: `User-Owner` | `User-Read` has P open. `User-Owner` runs DELETE /projects/{P}/users/{C user id}. `User-Read` clicks a task. | `User-Read`'s next API call returns `403 Forbidden`. UI shows an error or redirects with no uncaught errors in the console. | Yes | Untested |
| **TC-RBAC-12** | Admin Share | Shared Admin manages shares (replaces ownership transfer) | E: `User-ShareAdmin` | PUT /projects/{P}/users adding `User-Unrelated` at 0; POST changing `User-Unrelated` to 1; DELETE removing `User-Unrelated` | `201 / 200 / 200`. Each change shows in `User-Owner`'s share list. | No | Untested |
| **TC-RBAC-13** | Write User | Write user adds a new share | B: `User-Write` | PUT /projects/{P}/users adding `User-Unrelated` at 0	`403 Forbidden`. `User-Unrelated` has no access to P. | No | Untested |
| **TC-RBAC-14** | Write User | Write user moves a project under their own (reparenting) | B: `User-Write` | `User-Write` creates project B1. POST /projects/{C1} with body {"parent_project_id": B1} | `403 Forbidden`. C1 is still under P. `User-Write`'s permission on C1 is still Write. | No | Untested | 
| **TC-RBAC-15** | Write User | Write user moves a task to a project they can only read | B: `User-Write` | Share project Q with `User-Write` at Read. POST /tasks/{task in P} with body {"project_id": Q} | `403 Forbidden`. The task stays in P. | No | Untested |
| **TC-RBAC-16** | Read User | Read user updates a task | C: `User-Read` | POST /tasks/{id} changing the title | `403 Forbidden`. Title unchanged. | No | Untested |
| **TC-RBAC-17** | Read User | Read user marks a task as done |C: `User-Read` |	POST /tasks/{id} with body {"done":true} | `403 Forbidden`. Task still open. | No |	Untested |
| **TC-RBAC-18** | Read User | Read user adds a comment | C: `User-Read` | PUT /tasks/{id}/comments	| `403 Forbidden. No new comment. |	No	| Untested |
| **TC-RBAC-19** | Read User | Read user adds an assignee, label or attachment | C: `User-Read`	| PUT /tasks/{id}/assignees; PUT /tasks/{id}/labels; PUT /tasks/{id}/attachments | `403 Forbidden` for each. Nothing added. | No | Untested |
| **TC-RBAC-20** | Read User | Read user moves a task on the Kanban board | C: `User-Read` | POST /projects/{P}/views/{view}/buckets/{bucket}/tasks | `403 Forbidden`. Task stays in its bucket. | No | Untested |
| **TC-RBAC-21** | Inheritance | Read on parent applies to child | C: `User-Read` |	GET /projects/{C1}/tasks; PUT /projects/{C1}/tasks | `200 OK` for the read, `403 Forbidden` for the create. | No | Untested |
| **TC-RBAC-22** | Inheritance | Admin on parent, Read set on child | E: `User-ShareAdmin` | `User-Owner` adds a direct Read share on C1 for `User-ShareAdmin`. `User-ShareAdmin` runs PUT /projects/{C1}/users adding `User-Unrelated` | Decide the intended behaviour first and write it here. Known past bug: this succeeded because the higher parent permission won.	| No | Untested |
| **TC-RBAC-23** | Admin Share | Shared Admin deletes or archives the project |E: `User-ShareAdmin`	| DELETE /projects/{P}, or POST /projects/{P} with body {"is_archived":true} | Confirm what your version allows, then pin it. Run last, or on a throwaway copy of P. | Yes | Untested |
| **TC-RBAC-24** | Team Shares | Team member gets the team's level | F: `User-Team` | GET /projects/{P}/tasks; PUT /projects/{P}/tasks | `200 OK` for the read, `403 Forbidden` for the create. | No | Untested |
| **TC-RBAC-25** | Team Shares | Removed from team loses access | F: `User-Team` | Team admin removes `User-Team` from the team. `User-Team` runs GET /projects/{P}	| `403 Forbidden`. |	Yes	| Untested |
| **TC-RBAC-26** | Team Shares | Team share and direct share both apply | F: `User-Team` | `User-Owner` also gives `User-Team` a direct Write share	| `User-Team` can create tasks. Record which permission wins and confirm it's the intended one.	| No | Untested |
| **TC-RBAC-27** | Link Shares | Read link share tries to write | Link token | Authenticate through the share, then PUT /projects/{P}/tasks using that token | `403 Forbidden`. No task created. | No |	Untested |
| **TC-RBAC-28** | Link Shares | Deleted link share token stops working | Link token |	`User-Owner` runs DELETE /projects/{P}/shares/{share_id}. Reuse the old token |	`401 Unauthorized` or `403 Forbidden` . No data returned. |	No | Untested |
| **TC-RBAC-29** | API Tokens | Scoped API token can't exceed it's scope | B: `User-Write` | `User-Write` creates an API token with only task read scope, then calls PUT /projects/{P}/tasks with it | `401 Unauthorized` or `403 Forbidden` . No task created. `User-Write`'s own Write access doesn't apply. | No | Untested |
| **TC-RBAC-30** | Revocation | Downgrade from Write to Read takes effect immediately | B: `User-Write`, A: `User-Owner` | `User-Owner` runs POST /projects/{P}/users/{B's user id} with body {"permission":0}. `User-Write` tries to create a task	| `403 Forbidden` on `User-Write`'s next request. | No | Untested |

