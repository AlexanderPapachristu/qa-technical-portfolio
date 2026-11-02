# Vikunja Project Management System Test

## Environment Details
- **Application:** Vikunja v2.7.1
- **Environment:** Local Docker instance (`http://localhost:3456`). The suites can also target https://try.vikunja.io/
- **Browsers:** Chromium, Firefox, WebKit (Playwright)
- **API:** Postman collections run with Newman

These tests will follow the open-source kanban-like project management system.

## What's here
| Area | Test design | Automation |
|---|---|---|
| Task lifecycle | [Test matrix](01-task-lifecycle/test-matrix-tasks.md) | [tc-task-script.spec.ts](tests/tc-task-script.spec.ts) |
| RBAC & collaboration | [Test matrix](02-collaboration-rbac/test-matric-permissions.md), [steps guide](02-collaboration-rbac/rbac-tests-1.md) | [rbac-tests-1.spec.ts](tests/rbac-tests-1.spec.ts), [rbac-tests-1.json](../api-artifacts/rbac-tests-1.json) (Postman) |

### Bugs found
| ID | Summary | Severity |
|---|---|---|
| [BUG-001](01-task-lifecycle/bug-reports/BUG-001-Link_Enter_Deletes_Text.md) | Selected text is deleted when confirming a link with Enter (WebKit) | Major |
| [BUG-002](02-collaboration-rbac/bug-reports/BUG-002-Parent_Admin_Overrides_Child_Read_Share.md) | Admin share on a parent project overrides a direct Read share on its child | Major |
| [BUG-003](02-collaboration-rbac/bug-reports/BUG-003-Deleted_Link_Share_Token_Returns_400.md) | Deleted link-share token is rejected with 400 instead of 401/403 | Minor |

Known defects are pinned in the tests, so CI stays green while they exist and fails as soon as one is fixed.

## Run it yourself
Requires Node.js 18+ and Docker Desktop.

1. Install dependencies and browsers:
   ```bash
   npm ci
   npx playwright install
   ```
2. Copy `.env.example` to `.env` and choose a password (8+ characters) for each account. They only exist on your local instance.
3. Start Vikunja and create the test accounts. Data persists between restarts.
   ```bash
   npm run vikunja:up
   ```
4. Run the tests:
   ```bash
   npx playwright test
   npm run test:api
   ```
   Open the Playwright report with `npx playwright show-report`.

| Command | What it does |
|---|---|
| `npm run vikunja:up` | Start Vikunja + Postgres in Docker and create any missing accounts |
| `npm run vikunja:down` | Stop the containers, keeping all data |
| `npm run vikunja:clean` | Delete the projects, tasks, teams and labels left by test runs. This runs automatically after `npx playwright test` and `npm run test:api`; set `KEEP_TEST_DATA=1` to skip it. |
| `npm run vikunja:reset` | Delete the containers and all data |
| `npm run test:ui` | RBAC Playwright specs only |
| `npm run test:tasks` | Task-lifecycle Playwright specs only |
| `npm run test:api` | Every Postman collection in `api-artifacts/` via Newman |

## Continuous integration
On every push, [GitHub Actions](../.github/workflows/qa-ci.yml) starts the same Docker stack, creates the accounts with freshly generated passwords, and runs every Playwright spec on all three browsers plus every Postman collection. The Playwright and Newman reports are attached to each run as artifacts.
