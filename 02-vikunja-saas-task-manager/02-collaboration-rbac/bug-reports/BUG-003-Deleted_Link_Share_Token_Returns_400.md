# [BUG-003] Token from a deleted link share is rejected with 400 instead of 401/403

## Environment Details
- **Application:** Vikunja v2.7.1 (`vikunja/vikunja:2.7.1` Docker image)
- **Environment:** Local Docker instance (`http://localhost:3456`, see [docker-compose.yml](../../docker-compose.yml))
- **Test Account:** `User-Owner`
- **Found by:** TC-RBAC-28 ([rbac-tests-1.spec.ts](../../tests/rbac-tests-1.spec.ts), [rbac-tests-1.json](../../../api-artifacts/rbac-tests-1.json))
- **Date/Time:** 2026-11-02

## Severity & Priority
- **Severity:** Minor
- **Reason:** Access is correctly denied and no data leaks, but the status code says the request was malformed rather than unauthorized. Clients that refresh or discard tokens on `401` won't treat this as an expired session.
- **Priority:** Low

## Prerequisites / Pre-conditions
1. `User-Owner` owns project P.

## Steps to Reproduce
1. As `User-Owner`: `PUT /api/v1/projects/{P}/shares` with `{"permission":0,"sharing_type":1}` → `201`, note `hash` and `id`.
2. `POST /api/v1/shares/{hash}/auth` with `{}` → `200`, note `token`.
3. With that token: `GET /api/v1/projects/{P}` → `200`.
4. As `User-Owner`: `DELETE /api/v1/projects/{P}/shares/{id}` → `200`.
5. With the old token: `GET /api/v1/projects/{P}`.

## Expected Result
`401 Unauthorized` (or `403 Forbidden`), with no project data.

## Actual Result
`400 Bad Request` with `{"code":13003,"message":"The provided link share token is invalid."}`. No project data is returned.

## Reproducibility
Every run (Playwright on Chromium, Firefox and WebKit; Newman).

## Test status
TC-RBAC-28 still asserts that no data leaks, and pins the `400` as a known defect so CI stays green. When the bug is fixed the test fails with "BUG-003 looks fixed": change it to expect `401`/`403` and close this report.
