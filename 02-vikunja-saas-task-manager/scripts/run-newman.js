// Runs the Postman collections in ../api-artifacts with Newman, using the URL and passwords from .env.
// Usage: node scripts/run-newman.js [collection.json ...]   (defaults to every collection)
const path = require('path');
const fs = require('fs');
const newman = require('newman');
const cleanupTestData = require('./cleanup-test-data');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const ROOT = path.resolve(__dirname, '..', '..');
const ARTIFACTS = path.join(ROOT, 'api-artifacts');
const BASE = (process.env.VIKUNJA_URL ?? 'http://localhost:3456').replace(/\/$/, '');

const envVar = [
  { key: 'base_url', value: `${BASE}/api/v1` },
  { key: 'project_title', value: process.env.PROJECT_TITLE ?? 'RBAC Test Project' },
  ...[['owner', 'OWNER'], ['write', 'WRITE'], ['read', 'READ'], ['unrelated', 'UNRELATED'], ['admin', 'SHAREADMIN'], ['team', 'TEAM']]
    .flatMap(([key, env]) => [
      { key: `${key}_user`, value: process.env[`${env}_USER`] ?? '' },
      { key: `${key}_pass`, value: process.env[`${env}_PASS`] ?? '' },
    ]),
];

const collections = process.argv.length > 2
  ? process.argv.slice(2)
  : fs.readdirSync(ARTIFACTS).filter(f => f.endsWith('.json')).sort();

const reportDir = path.resolve(__dirname, '..', 'newman-report');
fs.mkdirSync(reportDir, { recursive: true });

function run(file) {
  return new Promise((resolve, reject) => {
    newman.run({
      collection: path.resolve(ARTIFACTS, file),
      envVar,
      workingDir: ROOT, // the TC-RBAC-19 attachment path is relative to the repository root
      reporters: ['cli', 'junit'],
      reporter: { junit: { export: path.join(reportDir, file.replace(/\.json$/, '.xml')) } },
    }, (err, summary) => {
      if (err) return reject(err);
      resolve(summary.run.failures.length);
    });
  });
}

(async () => {
  let failures = 0;
  try {
    for (const file of collections) failures += await run(file);
  } finally {
    await cleanupTestData();
  }
  process.exit(failures ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
