import { test, expect, request, APIRequestContext, APIResponse, Browser, Page } from '@playwright/test';

/**
 * RBAC & Project Collaboration suite: TC-RBAC-01 to TC-RBAC-30
 * Source: 02-collaboration-rbac/test-matric-permissions.md
 * Steps and setup: 02-collaboration-rbac/rbac-tests-1.md
 *
 * Every test is independent of the others. beforeAll builds a fresh project P (and its child C1,
 * project Q and a team) on each run, and destructive tests work on their own throwaway project.
 * Credentials come from .env (loaded in playwright.config.ts). Never hardcode them here.
 */

const BASE = process.env.VIKUNJA_URL ?? 'http://localhost:3456';
const API = `${BASE}/api/v1`;
const PROJECT_TITLE = process.env.PROJECT_TITLE ?? 'RBAC Test Project';

const ACCOUNTS = {
  owner:     { user: process.env.OWNER_USER!,      pass: process.env.OWNER_PASS! },      // A
  write:     { user: process.env.WRITE_USER!,      pass: process.env.WRITE_PASS! },      // B
  read:      { user: process.env.READ_USER!,       pass: process.env.READ_PASS! },       // C
  unrelated: { user: process.env.UNRELATED_USER!,  pass: process.env.UNRELATED_PASS! },  // D
  admin:     { user: process.env.SHAREADMIN_USER!, pass: process.env.SHAREADMIN_PASS! }, // E
  team:      { user: process.env.TEAM_USER!,       pass: process.env.TEAM_PASS! },       // F
};
type Role = keyof typeof ACCOUNTS;

/// Permission values from the matrix
const READ = 0, WRITE = 1, ADMIN = 2;

let api: APIRequestContext;
const tokens = {} as Record<Role, string>;
const stamp = Date.now();

/// Data created by beforeAll for this run
const S = {
  p: 0,            // project P (owned by User-Owner)
  pTitle: '',
  c1: 0,           // child project C1 under P
  q: 0,            // project Q, shared with User-Write at Read
  team: 0,         // team containing User-Team, shared on P at Read
  task: 0,         // seed task in P
  taskTitle: '',
  childTask: 0,    // seed task in C1
  listView: 0,     // P's list view (used to list tasks)
  kanbanView: 0,   // P's kanban view
};

// ---------- API helpers ----------

const client = (token: string) => {
  const headers = { Authorization: `Bearer ${token}` };
  return {
    get:  (path: string) => api.get(API + path, { headers }),
    put:  (path: string, data?: object) => api.put(API + path, { headers, data }),
    post: (path: string, data?: object) => api.post(API + path, { headers, data }),
    del:  (path: string) => api.delete(API + path, { headers }),
  };
};
const as = (role: Role) => client(tokens[role]);

/// Assert a status code and show the response body when it fails
async function expectStatus(res: APIResponse, ...codes: number[]) {
  expect(codes, `${res.url()} -> ${res.status()}: ${await res.text()}`).toContain(res.status());
  return res.status() === 204 ? null : res.json();
}

async function login(role: Role) {
  const { user, pass } = ACCOUNTS[role];
  expect(user && pass, `Missing credentials for ${role} in .env (see .env.example)`).toBeTruthy();
  const res = await api.post(`${API}/login`, { data: { username: user, password: pass } });
  tokens[role] = (await expectStatus(res, 200)).token;
}

async function createProject(title: string, parentId?: number) {
  const body = parentId ? { title, parent_project_id: parentId } : { title };
  return (await expectStatus(await as('owner').put('/projects', body), 201)) as { id: number; title: string };
}

async function createTask(role: Role, projectId: number, title: string) {
  return (await expectStatus(await as(role).put(`/projects/${projectId}/tasks`, { title }), 201)) as { id: number };
}

async function share(projectId: number, role: Role, permission: number) {
  await expectStatus(
    await as('owner').put(`/projects/${projectId}/users`, { username: ACCOUNTS[role].user, permission }), 201);
}

/// Throwaway project for destructive tests, shared with the given users
async function throwawayProject(tc: string, shares: [Role, number][] = []) {
  const p = await createProject(`${PROJECT_TITLE} ${tc} ${stamp}`);
  for (const [role, perm] of shares) await share(p.id, role, perm);
  return p;
}

