# Test Case Matrix: User Registration Flow

**Target Application:** Practice Software Testing (Tool Shop)  
**Component:** User Authentication & Registration (`/#/auth/register`)  
**Designed By:** Alex Papachristu  
**Execution Type:** Manual Functional, Boundary Value Analysis (BVA), Equivalence Partitioning (EP)  

---

### Scope & Objectives
Validate that the user account creation enforces all required fields, validates all input formats (email, password complexity, phone, postal code, DOB) and maintains its state across steps while securely creating a new user record without data loss or unhandled exceptions. 

---

### Test Scenarios Matrix

| Test ID | Test Scenario | Test Category | Preconditions / Input Data | Expected Result | Status |
|:---|:---|:---:|:---|:---|:---:|
| **TC-REG-01** | Successful account registration with valid inputs | Positive / Happy Path | All mandatory fields populated with valid data; unique email (`testuser_qa@example.com`), password meets all requirements (`ValidPass123!`), valid postal and phone. | Account created successfully; user redirected to `/#/auth/login` (or logged in automatically) with a success toast notification. | PASS |
| **TC-REG-02** | Submit registration form with all fields blank | Negative / Validation | Navigate to form and click "Register" button immediately without typing. | Submission is blocked; inline validation indicators display beneath all mandatory inputs (First Name, Last Name, Email, Password, etc.). | PASS |
| **TC-REG-03** | Attempt registration with improperly formatted email | Negative / Input Validation | Email: `plainaddress`, `missing@domain`, or `user@.com`. Other fields valid. | Client-side validation prevents submission; displays error: *"E-mail format is invalid"*. No outgoing `POST` request dispatched. | **FAIL (See Bug-003 & Bug-004)** |
| **TC-REG-04** | Attempt registration with an already registered email | Negative / Business Logic | Email: `admin@practicesoftwaretesting.com` (existing user). Valid data for remaining fields. | API returns `422 Unprocessable Entity` or `409 Conflict`; UI displays a visible error banner: *"A customer with this email address already exists."* | PASS |
| **TC-REG-05** | Password complexity boundary: Below minimum length | Boundary (BVA) | Password: 6 characters (e.g., `Pass1!`) where minimum required is 8 characters. | Password field indicates complexity requirement not met; "Register" button disabled or submission blocked. | **FAIL (See Bug-005)** |
| **TC-REG-06** | Special character handling in Name fields | Edge / Security | First Name: `O'Connor-Smith`, Last Name: `<script>tes</script>`. | Input is properly sanitized and escaped; name persists without executing script tags or throwing database syntax errors. | **FAIL (See Bug-006)**|
| **TC-REG-07** | Address autofill localization with non-US postal format | Localization / Integration | Country: `Canada`, Postal Code: `L1T 2S5`, House Number: `78`. | Either resolves correct regional city/province or remains unpopulated for manual entry without populating conflicting US state data. | **Fail (See BUG-002)** |
| **TC-REG-08** | Date of Birth boundary validation (Future date) | Negative / Logic | Date of Birth: Set to tomorrow's date or a future year (e.g., `2030-01-01`). | Submission blocked; field displays error indicating Date of Birth cannot be in the future. | N/A |
| **TC-REG-09** | Rapid double-click on "Register" button | Concurrency / Network | Form completed with valid inputs; user rapidly double-clicks the "Register" button on slow network connection. | Button disables immediately upon first click; only a single `POST` request is sent to prevent duplicate record generation. | N/A |
| **TC-REG-10** | Password visibility toggle functionality | UI / Usability | Enter `RandomPass123` into password field; click "Show/Hide" eye icon. | Text switches dynamically between masked bullets (`••••••••`) and plain text without clearing or corrupting the input. | N/A |

---

### Defect Traceability

| Defect ID | Associated Test ID | Summary | Severity |
|:---|:---:|:---|:---:|
| **[BUG-002](../bug-reports/BUG-002-Register_New_User_Autofill.md)** | **TC-REG-07** | Postcode Lookup Populates US Mock Data for Canadian Addresses | Low |
| **[Bug-003](../bug-reports/BUG-003-Register_New_User_Improper_Email.md)** | **TC-REG-03** | Invalid email address allows user account creation | High |
| **[Bug-004](../bug-reports/BUG-004-Register_New_User_Improper_Email_No_Domain.md)** | **TC-REG-03** | Invalid email address with no domain allows for user account creation | High
| **[Bug-005](../bug-reports/BUG-005-Inconsistent_Password_Req.md)** | **TC-REG-05** | Inconsistent password requirements. | Medium |
| **[Bug-006](../bug-reports/BUG-006-Register_New_User_Special_Character_Last_Name.md)** | **TC-REG-06** | Script tags are allowed in the last name input box. | High |