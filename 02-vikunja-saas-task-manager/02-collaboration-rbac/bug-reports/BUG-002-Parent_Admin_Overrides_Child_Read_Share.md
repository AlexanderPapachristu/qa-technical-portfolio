# [BUG-002] Admin share on a parent project overrides a direct Read share on its child project

## Environment Details
- **Application:** Vikunja v2.7.1 (`vikunja/vikunja:2.7.1` Docker image)
- **Environment:** Local Docker instance (`http://localhost:3456`, see [docker-compose.yml](../../docker-compose.yml))
- **Test Accounts:** `User-Owner`, `User-ShareAdmin`, `User-Unrelated`
- **Found by:** TC-RBAC-22 ([rbac-tests-1.spec.ts](../../tests/rbac-tests-1.spec.ts), [rbac-tests-1.json](../../../api-artifacts/rbac-tests-1.json))
- **Date/Time:** 2026-11-02

## Severity & Priority
- **Severity:** Major
- **Reason:** An owner can't limit a user on a child project by giving them a lower direct share there. The user keeps Admin rights on the child (here: sharing it with other people) because of their share on the parent.
- **Priority:** Medium

## Prerequisites / Pre-conditions
1. `User-Owner` owns project P with child project C1.
2. P is shared with `User-ShareAdmin` at Admin (2).

## Steps to Reproduce
1. As `User-Owner`: `PUT /api/v1/projects/{C1}/users` with `{"username":"User-ShareAdmin","permission":0}` → `201`.
2. As `User-ShareAdmin`: `PUT /api/v1/projects/{C1}/users` with `{"username":"User-Unrelated","permission":0}`.

## Expected Result
`403 Forbidden`. The direct, more specific Read share on C1 should decide what `User-ShareAdmin` can do on C1.

## Actual Result
`201 Created`. `User-Unrelated` is added to C1, because the higher Admin permission inherited from P wins.

## Reproducibility
Every run (Playwright on Chromium, Firefox and WebKit; Newman).

## Test Data / Edge Case Notes
The test matrix lists this as a known past bug. It still reproduces in v2.7.1. Vikunja's documented model is that a user gets the highest permission from any source, so this may be by design. Either the behaviour or the docs should make the precedence of direct child shares clear.

## Technical Diagnostics
`GET /api/v1/projects/{C1}` as `User-ShareAdmin` returns header `x-max-permission: 2` even with the direct Read share in place.

## Test status
TC-RBAC-22 pins the current `201` as a known defect, so CI stays green. When the bug is fixed the test fails with "BUG-002 looks fixed": change it to expect `403` and close this report.
