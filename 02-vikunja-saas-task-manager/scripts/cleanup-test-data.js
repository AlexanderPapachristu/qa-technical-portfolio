// Deletes the data the test suites create, for every test account in .env:
//   - every project the account owns (child projects and all tasks go with them),
//     except its default project (Inbox) and the seeded PROJECT_TITLE project
//   - every task in its default project
//   - teams it created and "rbac-" labels it created
// Accounts themselves are kept. Used as Playwright's globalTeardown and after Newman runs.
// Run on its own with: npm run vikunja:clean
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const ACCOUNT_KEYS = ['OWNER', 'WRITE', 'READ', 'UNRELATED', 'SHAREADMIN', 'TEAM', 'TASK'];
const PER_PAGE = 50;

async function cleanupTestData() {
  if (process.env.KEEP_TEST_DATA) {
    console.log('KEEP_TEST_DATA is set: skipping test data cleanup');
    return;
  }

  const API = `${(process.env.VIKUNJA_URL ?? 'http://localhost:3456').replace(/\/$/, '')}/api/v1`;
  const keepTitle = process.env.PROJECT_TITLE;
  const totals = { projects: 0, tasks: 0, teams: 0, labels: 0 };

  for (const key of ACCOUNT_KEYS) {
    const username = process.env[`${key}_USER`];
    const password = process.env[`${key}_PASS`];
    if (!username || !password) continue;

    const login = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!login.ok) {
      console.log(`cleanup: skipped ${username} (login returned ${login.status})`);
      continue;
    }
    const headers = { Authorization: `Bearer ${(await login.json()).token}` };
    const get = async p => (await fetch(`${API}${p}`, { headers })).json();
    const del = p => fetch(`${API}${p}`, { method: 'DELETE', headers });

    /// Every page of a list endpoint, collected before anything is deleted
    const all = async p => {
      const items = [];
      for (let page = 1; ; page++) {
        const batch = await get(`${p}${p.includes('?') ? '&' : '?'}per_page=${PER_PAGE}&page=${page}`);
        if (!Array.isArray(batch) || batch.length === 0) break;
        items.push(...batch);
        if (batch.length < PER_PAGE) break;
      }
      return items;
    };

    const me = await get('/user');
    const defaultProject = me.settings?.default_project_id;

    // Projects: negative IDs are pseudo projects (favourites, saved filters).
    // Deleting a parent also deletes its children, so a later 404 for a child is expected.
    const projects = (await all('/projects?is_archived=true')).filter(p =>
      p.id > 0 && p.owner?.id === me.id && p.id !== defaultProject && p.title !== keepTitle);
    for (const p of projects) {
      const res = await del(`/projects/${p.id}`);
      if (res.ok) totals.projects++;
    }

    // Tasks left in the default project (the task-lifecycle specs create them in the Inbox)
    const tasks = (await all('/tasks')).filter(t => t.project_id === defaultProject);
    for (const t of tasks) {
      if ((await del(`/tasks/${t.id}`)).ok) totals.tasks++;
    }

    const teams = (await all('/teams')).filter(t => t.created_by?.id === me.id);
    for (const t of teams) {
      if ((await del(`/teams/${t.id}`)).ok) totals.teams++;
    }

    const labels = (await all('/labels')).filter(l => l.created_by?.id === me.id && l.title.startsWith('rbac-'));
    for (const l of labels) {
      if ((await del(`/labels/${l.id}`)).ok) totals.labels++;
    }
  }

  console.log(`cleanup: deleted ${totals.projects} projects, ${totals.tasks} inbox tasks, ${totals.teams} teams, ${totals.labels} labels`);
}

module.exports = cleanupTestData;

if (require.main === module) {
  cleanupTestData().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
