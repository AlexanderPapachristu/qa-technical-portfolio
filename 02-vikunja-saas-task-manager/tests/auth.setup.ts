import { test as setup, expect } from '@playwright/test';
import * as helper from './helpers/task-helpers';

const authFile = 'playwright/.auth/user.json';

setup('setup', async ({ page }) => {
    await page.goto('https://try.vikunja.io/login');

    // Fill credentials
    helper.login(page);

    const taskInput = page.getByRole('textbox', { name: 'Add a task…' });
    await expect(taskInput).toBeVisible();

    await page.waitForFunction(() => {
        return localStorage.getItem('token') !== null || Object.keys(localStorage).length > 0;
    });
    await page.waitForTimeout(500);

    await page.context().storageState({ path: authFile });
});