# [BUG-004] Registering a new account with no domain

## Environment Details
- **Application:** Tool Shop Demo
- **Environment:** (`https://practicesoftwaretesting.com/auth/register`)
- **Test Account:** Create an account
- **Browser:** Chrome
- **Date/Time:** September 24

## Severity & Priority
- **Severity:** High
* *Reason:* The system allows new user accounts to be created with an invalid email address.
- **Priority:** High

## Prerequisites / Pre-conditions
1. Tool Shop Demo is running
2. User attempts to create a new account

## Steps to Reproduce
1. Navigate to (`https://practicesoftwaretesting.com`).
2. Press Sign in at the top of the page and click "Register your account".
3. Input all properly formatted information except for the email.
4. Add an email into the account using the @ symbol without the domain (`user@.com`).
5. Press "Register".

## Expected Result
The system should find there is no domain present in the email and disallow the user from making an account.

## Actual Result
The application successfully creates an account with no domain in the email. The login page then denies login with the email.

## Test Data / Edge Case Notes
This issue was discovered while attempting to create a new user with an improperly formatted email.

## Technical Diagnostics
* **Request URL:** `POST https://api.practicesoftwaretesting.com/users/register`
* **Status Code:** `201 Created`
* **Response Payload**
```json
{
    "first_name": "Test",
    "last_name": "Account",
    "dob": "2000-01-24",
    "phone": "6479298844",
    "email": "user@.com",
    "id": "01m3avmvsxp85spg5yzr9d0vqe",
    "created_at": "2026-09-24 23:22:40",
    "address": {
        "street": "Elmira Burgs",
        "house_number": null,
        "city": "East Rylee",
        "state": "New Hampshire",
        "country": "CA",
        "postal_code": "L1R 2R8"
    }
}
```

## Attachments
- **Screenshots/Video:** 
![Incorrect address](Screenshots/invalid_email_no_domain.png)

- **Console Logs:** 
![Console logs for incorrect address](Screenshots/invalid_email_no_domain_console.png)

- **Failed Login:** 
![Login page not allowing new login with invalid email](Screenshots/invalid_email_no_domain_login.png)