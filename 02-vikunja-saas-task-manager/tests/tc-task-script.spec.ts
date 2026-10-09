import { test, expect } from './fixtures';
import * as helper from './helpers/task-helpers';

test.describe('Vikunja Tasks', () => {
  // const baseURL = 'https://try.vikunja.io';


  /// TC-TASK-01: Test that a new task can be created and displayed correctly.
  test('TC-TASK-01: should create a new task', async ({ page }) => {
    await helper.beginTest(page);

    // Already authenticated; run test actions directly
    const prefix = `${Date.now()}-`;
    const text: string = prefix + 'Shift v1.0 Release Notes';
    await page.getByRole('textbox', { name: 'Add a task…' }).fill(text);
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    // Verify task was created
    await expect(page.getByText(text)).toBeVisible();
  });


  /// TC-TASK-02: Test that adding an empty task does not create a task and the "Add" button is disabled.
  test('TC-TASK-02: adding an empty task should not create a task', async ({ page }) => {
    await helper.beginTest(page);

    // Listen for any page errors (e.g., crashes) and log them
    page.on('pageerror', (err) => console.log('Client crash:', err.message));
    const taskInput = page.getByRole('textbox', { name: 'Add a task…' });
    const addButton = page.getByRole('button', { name: 'Add', exact: true });
    // Attempt to add an empty task
    await taskInput.click();
    await expect(addButton).toBeDisabled();
  });


  /// TC-TASK-03: Test that a task with a title of 500 characters can be created and displayed correctly.
  test('TC-TASK-03: enter title character limit checking boundaries', async ({ page }) => {
    await helper.beginTest(page);

    // const text: string = 'a'.repeat(500);
    const prefix = `${Date.now()}-`;
    const text = prefix + 'a'.repeat(500 - prefix.length);
  
    await helper.createTask(page, text);
    await expect(page.getByText(text)).toBeVisible();    
  });


  /// TC-TASK-04: Test that a task with emojis in the title can be created and displayed correctly.
  test('TC-TASK-04: test emojis in the title', async ({ page }) => {
    await helper.beginTest(page);

    const prefix = `${Date.now()}-`;
    const text: string = prefix + 'Task with emoji 🚀🔥';
  
    await helper.createTask(page, text);
    await expect(page.getByText(text)).toBeVisible();    
  });


  /// TC-TASK-05: Test that a completed task is removed from the list when the checkbox is checked.
  test('TC-TASK-05: test checkbox removes task from the list', async ({ page }) => {
    await helper.beginTest(page);

    const prefix = `${Date.now()}-`;
    const text: string = prefix + 'Task to be completed';

    await helper.createTask(page, text);
    await expect(page.getByText(text)).toBeVisible();

    await helper.toggleTask(page, text);
    await expect(page.getByText(text)).not.toBeVisible();
  });


  /// TC-TASK-06: Test that a completed task can be restored to the list by unchecking the checkbox.
  test('TC-TASK-06: test checkbox adds items back to the list', async ({ page }) => {
    await helper.beginTest(page);


    const prefix = `${Date.now()}-`;
    const text: string = prefix + 'Task to be deleted and restored';
    const showHidden = true;
    const hideCompleted = false;

    // Add the task to be deleted and restored
    await helper.createTask(page, text);
    await expect(page.getByText(text)).toBeVisible();

    // Mark task as completed by checking the checkbox
    const checkbox = await helper.toggleTask(page, text);

    await helper.changeFilter(page, showHidden);
    await expect(checkbox).toBeChecked();

    // Uncheck the checkbox to mark the task as not completed
    await helper.toggleTask(page, text);
    await expect(checkbox).not.toBeChecked();

    await helper.changeFilter(page, hideCompleted);
    await expect(page.getByText(text)).toBeVisible();
  });


  /// TC-TASK-07: Test that a task with a due date before the start date is marked as overdue and displays the correct overdue message.
  test('TC-TASK-07: test due date before start date', async ({ page }) => {
    await helper.beginTest(page);


    // Setup task name with unique prefix to avoid conflicts with other tests
    const prefix = `${Date.now()}-`;
    const text: string = prefix + 'Task with invalid due date';

    await helper.createTask(page, text);
    await expect(page.getByText(text)).toBeVisible();
    await page.getByText(text).click();

    // Set start date to tomorrow
    await page.getByRole('button', { name: 'Set Start Date' }).click();
    await page.getByRole('button', { name: 'Tomorrow' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.waitForTimeout(200); // Wait for the start date to be set

    // Set due date to today (which is before the start date)
    await page.getByRole('button', { name: 'Set Due Date' }).click();
    await page.getByRole('button', { name: 'Today' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();

    await page.getByRole('button', { name: 'Back to project' }).click();

    // Check if the task is overdue 
    const row = page.locator('.single-task').filter({ hasText: text });
    await expect(row).toHaveAttribute('data-is-overdue');

    await expect(row.locator('.dueDate')).toContainText(/Due .+ ago/);
  });

  /// TC-TASK-08: Test that a recurring task is created correctly and displays the correct recurrence information. The task should reappear in the list after the task is completed.
  test('TC-TASK-08: test recurring task creation and completion', async ({ page }) => {
    await helper.beginTest(page);

    // Setup task name with unique prefix to avoid conflicts with other tests
    const prefix = `${Date.now()}-`;
    const text: string = prefix + 'Recurring Task';

    await helper.createTask(page, text);
    await expect(page.getByText(text)).toBeVisible();
    await page.getByText(text).click();

    // Set the task to recur daily
    await page.getByRole('button', { name: 'Set Repeating Interval' }).click();
    await page.getByRole('button', { name: 'Every Day' }).click();
    await page.getByRole('button', { name: 'Back to project' }).click();

    await helper.toggleTask(page, text);
    await expect(page.getByText(text)).toBeVisible();
  });

  /// TC-TASK-09: Test task priority and persistence through browser refresh. The task should retain its priority and completed status after a page reload.
  test('TC-TASK-09: test task priority and persistence through refresh', async ({ page }) => {
    await helper.beginTest(page);
    
    const prefix = `${Date.now()}-`;
    const text: string = prefix + 'Task with priority and persistence';

    await helper.createTask(page, text);
    await expect(page.getByText(text)).toBeVisible();

    // Set the task priority to "High"
    await page.getByText(text).click();
    await page.getByRole('button', { name: 'Set Priority' }).click();
    await page.getByLabel('Priority').selectOption('3');
    await page.getByRole('button', { name: 'Back to project' }).click();

    // Test that the task created has the correct priority icon
    const row = page.locator('.single-task').filter({ hasText: text });
    await expect(row.locator('.svg-inline--fa.fa-circle-exclamation')).toBeVisible();

    // Refresh the page and check that the task still has the correct priority icon and is still marked as completed
    await page.reload();
    await expect(row.locator('.svg-inline--fa.fa-circle-exclamation')).toBeVisible();
  });

  /// TC-TASK-10: Test markdown rendering in task descriptions. The task description should render markdown correctly, including bold, italic, and links.
  /// Due to limitations in Playwright's text input handling, the test uses a workaround to paste a markdown link from the clipboard to ensure proper rendering. The test verifies that the markdown is rendered correctly in the task description.
  test('TC-TASK-10: test markdown rendering in task descriptions', async ({ page, browserName }) => {
    // test.fixme(browserName === 'webkit', 'This test is currently failing due to the word link being deleted when the enter button is pressed in the link input.');
    
    await helper.beginTest(page);

    const prefix = `${Date.now()}-`;
    const text: string = prefix + 'Task with markdown description';
    const description: string = '**Bold Text** _Italic Text_';
    const linkText: string = 'https://example.com';

    await helper.createTask(page, text);
    await expect(page.getByText(text)).toBeVisible();
    await page.getByText(text).click();

    // Add markdown description to the task

    await page.locator('.tiptap__editor').first().click();

    const editor = page.getByLabel('Enter a description, hit \'/\'')
    // Type the description with markdown syntax sequentially to ensure proper rendering
    await editor.pressSequentially(description);

    await editor.pressSequentially(' Link');
    // await editor.getByText('Link').dblclick();
    await page.keyboard.press('Control+Shift+ArrowLeft');

    await page.getByRole('button', {name: 'Link', exact: true}).first().click();

    const urlInput = page.getByRole('textbox', { name: 'URL' });
    await urlInput.fill(linkText);
    await urlInput.press('Enter');   
    
    const link = editor.getByRole('link', { name: 'Link', exact: true });
    await expect(link).toHaveAttribute('href', linkText); // Verify the link's href attribute
    await expect(editor.locator('strong')).toHaveText('Bold Text'); // Verify bold text
    await expect(editor.locator('em')).toHaveText('Italic Text'); // Verify italic text
  });
  
  /// TC-TASK-11: Test that a task can be deleted and is no longer visible in the task list after deletion.
  test('TC-TASK-11: test task deletion', async ({ page }) => {
    await helper.beginTest(page);

    const prefix = `${Date.now()}-`;
    const text: string = prefix + 'Task to be deleted';

    await helper.createTask(page, text);
    await expect(page.getByText(text)).toBeVisible();

    // Delete the task
    await page.getByText(text).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    // await page.getByRole('button', { name: 'Confirm' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Do it!' }).click();
    await expect(page.getByText(text)).not.toBeVisible();
  });

});