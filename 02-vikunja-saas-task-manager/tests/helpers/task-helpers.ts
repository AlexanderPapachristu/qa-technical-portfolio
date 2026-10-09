import { Page, expect } from '@playwright/test';

export async function login(page: Page) {
    const username = 'test_account';
    const password = 'UserPassword';

    await page.goto('https://try.vikunja.io/login');
    await page.getByRole('textbox', { name: 'Username Or Email Address' }).fill(username);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('checkbox', { name: 'Stay logged in' }).click();
    await page.getByRole('textbox', { name: 'Password' }).press('Enter');
}

/// Go to the base URL and ensure the page is ready for testing
export async function beginTest(page: Page) {
    const baseURL = 'https://try.vikunja.io';

    await page.goto(baseURL);
    await expect(page.getByRole('textbox', { name: 'Add a task…' })).toBeVisible();
}

/// Create a new task with the given title
export async function createTask(page: Page, taskTitle: string) {
    await page.getByRole('textbox', { name: 'Add a task…' }).fill(taskTitle);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
}

/// Change the filter settings for the current view to show or hide completed tasks
export async function changeFilter(page: Page, onOff: boolean) {
    const setMenu = page.getByRole('banner', { name: 'main navigation' }).getByRole('button', { name: 'Open project settings menu' });
    const viewsLink = page.getByRole('link', { name: 'Views' });
    const editViewButton = page.getByRole('row', { name: 'List list Delete this view' }).getByLabel('Edit this view');
    const filterPrefs = onOff ? 'done = false || done = true' : 'done = false';

    await page.getByRole('navigation', { name: 'Projects' }).getByRole('link', { name: 'Inbox' }).click();
    await setMenu.click();
    await viewsLink.click();
    await editViewButton.click();

    // Edit the view to show completed tasks by changing the filter query
    await page.getByRole('textbox', { name: 'Filter query' }).click();
    await page.getByRole('cell', { name: 'Title List Kind List Filter' }).click();
    await page.getByRole('textbox', { name: 'Filter query' }).fill(filterPrefs);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Close dialog' }).click();

    // refresh the page to ensure the filter changes take effect
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('button', { name: 'Show results' }).click();
    await page.waitForTimeout(200); // Wait for the page to refresh and apply the filter
}

/// Toggle the completion status of a task by clicking its checkbox
export async function toggleTask(page: Page, title: string){
    const checkbox = page.getByRole('checkbox', { name: `Mark '${title}' as done` });
    await checkbox.locator('..').getByRole('img', {name: 'Checkbox'}).click();
    return checkbox;
}