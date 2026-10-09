# Test Case Matrix: Task Lifecycle

**Target Application:** Vikunja (SAAS Task Management)
**Component:** Task Lifecycle & Date Boundaries 
**Designed By:** Alexander Papachristu  
**Execution Type:** Automated Playwright
**Techniques:** Boundary Value Analysis (BVA), Equivalence Partitioning (EP)  
**Browsers / OS:** Chromium / Firefox / WebKit / Windows 11

---

### Test Scenarios Matrix

| Test ID | Test Scenario | Test Category | Preconditions / Input Data | Expected Result | Status | Chromium | Firefox | WebKit | Automated Test|
|:---|:---|:---:|:---|:---|:---:| :----:|:----:|:---:|:----:|
| TC-TASK-01|Create standard task with title and default attributes| Positive / Functional| Target project exists and is active. Enter title `Shift v1.0 Release Notes` via quick-add input.| Task persists, renders at the top of the default list.| PASS|✅|✅|✅| [Create a new task](../tests/tc-task-script.spec.ts#L9)|
|TC-TASK-02| Quick-add submission with empty title| Negative| Place focus on task creation input field, type nothing/ whitespace, and press `Enter`.| Add button should not be clickable. No empty record is rendered in the UI.| PASS|✅|✅|✅|[adding an empty task](../tests/tc-task-script.spec.ts#L24)|
|TC-TASK-03| Title character limit/boundary check| Boundary| Enter long title string (500 characters).| The system saves the full title into the task without layout breakage. | PASS|✅|✅|✅|[title character limit](../tests/tc-task-script.spec.ts#L38)|
|TC-TASK-04| Title character boundary check with emojis| Boundary| Enter a title with special characters and emojis.| System displays the emojis without breaking the UI or throwing API errors.| PASS|✅|✅|✅|[emojis in the title](../tests/tc-task-script.spec.ts#L51)|
|TC-TASK-05| Mark task complete from checkbox| Functional/ State Transition| Existing active task in list view. Click the task status checkbox.| Checkbox toggles to check, and removes itself from the screen.| PASS|✅|✅|✅|[checkbox removes task](../tests/tc-task-script.spec.ts#L63)|
|TC-TASK-06| Reopen completed task| Functional/ State transition| Existing completed task. Uncheck the status checkbox.| Task reverts to open/incomplete state, and active status updates in the list view. | PASS| ✅|✅|✅|[checkbox adds items back](../tests/tc-task-script.spec.ts#L78)|
|TC-TASK-07| Due date before start date is shown overdue| Boundary/ Business Logic| Open task details drawer. Set start date to `Tomorrow` and due date to `Today`.| Task displays overdue message for task. | PASS|✅|✅|✅|[due date before start date](../tests/tc-task-script.spec.ts#L107)|
|TC-TASK-08| Recurring task generation on completion| Business Logic/ Recurrence | Create task with recurrence rule set to `Every Day`. Mark task as done.| Current task marks as complete, and the next recurring instance automatically generates with the new scheduled due date.| PASS|✅|✅|✅|[recurring task](../tests/tc-task-script.spec.ts#L140)|
|TC-TASK-09| Task priority assignment and persistence| Functional| Set task priority to `High` and refresh browser. | Priority tag/ flag reflects updated priority immediately and retains state across hard page refresh.| PASS|✅|✅|✅|[priority and persistence](../tests/tc-task-script.spec.ts#L161)| 
|TC-TASK-10| Markdown rendering in task description| Functional/ Sanitization| Add formatted text(`**Bold text**`,` _Italic Text_`) to description body and creating a link using the toolbar.| Description correctly parses and renders markdown style; raw unrendered markup tags are not exposed in view mode.| **FAIL (WebKit) (See BUG-001)** |✅|✅|❌|[markdown rendering](../tests/tc-task-script.spec.ts#L187)|
|TC-TASK-11| Hard deletion of task with confirmation| Functional/ Data Removal| Open task menu, select Delete, and confirm dialog prompt.| Task element removes from DOM immediately. | PASS|✅|✅|✅|[task deletion](../tests/tc-task-script.spec.ts#L226)|

### Defect Traceability

| Defect ID | Associated Test ID | Summary | Severity |
|:---|:---:|:---|:---:|
|**[BUG-001](./bug-reports/BUG-001-Link_Enter_Deletes_Text.md)**| TC-TASK-10 | Link text disappears after pressing enter to confirm the link. Error only occurs on WebKit browsers. | Major | 