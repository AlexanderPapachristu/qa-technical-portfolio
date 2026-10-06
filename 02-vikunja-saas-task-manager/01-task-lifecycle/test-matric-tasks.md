# Test Case Matrix: User Registration Flow

**Target Application:** Vikunja (SAAS Task Management)
**Component:** Task Lifecycle, Task Lifecycle & Date Boundaries 
**Designed By:** Alex Papachristu  
**Execution Type:** Manual Functional, Boundary Value Analysis (BVA), Equivalence Partitioning (EP)  
**Browser / OS:** Desktop Chrome / Windows 11

---

<!-- ### Scope & Objectives
Validate that the user account creation enforces all required fields, validates all input formats (email, password complexity, phone, postal code, DOB) and maintains its state across steps while securely creating a new user record without data loss or unhandled exceptions.  -->

---

### Test Scenarios Matrix

| Test ID | Test Scenario | Test Category | Preconditions / Input Data | Expected Result | Status |
|:---|:---|:---:|:---|:---|:---:|
| TC-TASK-01|Create standard task with title and default attributes| Positive / Functional| Target project exists and is active. Enter title `Shift v1.0 Release Notes` via quick-add input.| Task persists, renders at the top of the default list, and displays the project's Kanban/Gantt views.| PASS|
|TC-TASK-02| Quick-add submission with empty title| Negative| Place focus on task creation input field, type nothing/ whitespace, and press `Enter`.| Add button should not be clickable. No empty record is rendered in the UI; no network request is dispatched.| PASS|
|TC-TET-03| Title character limit/boundary check| Boundary| Enter long title string (250+ characters).| System either truncates gracefully with visual warning or handles storage without breaking the UI container layouts or throwing API 500 errors.| PASS|
|TC-TASK-04| Title character boundary check with emojis| Boundary| Enter a title with special characters and emojis.| System displays the emojis without breaking the UI or throwing API errors.| PASS|
TC-TASK-05| Mark task complete from checkbox| Functional/ State Transition| Existing active task in list view. Click the task status checkbox.| Checkbox toggles to check, task title strikes through/ moves to completed section, and `done: true` persists via `POST/PUT endpoint`.| PASS|
|TC-TASK-06| Reopen completed task| Functional/ State transition| Existing completed task. Uncheck the status checkbox.| Task reverts to open/incomplete state, strike-through disappears, and active status updates across all project views. | Untested| 
|TC-TASK-07| Due date before start date validation| Boundary/ Business Logic| Open task details drawer. Set start date to `Tomorrow 10:00 AM` and due date to `Yesterday 10:00 AM`.| Date picker flags conflicting timeline, or backend rejects with validation error preventing invalid chronological order. | Untested|
|TC-TASK-08| Recurring task generation on completion| Business Logic/ Recurrence | Create task with recurrence rule set to `Repeat daily after completion`. Mark task as done.| Current task marks as complete, and the next recurring instance automatically generates with the new scheduled due date.| Untested|
|TC-TASK-09| Task priority assignment and persistence| Functional| Set task priority to `Urgent` and refresh browser. | Priority tag/ flag reflects updated priority immediately and retains state across hard page refresh.| Untested| 
|TC-TASK-10| Markdown rendering in task description| Functional/ Sanitization| Add formatted text(`# Header`, `- Bullet item`, `**Bold text**`, `[Link](https://example.com)`) to description body.| Description correctly parses and renders markdown style; raw unrendered markup tags are not exposed in view mode.| Untested|
|TC-TASK-11| Hard deletion of task with confirmation| Functional/ Data Removal| Open task menu, select Delete, and confirm dialog prompt.| Task element removes from DOM immediately, associated reminders clear, and API returns `204 No Content` or `200 OK`. | Untested| 