async function viewId(projectId: number, kind: 'list' | 'kanban') {
  const views = await expectStatus(await as('owner').get(`/projects/${projectId}/views`), 200);
  return views.find((v: any) => v.view_kind === kind).id as number;
}

/// Task titles in P as User-Owner sees them (GET /projects/{P}/tasks is a view endpoint in Vikunja v2)
async function ownerTaskTitles(projectId = S.p, listView = S.listView): Promise<string[]> {
  const tasks = await expectStatus(await as('owner').get(`/projects/${projectId}/views/${listView}/tasks?per_page=50`), 200);
  return tasks.map((t: any) => t.title);
}

async function ownerTask(id: number) {
  return expectStatus(await as('owner').get(`/tasks/${id}`), 200);
}

/// Effective permission of a user on a project (Vikunja sends it as a response header)
async function maxPermission(role: Role, projectId: number) {
  const res = await as(role).get(`/projects/${projectId}`);
  await expectStatus(res, 200);
  return Number(res.headers()['x-max-permission']);
}

async function shareList(projectId: number) {
  return (await expectStatus(await as('owner').get(`/projects/${projectId}/users`), 200)) as { username: string; permission: number }[];
}

// ---------- UI helpers ----------

/// The web UI calls both /api/v1 and /api/v2, so match any API version
const isApiCall = (url: string) => url.startsWith(`${BASE}/api/`);

/// Logs a user into the UI in their own browser context, so sessions never mix
async function uiLogin(browser: Browser, role: Role): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Username Or Email Address' }).fill(ACCOUNTS[role].user);
  await page.getByRole('textbox', { name: 'Password' }).fill(ACCOUNTS[role].pass);
  await page.getByRole('textbox', { name: 'Password' }).press('Enter');
  await expect(page).not.toHaveURL(/\/login/);
  return page;
}

// ---------- Setup ----------

test.beforeAll(async () => {
  api = await request.newContext();
  for (const role of Object.keys(ACCOUNTS) as Role[]) await login(role);

  // Project P with a seed task, child project C1 and project Q
  S.pTitle = `${PROJECT_TITLE} ${stamp}`;
  S.p = (await createProject(S.pTitle)).id;
  S.taskTitle = `rbac-seed-${stamp}`;
  S.task = (await createTask('owner', S.p, S.taskTitle)).id;
  S.c1 = (await createProject(`C1 ${stamp}`, S.p)).id;
  S.childTask = (await createTask('owner', S.c1, `rbac-child-seed-${stamp}`)).id;
  S.q = (await createProject(`Q ${stamp}`)).id;
  S.listView = await viewId(S.p, 'list');
  S.kanbanView = await viewId(S.p, 'kanban');

  // Direct shares from the Accounts table
  await share(S.p, 'write', WRITE);
  await share(S.p, 'read', READ);
  await share(S.p, 'admin', ADMIN);
  await share(S.q, 'write', READ);

  // Team share: User-Owner creates a team, adds User-Team, shares P with the team at Read
  S.team = (await expectStatus(await as('owner').put('/teams', { name: `rbac-team-${stamp}` }), 201)).id;
  await expectStatus(await as('owner').put(`/teams/${S.team}/members`, { username: ACCOUNTS.team.user }), 201);
  await expectStatus(await as('owner').put(`/projects/${S.p}/teams`, { team_id: S.team, permission: READ }), 201);
});

test.afterAll(async () => {
  await api?.dispose();
});

// ---------- Tests ----------

