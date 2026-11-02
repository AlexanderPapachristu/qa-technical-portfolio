import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Read environment variables from .env (credentials and URLs for the RBAC tests).
 * https://github.com/motdotla/dotenv
 */
dotenv.config({ path: path.resolve(__dirname, '.env') });

/** RBAC specs run in their own projects, without the saved login from auth.setup.ts */
const RBAC = /tc-rbac-.*\.spec\.ts/;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/login')`. */
    baseURL: process.env.VIKUNJA_URL ?? 'https://try.vikunja.io',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  projects: [
    /* Logs in once and saves the session for the task tests */
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    /* Task tests: depend on setup, skip the RBAC specs */
    {
      name: 'chromium',
      testIgnore: RBAC,
      use: { ...devices['Desktop Chrome'],
        permissions: ['clipboard-read', 'clipboard-write'],
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      testIgnore: RBAC,
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      testIgnore: RBAC,
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },

    /* RBAC tests: no setup dependency and no saved login; each test logs in its own users */
    { name: 'rbac-chromium', testMatch: RBAC, use: { ...devices['Desktop Chrome'] } },
    { name: 'rbac-firefox',  testMatch: RBAC, use: { ...devices['Desktop Firefox'] } },
    { name: 'rbac-webkit',   testMatch: RBAC, use: { ...devices['Desktop Safari'] } },
  ],
});
