// Creates the test accounts from .env on the local Vikunja (docker-compose.yml).
// Safe to run again: accounts that can already log in are skipped.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const BASE = (process.env.VIKUNJA_URL ?? 'http://localhost:3456').replace(/\/$/, '');
const API = `${BASE}/api/v1`;

// [label, username env, password env]; TASK_* is the account used by the task-lifecycle specs
const ACCOUNTS = [
  ['A: Owner',      'OWNER_USER',      'OWNER_PASS'],
  ['B: Write',      'WRITE_USER',      'WRITE_PASS'],
  ['C: Read',       'READ_USER',       'READ_PASS'],
  ['D: Unrelated',  'UNRELATED_USER',  'UNRELATED_PASS'],
  ['E: ShareAdmin', 'SHAREADMIN_USER', 'SHAREADMIN_PASS'],
  ['F: Team',       'TEAM_USER',       'TEAM_PASS'],
  ['Task specs',    'TASK_USER',       'TASK_PASS'],
];

async function waitForApi(timeoutMs = 90_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      if ((await fetch(`${API}/info`)).ok) return;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`Vikunja did not answer at ${API}/info. Is the container running? (npm run vikunja:up)`);
}

const post = (url, body) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function main() {
  // Only ever register accounts on a local instance
  const host = new URL(BASE).hostname;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) {
    throw new Error(`VIKUNJA_URL is ${BASE}. Set it to http://localhost:3456 to seed the local instance.`);
  }

  await waitForApi();
  let failed = false;

  for (const [label, userKey, passKey] of ACCOUNTS) {
    const username = process.env[userKey];
    const password = process.env[passKey];
    if (!username || !password) {
      console.log(`- ${label}: skipped (${userKey}/${passKey} not set in .env)`);
      continue;
    }
    if (password.length < 8) {
      console.log(`x ${label}: ${passKey} must be at least 8 characters`);
      failed = true;
      continue;
    }

    if ((await post(`${API}/login`, { username, password })).ok) {
      console.log(`= ${label}: ${username} already exists`);
      continue;
    }

    const email = `${username.toLowerCase()}@example.test`;
    const res = await post(`${API}/register`, { username, email, password });
    if (res.ok) {
      console.log(`+ ${label}: created ${username}`);
    } else {
      console.log(`x ${label}: could not create ${username} (${res.status}: ${await res.text()})`);
      failed = true;
    }
  }

  if (failed) process.exit(1);
  await seedBaseProject();
}

/// Matrix setup: User-Owner owns PROJECT_TITLE, shared with User-Read at Read (0).
/// tests/tc-rbac-script.spec.ts expects this project to exist already.
async function seedBaseProject() {
  const { OWNER_USER, OWNER_PASS, READ_USER, PROJECT_TITLE } = process.env;
  if (!OWNER_USER || !OWNER_PASS || !READ_USER || !PROJECT_TITLE) return;

  const { token } = await (await post(`${API}/login`, { username: OWNER_USER, password: OWNER_PASS })).json();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const call = (method, p, body) => fetch(`${API}${p}`, { method, headers, body: body && JSON.stringify(body) });

  const projects = await (await call('GET', `/projects?s=${encodeURIComponent(PROJECT_TITLE)}`)).json();
  let project = projects.find(p => p.title === PROJECT_TITLE);
  if (!project) {
    project = await (await call('PUT', '/projects', { title: PROJECT_TITLE })).json();
    console.log(`+ Project "${PROJECT_TITLE}" created`);
  } else {
    console.log(`= Project "${PROJECT_TITLE}" already exists`);
  }

  const shares = await (await call('GET', `/projects/${project.id}/users`)).json();
  if (!shares.some(u => u.username === READ_USER)) {
    const res = await call('PUT', `/projects/${project.id}/users`, { username: READ_USER, permission: 0 });
    if (!res.ok) throw new Error(`Could not share "${PROJECT_TITLE}" with ${READ_USER} (${res.status})`);
    console.log(`+ Shared "${PROJECT_TITLE}" with ${READ_USER} at Read`);
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