test.describe('RBAC & Project Collaboration', () => {

  /// TC-RBAC-01: Owner shares a project with User-Read at Read (0)
  test('TC-RBAC-01: share project at Read', async ({ browser }) => {
    const p = await throwawayProject('TC-01');

    const created = await expectStatus(
      await as('owner').put(`/projects/${p.id}/users`, { username: ACCOUNTS.read.user, permission: READ }), 201);
    expect(created.permission).toBe(READ);

    // Appears in the share list with read access
    expect((await shareList(p.id)).find(u => u.username === ACCOUNTS.read.user)?.permission).toBe(READ);

    // User-Read sees the project in their project list
    const projects = await expectStatus(await as('read').get(`/projects?s=${encodeURIComponent(p.title)}`), 200);
    expect(projects.map((x: any) => x.id)).toContain(p.id);

    // UI: the share list shows User-Read as read only
    const page = await uiLogin(browser, 'owner');
    await page.goto(`/projects/${p.id}/settings/share`);
    const row = page.getByRole('row').filter({ hasText: ACCOUNTS.read.user });
    await expect(row).toBeVisible();
    await expect(row.locator('select option:checked')).toHaveText(/read only/i);
    await page.context().close();
  });

  /// TC-RBAC-02: Read user can view P but has no add/edit controls
  test('TC-RBAC-02: read user views project', async ({ browser }) => {
    await expectStatus(await as('read').get(`/projects/${S.p}`), 200);
    const tasks = await expectStatus(await as('read').get(`/projects/${S.p}/views/${S.listView}/tasks`), 200);
    expect(tasks.map((t: any) => t.title)).toContain(S.taskTitle);

    const page = await uiLogin(browser, 'read');
    await page.goto(`/projects/${S.p}/${S.listView}`);
    await expect(page.getByText(S.taskTitle)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Add a task…' })).toHaveCount(0);

    // Task detail opens read-only: no editable title and no done button
    await page.getByText(S.taskTitle).click();
    await expect(page.getByRole('heading', { name: S.taskTitle })).toBeVisible();
    await expect(page.getByRole('button', { name: /mark task done/i })).toHaveCount(0);
    await page.context().close();
  });

  /// TC-RBAC-03: Read user has no way to create a task from the UI
  test('TC-RBAC-03: read user tries to create a task in the UI', async ({ browser }) => {
    const before = await ownerTaskTitles();

    const page = await uiLogin(browser, 'read');
    await page.goto(`/projects/${S.p}/${S.listView}`);
    await expect(page.getByText(S.taskTitle)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Add a task…' })).toHaveCount(0);

    // Keyboard shortcuts: "t" is the add-task shortcut, Ctrl+K opens quick actions
    await page.keyboard.press('t');
    await expect(page.getByRole('textbox', { name: 'Add a task…' })).toHaveCount(0);
    await page.keyboard.press('Control+k');
    await page.keyboard.type(`rbac-ui-probe-${stamp}`);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await page.context().close();

    // Owner confirms nothing was added to P
    const after = await ownerTaskTitles();
    expect(after).toHaveLength(before.length);
    expect(after).not.toContain(`rbac-ui-probe-${stamp}`);
  });

  /// TC-RBAC-04: Read user creates a task via API
  test('TC-RBAC-04: read user creates a task via API', async () => {
    await expectStatus(await as('read').put(`/projects/${S.p}/tasks`, { title: 'rbac-probe' }), 403);
    expect(await ownerTaskTitles()).not.toContain('rbac-probe');
  });

  /// TC-RBAC-05: Read user deletes a task via API
  test('TC-RBAC-05: read user deletes a task via API', async () => {
    await expectStatus(await as('read').del(`/tasks/${S.task}`), 403);
    await ownerTask(S.task);
  });

  /// TC-RBAC-06: Write user creates a task, sets a due date and adds a label
  test('TC-RBAC-06: write user creates and edits a task', async () => {
    const title = `Draft QA Architecture ${stamp}`;
    const task = await expectStatus(await as('write').put(`/projects/${S.p}/tasks`, { title }), 201);

    const due = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    due.setUTCHours(12, 0, 0, 0);
    await expectStatus(await as('write').post(`/tasks/${task.id}`, { ...task, due_date: due.toISOString() }), 200);

    // Label endpoint is a create, so Vikunja answers 201 (the matrix lists 200)
    const label = await expectStatus(await as('write').put('/labels', { title: `rbac-label-${stamp}` }), 201);
    await expectStatus(await as('write').put(`/tasks/${task.id}/labels`, { label_id: label.id }), 201);

    // User-Owner sees the task, due date and label
    const seen = await ownerTask(task.id);
    expect(seen.title).toBe(title);
    expect(new Date(seen.due_date).getTime()).toBe(due.getTime());
    expect((seen.labels ?? []).map((l: any) => l.id)).toContain(label.id);
  });

  /// TC-RBAC-07: Write user can't delete the project (destructive: runs on a throwaway project)
  test('TC-RBAC-07: write user deletes the project', async ({ browser }) => {
    const p = await throwawayProject('TC-07', [['write', WRITE]]);
    const listView = await viewId(p.id, 'list');

    const page = await uiLogin(browser, 'write');
    await page.goto(`/projects/${p.id}/${listView}`);
    await page.getByRole('banner', { name: 'main navigation' }).getByRole('button', { name: 'Open project settings menu' }).click();
    await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Delete' })).toHaveCount(0);
    await page.context().close();

    await expectStatus(await as('write').del(`/projects/${p.id}`), 403);
    await expectStatus(await as('owner').get(`/projects/${p.id}`), 200);
  });

  /// TC-RBAC-08: Write user can't promote themselves to Admin
  test('TC-RBAC-08: write user promotes self to Admin', async () => {
    // Vikunja's {userID} path segment is the username
    await expectStatus(await as('write').post(`/projects/${S.p}/users/${ACCOUNTS.write.user}`, { permission: ADMIN }), 403);
    expect((await shareList(S.p)).find(u => u.username === ACCOUNTS.write.user)?.permission).toBe(WRITE);
  });

  /// TC-RBAC-09: Unrelated user can't read P (IDOR)
  test('TC-RBAC-09: unrelated user reads project (IDOR)', async () => {
    for (const path of [`/projects/${S.p}`, `/projects/${S.p}/views/${S.listView}/tasks`]) {
      const res = await as('unrelated').get(path);
      expect(res.status(), path).toBe(403);
      const body = await res.text();
      expect(body).not.toContain(S.pTitle);
      expect(body).not.toContain(S.taskTitle);
    }
  });

  /// TC-RBAC-10: Password link share opened without a password
  test('TC-RBAC-10: password link share, no password given', async ({ browser }) => {
    const linkShare = await expectStatus(await as('owner').put(`/projects/${S.p}/shares`,
      { permission: READ, sharing_type: 2, password: `rbac-${stamp}` }), 201);

    // Auth without a password is rejected and returns no token
    const auth = await api.post(`${API}/shares/${linkShare.hash}/auth`, { data: {} });
    expect(auth.status()).not.toBe(200);
    expect(await auth.text()).not.toMatch(/"token"/);

    // UI shows a password prompt and no response leaks project or task data
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const bodies: string[] = [];
    page.on('response', async r => {
      if (isApiCall(r.url())) bodies.push(await r.text().catch(() => ''));
    });
    await page.goto(`/share/${linkShare.hash}/auth`);
    await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible();
    for (const body of bodies) {
      expect(body).not.toContain(S.pTitle);
      expect(body).not.toContain(S.taskTitle);
    }
    await ctx.close();
  });

  /// TC-RBAC-11: Access revoked during an open session (destructive: throwaway project)
  test('TC-RBAC-11: access revoked during session', async ({ browser }) => {
    const p = await throwawayProject('TC-11', [['read', READ]]);
    const title = `rbac-revoke-${stamp}`;
    await createTask('owner', p.id, title);
    const listView = await viewId(p.id, 'list');

    const page = await uiLogin(browser, 'read');
    const pageErrors: string[] = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(`/projects/${p.id}/${listView}`);
    await expect(page.getByText(title)).toBeVisible();

    // User-Owner revokes the share while User-Read has P open
    await expectStatus(await as('owner').del(`/projects/${p.id}/users/${ACCOUNTS.read.user}`), 200);

    // User-Read's next API call is forbidden
    const forbidden = page.waitForResponse(r => isApiCall(r.url()) && r.status() === 403);
    await page.getByText(title).click();
    await forbidden;
    expect(pageErrors, 'uncaught errors in the console').toEqual([]);
    await page.context().close();

    await expectStatus(await as('read').get(`/projects/${p.id}`), 403);
  });

  /// TC-RBAC-12: Shared Admin adds, changes and removes a user share
  test('TC-RBAC-12: shared admin manages shares', async () => {
    const unrelated = ACCOUNTS.unrelated.user;
    const find = async () => (await shareList(S.p)).find(u => u.username === unrelated);

    await expectStatus(await as('admin').put(`/projects/${S.p}/users`, { username: unrelated, permission: READ }), 201);
    expect((await find())?.permission).toBe(READ);

    await expectStatus(await as('admin').post(`/projects/${S.p}/users/${unrelated}`, { permission: WRITE }), 200);
    expect((await find())?.permission).toBe(WRITE);

    await expectStatus(await as('admin').del(`/projects/${S.p}/users/${unrelated}`), 200);
    expect(await find()).toBeUndefined();
  });

  /// TC-RBAC-13: Write user can't add a new share
  test('TC-RBAC-13: write user adds a new share', async () => {
    await expectStatus(await as('write').put(`/projects/${S.p}/users`, { username: ACCOUNTS.unrelated.user, permission: READ }), 403);
    await expectStatus(await as('unrelated').get(`/projects/${S.p}`), 403);
  });

  /// TC-RBAC-14: Write user can't move C1 under their own project
  test('TC-RBAC-14: write user reparents a project', async () => {
    const b1 = await expectStatus(await as('write').put('/projects', { title: `B1 ${stamp}` }), 201);
    const c1 = await expectStatus(await as('write').get(`/projects/${S.c1}`), 200);

    await expectStatus(await as('write').post(`/projects/${S.c1}`, { ...c1, parent_project_id: b1.id }), 403);

    expect((await expectStatus(await as('owner').get(`/projects/${S.c1}`), 200)).parent_project_id).toBe(S.p);
    expect(await maxPermission('write', S.c1)).toBe(WRITE);
  });

  /// TC-RBAC-15: Write user can't move a task into a project they can only read
  test('TC-RBAC-15: write user moves a task to a read-only project', async () => {
    const task = await createTask('owner', S.p, `rbac-move-${stamp}`);
    const full = await ownerTask(task.id);

    await expectStatus(await as('write').post(`/tasks/${task.id}`, { ...full, project_id: S.q }), 403);
    expect((await ownerTask(task.id)).project_id).toBe(S.p);
  });

  /// TC-RBAC-16: Read user can't update a task
  test('TC-RBAC-16: read user updates a task', async () => {
    const task = await ownerTask(S.task);
    await expectStatus(await as('read').post(`/tasks/${S.task}`, { ...task, title: 'rbac-hacked' }), 403);
    expect((await ownerTask(S.task)).title).toBe(S.taskTitle);
  });

  /// TC-RBAC-17: Read user can't mark a task done
  test('TC-RBAC-17: read user marks a task as done', async () => {
    const task = await ownerTask(S.task);
    await expectStatus(await as('read').post(`/tasks/${S.task}`, { ...task, done: true }), 403);
    expect((await ownerTask(S.task)).done).toBe(false);
  });

  /// TC-RBAC-18: Read user can't comment
  test('TC-RBAC-18: read user adds a comment', async () => {
    const comments = async () => expectStatus(await as('owner').get(`/tasks/${S.task}/comments`), 200);
    const before = (await comments()).length;

    await expectStatus(await as('read').put(`/tasks/${S.task}/comments`, { comment: 'rbac-comment' }), 403);
    expect(await comments()).toHaveLength(before);
  });

  /// TC-RBAC-19: Read user can't add an assignee, label or attachment
  test('TC-RBAC-19: read user adds an assignee, label or attachment', async () => {
    const me = await expectStatus(await as('read').get('/user'), 200);
    const label = await expectStatus(await as('read').put('/labels', { title: `rbac-read-label-${stamp}` }), 201);

    await expectStatus(await as('read').put(`/tasks/${S.task}/assignees`, { user_id: me.id }), 403);
    await expectStatus(await as('read').put(`/tasks/${S.task}/labels`, { label_id: label.id }), 403);
    const upload = await api.put(`${API}/tasks/${S.task}/attachments`, {
      headers: { Authorization: `Bearer ${tokens.read}` },
      multipart: { files: { name: 'rbac.txt', mimeType: 'text/plain', buffer: Buffer.from('rbac') } },
    });
    await expectStatus(upload, 403);

    const task = await ownerTask(S.task);
    expect(task.assignees ?? []).toHaveLength(0);
    expect(task.labels ?? []).toHaveLength(0);
    expect(task.attachments ?? []).toHaveLength(0);
  });

  /// TC-RBAC-20: Read user can't move a task between Kanban buckets
  test('TC-RBAC-20: read user moves a task on the Kanban board', async () => {
    const bucketOf = async () => {
      const buckets = await expectStatus(await as('owner').get(`/projects/${S.p}/views/${S.kanbanView}/tasks`), 200);
      return buckets.find((b: any) => (b.tasks ?? []).some((t: any) => t.id === S.task)).id as number;
    };
    const buckets = await expectStatus(await as('owner').get(`/projects/${S.p}/views/${S.kanbanView}/buckets`), 200);
    const from = await bucketOf();
    const to = buckets.find((b: any) => b.id !== from).id;

    await expectStatus(await as('read').post(`/projects/${S.p}/views/${S.kanbanView}/buckets/${to}/tasks`, { task_id: S.task }), 403);
    expect(await bucketOf()).toBe(from);
  });

  /// TC-RBAC-21: Read on P is inherited by C1
  test('TC-RBAC-21: read on parent applies to child', async () => {
    const c1List = await viewId(S.c1, 'list');
    await expectStatus(await as('read').get(`/projects/${S.c1}/views/${c1List}/tasks`), 200);
    await expectStatus(await as('read').put(`/projects/${S.c1}/tasks`, { title: 'rbac-child-probe' }), 403);
  });

  /// TC-RBAC-22: Admin on P, direct Read on C1.
  /// Intended behaviour: the direct, more specific Read share on C1 wins, so the share request is 403.
  /// Known defect BUG-002: Vikunja v2.7.1 lets the parent Admin permission win and returns 201.
  /// The assertion pins today's behaviour, so CI stays green while the bug exists and fails once it's fixed.
  test('TC-RBAC-22: admin on parent, read set on child [known defect BUG-002]', async () => {
    test.info().annotations.push({ type: 'known defect', description: 'BUG-002: expected 403, Vikunja v2.7.1 returns 201' });
    await share(S.c1, 'admin', READ);
    const res = await as('admin').put(`/projects/${S.c1}/users`, { username: ACCOUNTS.unrelated.user, permission: READ });
    const status = res.status();

    // Clean up so other tests see C1 unchanged, whatever the result
    if (status === 201) await as('owner').del(`/projects/${S.c1}/users/${ACCOUNTS.unrelated.user}`);
    await as('owner').del(`/projects/${S.c1}/users/${ACCOUNTS.admin.user}`);

    expect(status, 'BUG-002 looks fixed: change this assertion to expect 403 and close the bug report').toBe(201);
  });

  /// TC-RBAC-23: Shared Admin archives and deletes a project (destructive: throwaway project)
  /// Pinned for Vikunja v2.7: a direct Admin share may archive and delete the project.
  test('TC-RBAC-23: shared admin deletes or archives the project', async () => {
    const p = await throwawayProject('TC-23', [['admin', ADMIN]]);

    const archived = await expectStatus(await as('admin').post(`/projects/${p.id}`, { title: p.title, is_archived: true }), 200);
    expect(archived.is_archived).toBe(true);

    await expectStatus(await as('admin').del(`/projects/${p.id}`), 200);
    const gone = await as('owner').get(`/projects/${p.id}`);
    expect([403, 404]).toContain(gone.status());
  });

  /// TC-RBAC-24: Team member gets the team's Read level
  test('TC-RBAC-24: team member gets the team level', async () => {
    await expectStatus(await as('team').get(`/projects/${S.p}/views/${S.listView}/tasks`), 200);
    await expectStatus(await as('team').put(`/projects/${S.p}/tasks`, { title: 'rbac-team-probe' }), 403);
  });

  /// TC-RBAC-25: Removed from the team loses access (destructive: own team and project)
  test('TC-RBAC-25: removed from team loses access', async () => {
    const team = await expectStatus(await as('owner').put('/teams', { name: `rbac-team-25-${stamp}` }), 201);
    await expectStatus(await as('owner').put(`/teams/${team.id}/members`, { username: ACCOUNTS.team.user }), 201);
    const p = await throwawayProject('TC-25');
    await expectStatus(await as('owner').put(`/projects/${p.id}/teams`, { team_id: team.id, permission: READ }), 201);
    await expectStatus(await as('team').get(`/projects/${p.id}`), 200);

    // User-Owner is the team admin and removes User-Team
    await expectStatus(await as('owner').del(`/teams/${team.id}/members/${ACCOUNTS.team.user}`), 200);
    await expectStatus(await as('team').get(`/projects/${p.id}`), 403);
  });

  /// TC-RBAC-26: Team Read share plus a direct Write share.
  /// Pinned: the highest permission wins, so User-Team can write.
  test('TC-RBAC-26: team share and direct share both apply', async () => {
    const p = await throwawayProject('TC-26', [['team', WRITE]]);
    await expectStatus(await as('owner').put(`/projects/${p.id}/teams`, { team_id: S.team, permission: READ }), 201);

    await expectStatus(await as('team').put(`/projects/${p.id}/tasks`, { title: 'rbac-team-write' }), 201);
    expect(await maxPermission('team', p.id)).toBe(WRITE);
  });

  /// TC-RBAC-27: Read link share can't write
  test('TC-RBAC-27: read link share tries to write', async () => {
    const linkShare = await expectStatus(await as('owner').put(`/projects/${S.p}/shares`, { permission: READ, sharing_type: 1 }), 201);
    const { token } = await expectStatus(await api.post(`${API}/shares/${linkShare.hash}/auth`, { data: {} }), 200);

    await expectStatus(await client(token).put(`/projects/${S.p}/tasks`, { title: 'rbac-link-probe' }), 403);
    expect(await ownerTaskTitles()).not.toContain('rbac-link-probe');
  });

  /// TC-RBAC-28: Deleted link share token stops working.
  /// Known defect BUG-003: the token is rejected and no data leaks, but with 400 instead of 401/403.
  test('TC-RBAC-28: deleted link share token stops working [known defect BUG-003]', async () => {
    test.info().annotations.push({ type: 'known defect', description: 'BUG-003: expected 401/403, Vikunja v2.7.1 returns 400' });
    const linkShare = await expectStatus(await as('owner').put(`/projects/${S.p}/shares`, { permission: READ, sharing_type: 1 }), 201);
    const { token } = await expectStatus(await api.post(`${API}/shares/${linkShare.hash}/auth`, { data: {} }), 200);
    await expectStatus(await client(token).get(`/projects/${S.p}`), 200);

    await expectStatus(await as('owner').del(`/projects/${S.p}/shares/${linkShare.id}`), 200);

    const res = await client(token).get(`/projects/${S.p}`);
    expect(await res.text()).not.toContain(S.pTitle);
    expect(res.status(), 'BUG-003 looks fixed: change this assertion to expect 401 or 403 and close the bug report').toBe(400);
  });

  /// TC-RBAC-29: Scoped API token can't go beyond its scope
  test('TC-RBAC-29: scoped API token cannot exceed its scope', async () => {
    const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const apiToken = await expectStatus(await as('write').put('/tokens',
      { title: `rbac-29-${stamp}`, expires_at: expires, permissions: { tasks: ['read_all'] } }), 201);

    const res = await client(apiToken.token).put(`/projects/${S.p}/tasks`, { title: 'rbac-token-probe' });
    expect([401, 403]).toContain(res.status());
    expect(await ownerTaskTitles()).not.toContain('rbac-token-probe');

    await as('write').del(`/tokens/${apiToken.id}`);
  });

  /// TC-RBAC-30: Downgrade from Write to Read takes effect on the next request (throwaway project)
  test('TC-RBAC-30: downgrade from write to read takes effect immediately', async () => {
    const p = await throwawayProject('TC-30', [['write', WRITE]]);
    await expectStatus(await as('write').put(`/projects/${p.id}/tasks`, { title: 'rbac-before-downgrade' }), 201);

    await expectStatus(await as('owner').post(`/projects/${p.id}/users/${ACCOUNTS.write.user}`, { permission: READ }), 200);
    await expectStatus(await as('write').put(`/projects/${p.id}/tasks`, { title: 'rbac-after-downgrade' }), 403);
  });
});
