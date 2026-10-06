import { test, expect } from '@playwright/test';

test.describe('Vikunja Tasks', () => {

  // Runs before every test in this block
  test.beforeEach(async ({ page }) => {
    await page.goto('https://try.vikunja.io/login');
    
    // Fill credentials
    await page.getByRole('textbox', { name: 'Username Or Email Address' }).fill('test_account');
    await page.getByRole('textbox', { name: 'Password' }).fill('UserPassword');
    await page.getByRole('textbox', { name: 'Password' }).press('Enter');

    // Confirm login succeeded before letting tests run
    await expect(page.getByRole('textbox', { name: 'Add a task…' })).toBeVisible();
  });

  test('should create a new task', async ({ page }) => {
    // Already authenticated; run test actions directly
    await page.getByRole('textbox', { name: 'Add a task…' }).fill('Shift v1.0 Release Notes');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    // Verify task was created
    await expect(page.getByText('Shift v1.0 Release Notes')).toBeVisible();
  });

  test('adding an empty task should not create a task', async ({ page }) => {
    // Listen for any page errors (e.g., crashes) and log them
    page.on('pageerror', (err) => console.log('Client crash:', err.message));
    const taskInput = page.getByRole('textbox', { name: 'Add a task…' });
    const addButton = page.getByRole('button', { name: 'Add', exact: true });
    // Attempt to add an empty task
    await taskInput.click();
    await expect(addButton).toBeDisabled();
  });

  test('enter title character limit checking boundaries', async ({ page }) => {
    const taskInput = page.getByRole('textbox', { name: 'Add a task…' });
    const addButton = page.getByRole('button', { name: 'Add', exact: true });
    const text: string = 'a'.repeat(500);
  
    await taskInput.fill(text);
    await expect(addButton).toBeEnabled();
    await addButton.click();
    await expect(page.getByText(text)).toBeVisible();    
  });

  test('test emojis in the title', async ({ page }) => {
    const taskInput = page.getByRole('textbox', { name: 'Add a task…' });
    const addButton = page.getByRole('button', { name: 'Add', exact: true });
    const text: string = 'Task with emoji 🚀🔥';
  
    await taskInput.fill(text);
    await expect(addButton).toBeEnabled();
    await addButton.click();
    await expect(page.getByText(text)).toBeVisible();    
  });

  test('test checkbox removes task from the list', async ({ page }) => {
    const taskInput = page.getByRole('textbox', { name: 'Add a task…' });
    const addButton = page.getByRole('button', { name: 'Add', exact: true });
    const text: string = 'Task to be completed';

    await taskInput.fill(text);
    await expect(addButton).toBeEnabled();
    await addButton.click();
    await expect(page.getByText(text)).toBeVisible();

    // Click the checkbox to mark the task as completed
    await page.getByRole('listitem').filter({ hasText: 'CheckboxInboxTask to be' }).getByRole('img').click();
    await page.getByRole('checkbox', { name: 'Mark \'Task to be completed' }).check();
    await expect(page.getByText(text)).not.toBeVisible();
  });

  test('test checkbox adds items back to the list', async ({ page }) => {
    const checkbox = page.getByRole('img', { name: 'Checkbox' });
    const setMenu = page.getByRole('banner', { name: 'main navigation' }).getByRole('button', { name: 'Open project settings menu' });
    const viewsLink = page.getByRole('link', { name: 'Views' });
    const editViewButton = page.getByRole('row', { name: 'List list Delete this view' }).getByLabel('Edit this view');
    const text: string = 'Task to be completed';

    await page.getByRole('navigation', { name: 'Projects' }).getByRole('link', { name: 'Inbox' }).click();
    await setMenu.click();
    await viewsLink.click();
    await editViewButton.click();
    await page.getByRole('textbox', { name: 'Filter query' }).click();
    await page.getByRole('cell', { name: 'Title List Kind List Filter' }).click();
    await page.getByRole('textbox', { name: 'Filter query' }).fill('done = false || done = true');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    // await page.getByRole('img', { name: 'Checkbox' }).first().click();
    
    // uncheck the first checkbox to mark the task as not completed
    await checkbox.first().click();
    await setMenu.click();
    await viewsLink.click();
    await editViewButton.click();
    await page.getByRole('textbox', { name: 'Filter query' }).click();
    await page.locator('div').filter({ hasText: 'Edit viewsCreate' }).first().click();
    await page.getByRole('textbox', { name: 'Filter query' }).fill('done = false');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Close dialog' }).click();

    await expect(page.getByText(text)).toBeVisible();
  });

});