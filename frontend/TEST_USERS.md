# Test Users Reference

This document lists all test users available in the mock data system. You can log in with any of these emails (password can be anything) to test different roles and permission levels.

## Test Users

### Master Role (Full Access)
- **Email**: `alice@example.com`
- **Name**: Alice Williams
- **Role**: Master
- **Department**: None
- **Division**: None
- **What to Test**: Should see ALL folders and documents from ALL companies

### Company Admin - Acme Corporation
- **Email**: `charlie@example.com`
- **Name**: Charlie Brown
- **Role**: Company Admin
- **Department**: Legal
- **Division**: None
- **Company**: Acme Corporation (Company ID: 1)
- **What to Test**: Should see ALL folders and documents from Acme Corporation only

### Company Admin - Tech Solutions Ltd
- **Email**: `hannah@example.com`
- **Name**: Hannah Lee
- **Role**: Company Admin
- **Department**: Engineering
- **Division**: None
- **Company**: Tech Solutions Ltd (Company ID: 2)
- **What to Test**: Should see ALL folders and documents from Tech Solutions Ltd only

### Department Head - Legal
- **Email**: `bob@example.com`
- **Name**: Bob Johnson
- **Role**: Department Head
- **Department**: Legal
- **Division**: None
- **Company**: Acme Corporation
- **What to Test**: Should see department-wide and division-wide folders/documents in Legal department, plus company-wide items in their company

### Department Head - HR
- **Email**: `diana@example.com`
- **Name**: Diana Prince
- **Role**: Department Head
- **Department**: HR
- **Division**: None
- **Company**: Acme Corporation
- **What to Test**: Should see department-wide folders/documents in HR department, plus company-wide items in their company

### Division Head - Contracts
- **Email**: `edward@example.com`
- **Name**: Edward Norton
- **Role**: Division Head
- **Department**: Legal
- **Division**: Contracts
- **Company**: Acme Corporation
- **What to Test**: Should see division-wide folders/documents in Contracts division, plus department and company-wide items they have access to

### Staff - Legal/Contracts
- **Email**: `john@example.com`
- **Name**: John Doe
- **Role**: Staff
- **Department**: Legal
- **Division**: Contracts
- **Company**: Acme Corporation
- **What to Test**: Should see only folders/documents matching their scope (company/department/division)

### Staff - Legal/Compliance
- **Email**: `fiona@example.com`
- **Name**: Fiona Green
- **Role**: Staff
- **Department**: Legal
- **Division**: Compliance
- **Company**: Acme Corporation
- **What to Test**: Should see Compliance division documents, Legal department documents, and company-wide documents

### Staff - Finance/Accounting
- **Email**: `george@example.com`
- **Name**: George Wilson
- **Role**: Staff
- **Department**: Finance
- **Division**: Accounting
- **Company**: Acme Corporation
- **What to Test**: Should see Accounting division, Finance department, and company-wide documents

### Staff - Tech Solutions/Development
- **Email**: `ivan@example.com`
- **Name**: Ivan Petrov
- **Role**: Staff
- **Department**: Engineering
- **Division**: Development
- **Company**: Tech Solutions Ltd
- **What to Test**: Should see Development division, Engineering department, and company-wide documents from Tech Solutions only

### Manager - HR
- **Email**: `jane@example.com`
- **Name**: Jane Smith
- **Role**: Manager
- **Department**: HR
- **Division**: None
- **Company**: Acme Corporation
- **What to Test**: Should see HR department documents and company-wide documents

### Department Secretary - Legal
- **Email**: `julia@example.com`
- **Name**: Julia Roberts
- **Role**: Department Secretary
- **Department**: Legal
- **Division**: None
- **Company**: Acme Corporation
- **What to Test**: Should see Legal department documents and company-wide documents

## Testing Scenarios

### Scenario 1: Cross-Company Isolation
1. Log in as `charlie@example.com` (Company Admin - Acme)
2. Verify you only see folders/documents from Acme Corporation
3. Log out and log in as `hannah@example.com` (Company Admin - Tech Solutions)
4. Verify you only see folders/documents from Tech Solutions Ltd

### Scenario 2: Department-Level Access
1. Log in as `bob@example.com` (Department Head - Legal)
2. Verify you see:
   - All Legal department folders/documents
   - All Contracts and Compliance division folders/documents
   - Company-wide folders/documents from Acme
   - NOT HR or Finance department folders/documents (unless company-wide)

### Scenario 3: Division-Level Access
1. Log in as `john@example.com` (Staff - Contracts division)
2. Verify you see:
   - Contracts division folders/documents
   - Legal department folders/documents
   - Company-wide folders/documents
   - NOT Compliance division folders/documents
   - NOT HR or Finance folders/documents (unless company-wide)

### Scenario 4: Master Role Access
1. Log in as `alice@example.com` (Master)
2. Verify you see:
   - ALL folders and documents from ALL companies
   - Folders from both Acme Corporation and Tech Solutions Ltd

### Scenario 5: Scope-Based Filtering
1. Log in as `john@example.com` (Staff - Contracts)
2. Check that you see:
   - "Legal Documents" folder (department scope - you're in Legal)
   - "Contract Templates" folder (company scope - you're in Acme)
   - "Contracts Division Files" folder (division scope - you're in Contracts)
   - NOT "HR Documents" folder (department scope - different department)
   - NOT "Compliance Documents" folder (division scope - different division)
   - NOT Tech Solutions folders (different company)

## Test Folders Reference

### Acme Corporation Folders:

1. **Legal Documents** (Department scope, Legal dept)
   - Should be visible to: Legal department members, Company Admins, Master

2. **HR Documents** (Department scope, HR dept)
   - Should be visible to: HR department members, Company Admins, Master

3. **Contract Templates** (Company scope, Legal dept)
   - Should be visible to: All Acme Corporation members, Master

4. **Company Policies** (Company scope, HR dept)
   - Should be visible to: All Acme Corporation members, Master

5. **Contracts Division Files** (Division scope, Contracts division)
   - Should be visible to: Contracts division members, Legal department members, Company Admins, Master

6. **Finance Documents** (Department scope, Finance dept)
   - Should be visible to: Finance department members, Company Admins, Master

7. **Accounting Records** (Division scope, Accounting division)
   - Should be visible to: Accounting division members, Finance department members, Company Admins, Master

8. **Compliance Documents** (Division scope, Compliance division)
   - Should be visible to: Compliance division members, Legal department members, Company Admins, Master

### Tech Solutions Ltd Folders:

9. **Tech Solutions - Engineering** (Department scope, Engineering dept)
   - Should be visible to: Engineering department members, Tech Solutions Company Admins, Master

10. **Tech Solutions - Company Wide** (Company scope, Engineering dept)
    - Should be visible to: All Tech Solutions Ltd members, Master

11. **Development Team Docs** (Division scope, Development division)
    - Should be visible to: Development division members, Engineering department members, Tech Solutions Company Admins, Master

## Quick Login Instructions

1. Go to `/login` page
2. Enter any of the test user emails above
3. Enter any password (it's not validated in mock mode)
4. Click "Sign in"
5. You'll be logged in as that user and see only the folders/documents they have access to

## Notes

- All passwords are accepted in mock mode (enter anything)
- User permissions are based on:
  - Role (Master, Company Admin, Department Head, Division Head, Staff, etc.)
  - Company membership
  - Department membership
  - Division membership
  - Document/Folder scope (company, department, division)
- The current user is stored in localStorage and persists across page refreshes
- To switch users, log out and log in with a different email
