import { test, expect, request, Page } from '@playwright/test';


const BASE = process.env.VIKUNJA_URL!;
const API = `${BASE}/api/v1`;
const OWNER = { user: process.env.OWNER_USER!, pass: process.env.OWNER_PASS! };
const READ = { user: process.env.READ_USER!, pass: process.env.READ_PASS! };
const PROJECT_TITLE = process.env.PROJECT_TITLE!;

let projectID: number;

test.beforeAll(async () => {
    // Look up project P and confirm the Postman step has already shared it
    const api = await request.newContext();
    const login = await api.post(`${API}/login`, { data: { username: OWNER.user, password: OWNER.pass } });
    expect(login.status(), 'Owner API login').toBe(200);
    const headers = { Authorization: `Bearer ${(await login.json()).token}` };

    // Search by title: the project list is paginated and other specs create many projects
    const projects = await (await api.get(`${API}/projects?s=${encodeURIComponent(PROJECT_TITLE)}`, { headers })).json();
    const p = projects.find((x: any) => x.title === PROJECT_TITLE);
    expect(p, `Project "${PROJECT_TITLE}" not found. Run "npm run vikunja:seed" first.`).toBeTruthy();
    projectID = p.id;

    const shares = await (await api.get(`${API}/projects/${projectID}/users`, { headers })).json();
    expect(
      shares.some((u: any) => u.username === READ.user),
      'User-Read is not shared yet. Run "npm run vikunja:seed" first.'
    ).toBeTruthy();
    await api.dispose();
  });

  async function login(page: Page, user: string, pass: string) {
    await page.goto('/login');
    await page.getByLabel(/username/i).fill(user);
    await page.getByLabel(/^password/i).fill(pass);
    await page.getByRole('button', { name: /log ?in/i }).click();
    await expect(page).not.toHaveURL(/\/login/);
  }

test.describe('Vikunja Tasks', () => {
  // const baseURL = 'https://try.vikunja.io';


  /// TC-TASK-01: Test that a new task can be created and displayed correctly.
  test('TC-RBAC-01: Owner shares project to user with read-only access', async ({ browser }) => {
    const ctx = await browser.newContext(); // wait for new session per user
    const page = await ctx.newPage();
    await login(page, OWNER.user, OWNER.pass);

    await page.goto(`/projects/${projectID}/settings/share`);
    const row = page.getByRole('row').filter({ hasText: READ.user });
    await expect(row).toBeVisible();
    await expect(row.locator('select option:checked')).toHaveText(/read only/i);
    await ctx.close();   
  });

});