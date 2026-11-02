import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    // Setup project runs first
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    {
      name: 'chromium',
      testIgnore: /tc-rbac-.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Every test inherits the saved logged-in state
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    { name: 'rbac-chromium', testMatch: /tc-rbac-.*\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'rbac-firefox',  testMatch: /tc-rbac-.*\.spec\.ts/, use: { ...devices['Desktop Firefox'] } },
    { name: 'rbac-webkit',   testMatch: /tc-rbac-.*\.spec\.ts/, use: { ...devices['Desktop Safari'] } },
  ],
});